import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';

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

  // Synonymes pour le domaine de la construction
  private readonly constructionSynonyms = [
    'chantier, projet, construction',
    'bâtiment, immeuble, édifice, construction',
    'rénovation, réhabilitation, restauration',
    'client, maître d\'ouvrage, donneur d\'ordre',
    'fournisseur, prestataire, sous-traitant',
    'devis, estimation, proposition, offre',
    'facture, note, mémoire',
    'délai, échéance, date limite',
  ];

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
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
    } catch (error) {
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
            articles: ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd', 'c', 'jusqu', 'quoiqu', 'lorsqu', 'puisqu'],
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
   * Recherche sémantique dans les projets
   * @param query Terme de recherche
   * @param filters Filtres optionnels
   */
  async searchProjects(query: string, filters?: any) {
    try {
      await this.checkIndex(this.indices.projects);

      const { body } = await this.elasticsearchService.search({
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
        },
      });

      return this.formatSearchResults(body);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de projets: ${error.message}`,
      );
      // Fallback à PostgreSQL en cas d'erreur
      return this.fallbackToPostgres('projects', query);
    }
  }

  /**
   * Recherche de projets similaires
   * @param projectId ID du projet de référence
   */
  async findSimilarProjects(projectId: number) {
    try {
      await this.checkIndex(this.indices.projects);

      const project = await this.databaseService.executeQuery(
        'SELECT name, description FROM projects WHERE id = $1',
        [projectId],
      );

      if (!project.length) return [];

      const { body } = await this.elasticsearchService.search({
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
        },
      });

      return this.formatSearchResults(body);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de projets similaires: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Recherche dans les documents
   * @param query Terme de recherche
   */
  async searchDocuments(query: string) {
    try {
      await this.checkIndex(this.indices.documents);

      const { body } = await this.elasticsearchService.search({
        index: this.indices.documents,
        body: {
          query: {
            multi_match: {
              query,
              fields: ['title^3', 'content^2', 'tags'],
              fuzziness: 'AUTO',
            },
          },
        },
      });

      return this.formatSearchResults(body);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de documents: ${error.message}`,
      );
      return this.fallbackToPostgres('documents', query);
    }
  }

  /**
   * Recherche dans les fournisseurs
   * @param query Terme de recherche
   */
  async searchSuppliers(query: string) {
    try {
      await this.checkIndex(this.indices.suppliers);

      const { body } = await this.elasticsearchService.search({
        index: this.indices.suppliers,
        body: {
          query: {
            multi_match: {
              query,
              fields: ['name^3', 'description^2', 'products', 'category'],
              fuzziness: 'AUTO',
            },
          },
        },
      });

      return this.formatSearchResults(body);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de fournisseurs: ${error.message}`,
      );
      return this.fallbackToPostgres('suppliers', query);
    }
  }

  /**
   * Construit les filtres pour la requête Elasticsearch
   * @param filters Filtres à appliquer
   */
  private buildFilters(filters?: any) {
    if (!filters) return [];

    const result = [];
    if (filters.status) {
      result.push({ term: { status: filters.status } });
    }
    if (filters.dateStart && filters.dateEnd) {
      result.push({
        range: {
          start_date: {
            gte: filters.dateStart,
            lte: filters.dateEnd,
          },
        },
      });
    }
    if (filters.client_id) {
      result.push({ term: { client_id: filters.client_id } });
    }
    return result;
  }

  /**
   * Formate les résultats de recherche Elasticsearch
   * @param body Résultat brut d'Elasticsearch
   */
  private formatSearchResults(body: any) {
    const hits = body.hits.hits;
    return hits.map((item) => {
      return {
        id: item._id,
        score: item._score,
        ...item._source,
      };
    });
  }

  /**
   * Fallback vers PostgreSQL en cas d'erreur Elasticsearch
   * @param entity Type d'entité
   * @param query Terme de recherche
   */
  private async fallbackToPostgres(entity: string, query: string) {
    const searchTerm = `%${query}%`;

    switch (entity) {
      case 'projects':
        return this.databaseService.executeQuery(
          'SELECT * FROM projects WHERE name ILIKE $1 OR description ILIKE $1 LIMIT 10',
          [searchTerm],
        );
      case 'clients':
        return this.databaseService.executeQuery(
          'SELECT * FROM clients WHERE firstname ILIKE $1 OR lastname ILIKE $1 LIMIT 10',
          [searchTerm],
        );
      case 'documents':
        return this.databaseService.executeQuery(
          'SELECT * FROM documents WHERE title ILIKE $1 OR content ILIKE $1 LIMIT 10',
          [searchTerm],
        );
      case 'suppliers':
        return this.databaseService.executeQuery(
          'SELECT * FROM suppliers WHERE name ILIKE $1 OR description ILIKE $1 LIMIT 10',
          [searchTerm],
        );
      default:
        return [];
    }
  }
}
