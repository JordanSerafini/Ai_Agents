import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { IndicesCreateRequest } from '@elastic/elasticsearch/lib/api/types';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly indices = {
    projects: 'projects',
    clients: 'clients',
    tasks: 'tasks',
    documents: 'documents',
    suppliers: 'suppliers',
    equipment: 'equipment',
  };

  // Durée de mise en cache par défaut (en secondes)
  private readonly DEFAULT_CACHE_TTL = 3600; // 1 heure
  // Durée de mise en cache pour les recherches fréquentes (en secondes)
  private readonly FREQUENT_SEARCH_CACHE_TTL = 86400; // 24 heures

  // Synonymes pour le domaine de la construction
  private readonly constructionSynonyms = [
    "chantier, projet, construction",
    "bâtiment, immeuble, édifice, construction",
    "rénovation, réhabilitation, restauration",
    "client, maître d'ouvrage, donneur d'ordre",
    "fournisseur, prestataire, sous-traitant",
    "devis, estimation, proposition, offre",
    "facture, note, mémoire",
    "délai, échéance, date limite",
  ];

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Vérifie si l'index existe, le crée sinon
   * @param index Nom de l'index
   */
  async checkIndex(index: string): Promise<boolean> {
    try {
      const exists = await this.elasticsearchService.indices.exists({
        index,
      });

      if (!exists) {
        await this.createIndex(index);
        return true;
      }
      return true;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la vérification de l'index ${index}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Crée un index avec les mappings appropriés
   * @param index Nom de l'index
   */
  private async createIndex(index: string): Promise<void> {
    try {
      const settings = this.getIndexSettings();
      const mappings = this.getIndexMappings(index);

      await this.elasticsearchService.indices.create({
        index,
        body: {
          settings,
          mappings,
        },
      });

      this.logger.log(`Index ${index} créé avec succès`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création de l'index ${index}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Retourne les paramètres de configuration de l'index
   */
  private getIndexSettings() {
    return {
      analysis: {
        analyzer: {
          french_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'french_elision',
              'french_stop',
              'french_stemmer',
              'construction_synonyms',
            ],
          },
          autocomplete: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'french_elision',
              'french_stop',
              'edge_ngram_filter',
            ],
          },
        },
        filter: {
          french_elision: {
            type: 'elision',
            articles: [
              'l',
              'm',
              't',
              'qu',
              'n',
              's',
              'j',
              'd',
              'c',
              'jusqu',
              'quoiqu',
              'lorsqu',
              'puisqu',
            ],
          },
          french_stop: {
            type: 'stop',
            stopwords: '_french_',
          },
          french_stemmer: {
            type: 'stemmer',
            language: 'light_french',
          },
          construction_synonyms: {
            type: 'synonym',
            synonyms: this.constructionSynonyms,
          },
          edge_ngram_filter: {
            type: 'edge_ngram',
            min_gram: 2,
            max_gram: 20,
          },
        },
      },
      // Optimisation des performances
      number_of_shards: 1,
      number_of_replicas: 1,
      refresh_interval: '1s',
    };
  }

  /**
   * Retourne les mappings pour un index spécifique
   * @param index Nom de l'index
   */
  private getIndexMappings(index: string) {
    // Mapping de base pour les champs textuels
    const baseTextMapping = {
      type: 'text',
      analyzer: 'french_analyzer',
      search_analyzer: 'french_analyzer',
      fields: {
        keyword: {
          type: 'keyword',
          ignore_above: 256,
        },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete',
          search_analyzer: 'french_analyzer',
        },
        raw: {
          type: 'keyword',
        },
      },
    };

    // Mapping pour les champs de recherche vectorielle
    const vectorField = {
      type: 'dense_vector',
      dims: 384, // Dimension pour les embeddings de modèles comme BERT
      index: true,
      similarity: 'cosine',
    };

    switch (index) {
      case this.indices.projects:
        return {
          properties: {
            id: { type: 'keyword' },
            name: baseTextMapping,
            description: baseTextMapping,
            status: { type: 'keyword' },
            client_id: { type: 'keyword' },
            client_name: baseTextMapping,
            start_date: { type: 'date' },
            end_date: { type: 'date' },
            city: baseTextMapping,
            zip_code: { type: 'keyword' },
            street_name: baseTextMapping,
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
            embedding: vectorField,
            // Champs supplémentaires pour les facettes
            budget: { type: 'double' },
            category: { type: 'keyword' },
            tags: { type: 'keyword' },
          },
        };
      case this.indices.clients:
        return {
          properties: {
            id: { type: 'keyword' },
            firstname: baseTextMapping,
            lastname: baseTextMapping,
            email: { type: 'keyword' },
            phone: { type: 'keyword' },
            city: baseTextMapping,
            zip_code: { type: 'keyword' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
            embedding: vectorField,
            // Champs supplémentaires
            company: baseTextMapping,
            type: { type: 'keyword' },
          },
        };
      case this.indices.documents:
        return {
          properties: {
            id: { type: 'keyword' },
            title: baseTextMapping,
            description: baseTextMapping,
            content: baseTextMapping,
            file_path: { type: 'keyword' },
            file_type: { type: 'keyword' },
            project_id: { type: 'keyword' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
            embedding: vectorField,
            // Métadonnées extraites
            entities: { type: 'keyword' },
            keywords: { type: 'keyword' },
            category: { type: 'keyword' },
          },
        };
      case this.indices.suppliers:
        return {
          properties: {
            id: { type: 'keyword' },
            name: baseTextMapping,
            description: baseTextMapping,
            contact_name: baseTextMapping,
            email: { type: 'keyword' },
            phone: { type: 'keyword' },
            address: baseTextMapping,
            city: baseTextMapping,
            zip_code: { type: 'keyword' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
            embedding: vectorField,
            // Champs supplémentaires
            category: { type: 'keyword' },
            rating: { type: 'float' },
            specialties: { type: 'keyword' },
          },
        };
      // Autres mappings...
      default:
        return {
          properties: {
            id: { type: 'keyword' },
            name: baseTextMapping,
            description: baseTextMapping,
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
            embedding: vectorField,
          },
        };
    }
  }

  /**
   * Recherche sémantique dans les projets avec mise en cache
   * @param query Terme de recherche
   * @param filters Filtres optionnels
   */
  async searchProjects(query: string, filters?: Record<string, any>) {
    try {
      // Générer une clé de cache unique basée sur la requête et les filtres
      const cacheKey = this.generateCacheKey('projects', query, filters);
      
      // Vérifier si les résultats sont en cache
      const cachedResults = await this.cacheManager.get(cacheKey);
      if (cachedResults) {
        this.logger.log(`Résultats récupérés du cache pour la requête: ${query}`);
        return cachedResults;
      }
      
      await this.checkIndex(this.indices.projects);

      const searchResponse = await this.elasticsearchService.search({
        index: this.indices.projects,
        body: {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query,
                    fields: ['name^3', 'description^2', 'city', 'client_name'],
                    fuzziness: 'AUTO',
                  },
                },
              ],
              filter: this.buildFilters(filters),
            },
          },
          // Ajouter des agrégations pour les facettes
          aggs: {
            categories: {
              terms: {
                field: 'category.keyword',
                size: 10,
              },
            },
            statuses: {
              terms: {
                field: 'status.keyword',
                size: 10,
              },
            },
            tags: {
              terms: {
                field: 'tags.keyword',
                size: 20,
              },
            },
            budget_ranges: {
              range: {
                field: 'budget',
                ranges: [
                  { to: 10000 },
                  { from: 10000, to: 50000 },
                  { from: 50000, to: 100000 },
                  { from: 100000 },
                ],
              },
            },
          },
          // Limiter les champs retournés pour optimiser la taille de la réponse
          _source: [
            'id',
            'name',
            'description',
            'status',
            'client_name',
            'city',
            'start_date',
            'end_date',
            'budget',
            'category',
            'tags',
          ],
        },
      });

      const results = this.formatSearchResults(searchResponse);
      
      // Mettre en cache les résultats
      const ttl = this.isFrequentSearch(query) 
        ? this.FREQUENT_SEARCH_CACHE_TTL 
        : this.DEFAULT_CACHE_TTL;
      
      await this.cacheManager.set(cacheKey, results, ttl);
      
      return results;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche de projets: ${error.message}`,
      );
      // Fallback à PostgreSQL en cas d'erreur
      return this.fallbackToPostgres('projects', query);
    }
  }

  /**
   * Recherche de projets similaires avec mise en cache
   * @param projectId ID du projet de référence
   */
  async findSimilarProjects(projectId: number) {
    try {
      // Générer une clé de cache unique
      const cacheKey = `similar_projects:${projectId}`;
      
      // Vérifier si les résultats sont en cache
      const cachedResults = await this.cacheManager.get(cacheKey);
      if (cachedResults) {
        this.logger.log(`Résultats similaires récupérés du cache pour le projet: ${projectId}`);
        return cachedResults;
      }
      
      await this.checkIndex(this.indices.projects);

      const project = await this.databaseService.executeQuery(
        'SELECT name, description FROM projects WHERE id = $1',
        [projectId],
      );

      if (!project.length) return [];

      const searchResponse = await this.elasticsearchService.search({
        index: this.indices.projects,
        body: {
          query: {
            more_like_this: {
              fields: ['name', 'description'],
              like: [
                {
                  _index: this.indices.projects,
                  doc: {
                    name: project[0].name,
                    description: project[0].description,
                  },
                },
              ],
              min_term_freq: 1,
              max_query_terms: 12,
            },
          },
          _source: [
            'id',
            'name',
            'description',
            'status',
            'client_name',
            'city',
            'start_date',
            'end_date',
          ],
        },
      });

      const results = this.formatSearchResults(searchResponse);
      
      // Mettre en cache les résultats
      await this.cacheManager.set(cacheKey, results, this.DEFAULT_CACHE_TTL);
      
      return results;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche de projets similaires: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Recherche dans les documents avec mise en cache
   * @param query Terme de recherche
   */
  async searchDocuments(query: string) {
    try {
      // Générer une clé de cache unique
      const cacheKey = this.generateCacheKey('documents', query);
      
      // Vérifier si les résultats sont en cache
      const cachedResults = await this.cacheManager.get(cacheKey);
      if (cachedResults) {
        this.logger.log(`Résultats récupérés du cache pour la requête: ${query}`);
        return cachedResults;
      }
      
      await this.checkIndex(this.indices.documents);

      const searchResponse = await this.elasticsearchService.search({
        index: this.indices.documents,
        body: {
          query: {
            multi_match: {
              query,
              fields: ['title^3', 'description^2', 'content'],
              fuzziness: 'AUTO',
            },
          },
          _source: [
            'id',
            'title',
            'description',
            'file_type',
            'project_id',
            'created_at',
          ],
        },
      });

      const results = this.formatSearchResults(searchResponse);
      
      // Mettre en cache les résultats
      await this.cacheManager.set(cacheKey, results, this.DEFAULT_CACHE_TTL);
      
      return results;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche de documents: ${error.message}`,
      );
      return this.fallbackToPostgres('documents', query);
    }
  }

  /**
   * Recherche dans les fournisseurs avec mise en cache
   * @param query Terme de recherche
   */
  async searchSuppliers(query: string) {
    try {
      // Générer une clé de cache unique
      const cacheKey = this.generateCacheKey('suppliers', query);
      
      // Vérifier si les résultats sont en cache
      const cachedResults = await this.cacheManager.get(cacheKey);
      if (cachedResults) {
        this.logger.log(`Résultats récupérés du cache pour la requête: ${query}`);
        return cachedResults;
      }
      
      await this.checkIndex(this.indices.suppliers);

      const searchResponse = await this.elasticsearchService.search({
        index: this.indices.suppliers,
        body: {
          query: {
            multi_match: {
              query,
              fields: ['name^3', 'description^2', 'specialties', 'city'],
              fuzziness: 'AUTO',
            },
          },
          _source: [
            'id',
            'name',
            'description',
            'contact_name',
            'email',
            'phone',
            'city',
            'category',
            'rating',
            'specialties',
          ],
        },
      });

      const results = this.formatSearchResults(searchResponse);
      
      // Mettre en cache les résultats
      await this.cacheManager.set(cacheKey, results, this.DEFAULT_CACHE_TTL);
      
      return results;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche de fournisseurs: ${error.message}`,
      );
      return this.fallbackToPostgres('suppliers', query);
    }
  }

  /**
   * Construit les filtres pour la recherche Elasticsearch
   * @param filters Filtres à appliquer
   */
  private buildFilters(filters?: Record<string, any>): any[] {
    if (!filters) return [];

    const filterClauses: any[] = [];

    // Filtre par statut
    if (filters.status) {
      filterClauses.push({
        term: { status: filters.status },
      });
    }

    // Filtre par date
    if (filters.startDate || filters.endDate) {
      filterClauses.push({
        range: {
          start_date: {
            gte: filters.startDate || null,
            lte: filters.endDate || null,
          },
        },
      });
    }

    // Filtre par client
    if (filters.clientId) {
      filterClauses.push({
        term: { client_id: filters.clientId },
      });
    }

    // Filtre par catégorie
    if (filters.category) {
      filterClauses.push({
        term: { 'category.keyword': filters.category },
      });
    }

    // Filtre par tags
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
      filterClauses.push({
        terms: { 'tags.keyword': filters.tags },
      });
    }

    // Filtre par budget
    if (filters.minBudget || filters.maxBudget) {
      filterClauses.push({
        range: {
          budget: {
            gte: filters.minBudget || 0,
            lte: filters.maxBudget || null,
          },
        },
      });
    }

    return filterClauses;
  }

  /**
   * Formate les résultats de recherche Elasticsearch
   * @param response Réponse d'Elasticsearch
   */
  private formatSearchResults(response: any) {
    const hits = response.hits?.hits || [];
    
    return hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
      score: hit._score,
    }));
  }

  /**
   * Fallback à PostgreSQL en cas d'erreur Elasticsearch
   * @param entity Type d'entité
   * @param query Terme de recherche
   */
  private async fallbackToPostgres(entity: string, query: string) {
    try {
      this.logger.log(`Fallback à PostgreSQL pour la recherche de ${entity}`);
      
      const searchTerm = `%${query}%`;
      let sqlQuery = '';
      let params = [searchTerm, searchTerm];
      
      switch (entity) {
        case 'projects':
          sqlQuery = `
            SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
            FROM projects p
            JOIN clients c ON p.client_id = c.id
            WHERE p.name ILIKE $1 OR p.description ILIKE $2
            ORDER BY p.created_at DESC
            LIMIT 20
          `;
          break;
        case 'documents':
          sqlQuery = `
            SELECT * FROM documents
            WHERE title ILIKE $1 OR description ILIKE $2
            ORDER BY created_at DESC
            LIMIT 20
          `;
          break;
        case 'suppliers':
          sqlQuery = `
            SELECT * FROM suppliers
            WHERE name ILIKE $1 OR description ILIKE $2
            ORDER BY created_at DESC
            LIMIT 20
          `;
          break;
        default:
          return [];
      }
      
      const results = await this.databaseService.executeQuery(sqlQuery, params);
      return results;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du fallback à PostgreSQL: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Génère une clé de cache unique pour une recherche
   * @param entity Type d'entité
   * @param query Terme de recherche
   * @param filters Filtres optionnels
   */
  private generateCacheKey(entity: string, query: string, filters?: Record<string, any>): string {
    const queryKey = query.toLowerCase().trim();
    const filtersKey = filters ? JSON.stringify(filters) : '';
    return `search:${entity}:${queryKey}:${filtersKey}`;
  }

  /**
   * Détermine si une recherche est fréquente et mérite une mise en cache plus longue
   * @param query Terme de recherche
   */
  private isFrequentSearch(query: string): boolean {
    // Liste des termes de recherche fréquents
    const frequentTerms = [
      'rénovation',
      'construction',
      'plomberie',
      'électricité',
      'peinture',
      'urgent',
      'retard',
    ];
    
    const lowerQuery = query.toLowerCase();
    return frequentTerms.some(term => lowerQuery.includes(term));
  }

  /**
   * Invalide le cache pour une entité spécifique
   * @param entity Type d'entité
   * @param id ID de l'entité
   */
  async invalidateCache(entity: string, id?: number): Promise<void> {
    try {
      if (id) {
        // Invalider le cache pour une entité spécifique
        await this.cacheManager.del(`${entity}:${id}`);
        
        // Invalider aussi le cache des projets similaires si c'est un projet
        if (entity === 'projects') {
          await this.cacheManager.del(`similar_projects:${id}`);
        }
      } else {
        // Invalider tout le cache pour ce type d'entité
        // Note: ceci est une simplification, dans un système réel,
        // vous voudriez utiliser un mécanisme plus sophistiqué pour gérer les clés de cache
        const keys = await (this.cacheManager as any).store?.keys(`search:${entity}:*`) || [];
        for (const key of keys) {
          await this.cacheManager.del(key);
        }
      }
      
      this.logger.log(`Cache invalidé pour ${entity}${id ? ` avec l'ID ${id}` : ''}`);
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de l'invalidation du cache: ${error.message}`,
      );
    }
  }
}
