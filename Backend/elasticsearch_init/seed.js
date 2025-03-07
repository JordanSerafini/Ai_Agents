const { Client } = require('@elastic/elasticsearch');
const { Pool } = require('pg');

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

// Fonction pour obtenir la liste des tables
async function getTables() {
    const query = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE';
    `;
    const result = await pgPool.query(query);
    return result.rows.map(row => row.table_name);
}

// Fonction pour indexer les données d'une table
async function indexTableData(tableName) {
    try {
        console.log(`Indexation des données de la table ${tableName}...`);
        
        // Récupérer toutes les données de la table
        const result = await pgPool.query(`SELECT * FROM ${tableName}`);
        const total = result.rows.length;
        
        if (total === 0) {
            console.log(`Aucune donnée à indexer pour la table ${tableName}`);
            return;
        }

        console.log(`${total} enregistrements trouvés dans ${tableName}`);

        // Préparer les opérations de bulk indexing
        const operations = result.rows.flatMap(doc => [
            { index: { _index: tableName, _id: doc.id ? doc.id.toString() : undefined } },
            doc
        ]);

        // Indexer par lots de 500 documents
        const chunkSize = 500;
        for (let i = 0; i < operations.length; i += chunkSize * 2) {
            const chunk = operations.slice(i, i + chunkSize * 2);
            await elasticClient.bulk({ operations: chunk, refresh: true });
            console.log(`${tableName}: ${Math.min((i + chunkSize * 2) / 2, total)}/${total} documents indexés`);
        }

        console.log(`Indexation de ${tableName} terminée avec succès`);
    } catch (error) {
        console.error(`Erreur lors de l'indexation de ${tableName}:`, error);
    }
}

// Fonction principale pour le seeding
async function seedData() {
    try {
        // Vérifier les connexions
        await elasticClient.ping();
        console.log('Connecté à Elasticsearch');

        await pgPool.query('SELECT NOW()');
        console.log('Connecté à PostgreSQL');

        // Obtenir la liste des tables
        const tables = await getTables();
        console.log(`${tables.length} tables à indexer`);

        // Indexer les données de chaque table
        for (const table of tables) {
            await indexTableData(table);
        }

        console.log('Seeding terminé avec succès');
        process.exit(0);
    } catch (error) {
        console.error('Erreur lors du seeding:', error);
        process.exit(1);
    }
}

// Exporter la fonction pour pouvoir l'appeler depuis index.js
module.exports = { seedData };
