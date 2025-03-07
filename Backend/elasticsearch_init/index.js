const { Client } = require('@elastic/elasticsearch');
const { Pool } = require('pg');
const { seedData } = require('./seed');

// Configuration Elasticsearch
const elasticClient = new Client({
    node: process.env.ELASTICSEARCH_NODE,
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Configuration PostgreSQL
const pgPool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USERNAME,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE
});

// Fonction pour convertir le type PostgreSQL en type Elasticsearch avec options avancées
function pgTypeToEsType(column) {
    const pgType = column.data_type.toLowerCase();
    const baseType = pgType.split('(')[0]; // Gestion des types avec précision comme varchar(255)
    
    // Configuration de base pour les types
    const typeConfig = {
        // Nombres
        'integer': { type: 'integer' },
        'bigint': { type: 'long' },
        'smallint': { type: 'short' },
        'decimal': { type: 'double' },
        'numeric': { type: 'double' },
        'real': { type: 'float' },
        'double precision': { type: 'double' },
        'serial': { type: 'integer' },
        'bigserial': { type: 'long' },

        // Texte
        'character varying': { 
            type: 'text',
            analyzer: 'french_analyzer',
            fields: {
                keyword: { type: 'keyword', ignore_above: 256 }
            }
        },
        'varchar': { 
            type: 'text',
            analyzer: 'french_analyzer',
            fields: {
                keyword: { type: 'keyword', ignore_above: 256 }
            }
        },
        'text': { 
            type: 'text',
            analyzer: 'french_analyzer',
            fields: {
                keyword: { type: 'keyword', ignore_above: 256 }
            }
        },
        'char': { type: 'keyword' },
        'character': { type: 'keyword' },

        // Dates et temps
        'timestamp': { 
            type: 'date',
            format: 'strict_date_optional_time||epoch_millis'
        },
        'timestamp with time zone': { 
            type: 'date',
            format: 'strict_date_optional_time||epoch_millis'
        },
        'timestamp without time zone': { 
            type: 'date',
            format: 'strict_date_optional_time||epoch_millis'
        },
        'date': { type: 'date' },
        'time': { type: 'keyword' },
        'interval': { type: 'keyword' },

        // Booléens
        'boolean': { type: 'boolean' },

        // JSON
        'json': { 
            type: 'object',
            enabled: true
        },
        'jsonb': { 
            type: 'object',
            enabled: true
        },

        // UUID et binaires
        'uuid': { type: 'keyword' },
        'bytea': { type: 'binary' },

        // Géométrie
        'point': { type: 'geo_point' },

        // Types spéciaux
        'enum': { type: 'keyword' },
        'citext': { 
            type: 'text',
            analyzer: 'french_analyzer',
            fields: {
                keyword: { type: 'keyword', ignore_above: 256 }
            }
        }
    };

    // Gestion des tableaux
    if (pgType.endsWith('[]')) {
        const baseTypeName = pgType.slice(0, -2);
        const baseMapping = typeConfig[baseTypeName] || { type: 'text' };
        return baseMapping;
    }

    // Gestion des types enum personnalisés
    if (!typeConfig[baseType]) {
        // Si c'est probablement un type enum personnalisé
        if (column.udt_name && column.udt_name.endsWith('_enum')) {
            return { type: 'keyword' };
        }
    }

    // Gestion spéciale des champs numériques avec précision
    if (column.numeric_precision && (baseType === 'numeric' || baseType === 'decimal')) {
        return {
            type: 'double',
            coerce: true
        };
    }

    return typeConfig[baseType] || { 
        type: 'text',
        analyzer: 'french_analyzer',
        fields: {
            keyword: { type: 'keyword', ignore_above: 256 }
        }
    };
}

// Fonction pour obtenir la structure de toutes les tables avec informations détaillées
async function getTableStructures() {
    const query = `
        WITH enum_values AS (
            SELECT 
                t.typname,
                array_agg(e.enumlabel) as enum_values
            FROM pg_type t 
            JOIN pg_enum e ON t.oid = e.enumtypid
            GROUP BY t.typname
        )
        SELECT 
            t.table_name,
            array_agg(
                json_build_object(
                    'column_name', c.column_name,
                    'data_type', c.data_type,
                    'udt_name', c.udt_name,
                    'is_nullable', c.is_nullable,
                    'column_default', c.column_default,
                    'character_maximum_length', c.character_maximum_length,
                    'numeric_precision', c.numeric_precision,
                    'numeric_scale', c.numeric_scale,
                    'datetime_precision', c.datetime_precision,
                    'enum_values', CASE 
                        WHEN ev.enum_values IS NOT NULL 
                        THEN ev.enum_values 
                        ELSE NULL 
                    END
                )
            ) as columns,
            EXISTS (
                SELECT 1 
                FROM information_schema.table_constraints tc 
                WHERE tc.table_name = t.table_name 
                AND tc.constraint_type = 'PRIMARY KEY'
            ) as has_primary_key
        FROM 
            information_schema.tables t
        JOIN 
            information_schema.columns c ON t.table_name = c.table_name
        LEFT JOIN 
            enum_values ev ON c.udt_name = ev.typname
        WHERE 
            t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
        GROUP BY 
            t.table_name;
    `;

    const result = await pgPool.query(query);
    return result.rows;
}

// Fonction pour créer les index Elasticsearch
async function createIndices(tables) {
    for (const table of tables) {
        try {
            // Vérifier si l'index existe déjà
            const indexExists = await elasticClient.indices.exists({
                index: table.table_name
            });

            if (indexExists) {
                console.log(`L'index ${table.table_name} existe déjà, suppression...`);
                await elasticClient.indices.delete({
                    index: table.table_name
                });
            }

            // Créer le mapping pour la table
            const properties = {};
            for (const column of table.columns) {
                properties[column.column_name] = pgTypeToEsType(column);
            }

            // Créer l'index avec le mapping
            await elasticClient.indices.create({
                index: table.table_name,
                body: {
                    settings: {
                        analysis: {
                            analyzer: {
                                french_analyzer: {
                                    type: 'french',
                                    stopwords: '_french_'
                                },
                                text_analyzer: {
                                    type: 'custom',
                                    tokenizer: 'standard',
                                    filter: ['lowercase', 'asciifolding']
                                }
                            },
                            normalizer: {
                                lowercase_normalizer: {
                                    type: 'custom',
                                    filter: ['lowercase', 'asciifolding']
                                }
                            }
                        },
                        number_of_shards: 1,
                        number_of_replicas: 1,
                        refresh_interval: '1s'
                    },
                    mappings: {
                        dynamic: false, // Désactiver le mapping dynamique
                        properties: properties
                    }
                }
            });

            console.log(`Index ${table.table_name} créé avec succès`);
        } catch (error) {
            console.error(`Erreur lors de la création de l'index ${table.table_name}:`, error);
            throw error;
        }
    }
}

// Fonction principale
async function main() {
    try {
        // Attendre que les services soient prêts
        console.log('Attente de 10 secondes pour que les services soient prêts...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Vérifier la connexion à Elasticsearch
        await elasticClient.ping();
        console.log('Connecté à Elasticsearch');

        // Vérifier la connexion à PostgreSQL
        await pgPool.query('SELECT NOW()');
        console.log('Connecté à PostgreSQL');

        // Obtenir la structure de toutes les tables
        console.log('Extraction des structures de tables...');
        const tables = await getTableStructures();
        console.log(`${tables.length} tables trouvées`);

        // Créer les indices
        console.log('Création des indices Elasticsearch...');
        await createIndices(tables);
        console.log('Initialisation des indices terminée avec succès');

        // Lancer le seeding des données
        console.log('Démarrage du seeding des données...');
        await seedData();

    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        process.exit(1);
    }
}

main(); 