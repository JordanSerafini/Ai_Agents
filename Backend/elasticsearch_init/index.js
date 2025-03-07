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

// Fonction pour convertir le type PostgreSQL en type Elasticsearch
function pgTypeToEsType(pgType) {
    const typeMapping = {
        'integer': 'integer',
        'bigint': 'long',
        'numeric': 'double',
        'decimal': 'double',
        'real': 'float',
        'double precision': 'double',
        'smallint': 'short',
        'character varying': 'text',
        'varchar': 'text',
        'text': 'text',
        'char': 'keyword',
        'boolean': 'boolean',
        'date': 'date',
        'timestamp': 'date',
        'timestamp with time zone': 'date',
        'timestamp without time zone': 'date',
        'jsonb': 'object',
        'json': 'object',
        'uuid': 'keyword',
        'bytea': 'binary',
        'point': 'geo_point',
        'time': 'text',
        'interval': 'text',
        'array': 'array'
    };

    // Si le type contient "[]", c'est un tableau
    if (pgType.endsWith('[]')) {
        return {
            type: 'array'
        };
    }

    return {
        type: typeMapping[pgType] || 'text'
    };
}

// Fonction pour obtenir la structure de toutes les tables
async function getTableStructures() {
    const query = `
        SELECT 
            t.table_name,
            array_agg(
                json_build_object(
                    'column_name', c.column_name,
                    'data_type', c.data_type,
                    'is_nullable', c.is_nullable
                )
            ) as columns
        FROM 
            information_schema.tables t
        JOIN 
            information_schema.columns c 
            ON t.table_name = c.table_name
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
                properties[column.column_name] = pgTypeToEsType(column.data_type);
            }

            // Créer l'index avec le mapping
            await elasticClient.indices.create({
                index: table.table_name,
                body: {
                    settings: {
                        analysis: {
                            analyzer: {
                                french_analyzer: {
                                    type: 'french'
                                }
                            }
                        }
                    },
                    mappings: {
                        properties: properties
                    }
                }
            });

            console.log(`Index ${table.table_name} créé avec succès`);
        } catch (error) {
            console.error(`Erreur lors de la création de l'index ${table.table_name}:`, error);
            throw error; // Propager l'erreur pour arrêter le processus
        }
    }
}

// Fonction principale
async function main() {
    try {
        // Attendre que les services soient prêts
        console.log('Attente de 30 secondes pour que les services soient prêts...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
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