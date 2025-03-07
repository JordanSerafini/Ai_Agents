require('dotenv').config();
const { Client } = require('@elastic/elasticsearch');

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

// Fonction pour afficher les résultats de manière plus lisible
function prettyPrint(obj) {
    console.log(JSON.stringify(obj, null, 2));
}

async function runTests() {
    try {
        console.log('=== Démarrage des tests de requêtes Elasticsearch ===\n');
        console.log('Configuration utilisée:');
        console.log('Node:', process.env.ELASTICSEARCH_NODE);
        console.log('Username:', process.env.ELASTICSEARCH_USERNAME);
        console.log('---\n');

        // Test 0: Vérification de la connexion
        console.log('Test 0: Vérification de la connexion à Elasticsearch');
        const health = await elasticClient.cluster.health();
        console.log('Statut du cluster:', health.status);
        console.log('Nombre de nœuds:', health.number_of_nodes);
        console.log('---\n');

        // Test 1: Recherche full-text avec analyse en français
        console.log('Test 1: Recherche full-text dans les projets avec analyse en français');
        const searchResult = await elasticClient.search({
            index: 'projects',
            body: {
                query: {
                    multi_match: {
                        query: 'rénovation travaux',
                        fields: ['name^2', 'description'],
                        type: 'most_fields',
                        operator: 'or',
                        analyzer: 'french_analyzer'
                    }
                },
                highlight: {
                    fields: {
                        name: {},
                        description: {}
                    }
                }
            }
        });
        console.log('Résultats trouvés:', searchResult.hits.total.value);
        if (searchResult.hits.hits.length > 0) {
            console.log('Premier résultat:', prettyPrint(searchResult.hits.hits[0]));
        }
        console.log('---\n');

        // Test 2: Agrégations complexes sur les devis
        console.log('Test 2: Statistiques sur les devis par statut et période');
        const aggResult = await elasticClient.search({
            index: 'quotations',
            body: {
                size: 0,
                aggs: {
                    status_stats: {
                        terms: { field: 'status.keyword' },
                        aggs: {
                            total_amount: { sum: { field: 'total' } },
                            avg_amount: { avg: { field: 'total' } },
                            by_month: {
                                date_histogram: {
                                    field: 'created_date',
                                    calendar_interval: 'month',
                                    format: 'yyyy-MM'
                                },
                                aggs: {
                                    monthly_total: { sum: { field: 'total' } }
                                }
                            }
                        }
                    }
                }
            }
        });
        console.log('Agrégations par statut:');
        prettyPrint(aggResult.aggregations);
        console.log('---\n');

        // Test 3: Recherche géographique sur les projets
        console.log('Test 3: Recherche de projets par zone géographique');
        const geoResult = await elasticClient.search({
            index: 'projects',
            body: {
                query: {
                    bool: {
                        must: [
                            {
                                match: {
                                    city: 'Paris'
                                }
                            }
                        ],
                        filter: [
                            {
                                term: {
                                    'status.keyword': 'en_cours'
                                }
                            }
                        ]
                    }
                },
                sort: [
                    {
                        start_date: {
                            order: 'desc'
                        }
                    }
                ]
            }
        });
        console.log('Projets trouvés:', geoResult.hits.total.value);
        if (geoResult.hits.hits.length > 0) {
            console.log('Premiers projets:', prettyPrint(geoResult.hits.hits.slice(0, 2)));
        }
        console.log('---\n');

        // Test 4: Recherche avec relations (joins) entre indices
        console.log('Test 4: Recherche de clients avec leurs projets et devis');
        const joinResult = await elasticClient.msearch({
            body: [
                { index: 'clients' },
                {
                    query: {
                        match: {
                            city: 'Paris'
                        }
                    }
                },
                { index: 'projects' },
                {
                    query: {
                        bool: {
                            must: [
                                {
                                    range: {
                                        start_date: {
                                            gte: 'now-6M'
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            ]
        });
        console.log('Résultats multi-index:');
        prettyPrint(joinResult.responses.map((r, i) => ({
            index: i === 0 ? 'clients' : 'projects',
            total: r.hits.total.value,
            hits: r.hits.hits.slice(0, 2)
        })));
        console.log('---\n');

        // Test 5: Recherche avec suggestions et auto-complétion
        console.log('Test 5: Test des suggestions et auto-complétion');
        const suggestResult = await elasticClient.search({
            index: 'clients',
            body: {
                suggest: {
                    text: 'pier',
                    name_suggest: {
                        term: {
                            field: 'firstname.keyword',
                            suggest_mode: 'popular',
                            sort: 'frequency'
                        }
                    }
                }
            }
        });
        console.log('Suggestions:');
        prettyPrint(suggestResult.suggest);
        console.log('---\n');

        // Test 6: Recherche avec filtres complexes sur les événements
        console.log('Test 6: Recherche d\'événements avec filtres complexes');
        const eventsResult = await elasticClient.search({
            index: 'calendar_events',
            body: {
                query: {
                    bool: {
                        must: [
                            {
                                range: {
                                    start_date: {
                                        gte: 'now',
                                        lte: 'now+30d'
                                    }
                                }
                            }
                        ],
                        should: [
                            {
                                term: {
                                    'event_type.keyword': 'reunion_chantier'
                                }
                            },
                            {
                                term: {
                                    'event_type.keyword': 'visite_technique'
                                }
                            }
                        ],
                        minimum_should_match: 1
                    }
                },
                sort: [
                    { start_date: 'asc' }
                ]
            }
        });
        console.log('Événements trouvés:', eventsResult.hits.total.value);
        if (eventsResult.hits.hits.length > 0) {
            console.log('Premiers événements:', prettyPrint(eventsResult.hits.hits.slice(0, 2)));
        }

        console.log('\n=== Tests terminés avec succès ===');
    } catch (error) {
        console.error('Erreur lors des tests:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

runTests(); 