import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import {
  SearchRequest,
  SearchResponse,
  SearchHit,
  IndexRequest,
  IndexResponse,
  DeleteRequest,
  DeleteResponse,
  BulkIndexRequest,
  BulkIndexResponse,
} from '../interfaces/search.interface';
import {
  SearchDto,
  IndexDto,
  DeleteDto,
  BulkIndexDto,
} from '../dto/search.dto';
import {
  SearchResponseDto,
  IndexResponseDto,
  DeleteResponseDto,
  BulkIndexResponseDto,
  SearchHitDto,
  BulkIndexItemDto,
} from '../dto/response.dto';
import { SearchRequestDto } from '../dto/request.dto';
import { SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';
import { RagClientService } from '../../../services/rag.service';

@Injectable()
export class ElasticsearchService {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly defaultIndex: string;
  private readonly defaultAlias: string;

  constructor(
    private readonly esService: NestElasticsearchService,
    private readonly configService: ConfigService,
    private readonly ragClientService: RagClientService,
  ) {
    this.defaultIndex = this.configService.get<string>(
      'ELASTICSEARCH_DEFAULT_INDEX',
      'documents',
    );
    this.defaultAlias = this.configService.get<string>(
      'ELASTICSEARCH_DEFAULT_ALIAS',
      'documents_alias',
    );
    this.logger.log(
      `Elasticsearch service initialized with default index: ${this.defaultIndex} and alias: ${this.defaultAlias}`,
    );
  }

  /**
   * Effectue une recherche dans Elasticsearch avec support de search_after
   */
  async search(request: SearchRequestDto): Promise<SearchResponseDto> {
    const response = await this.esService.search({
      index: request.index,
      body: {
        query: request.query,
        sort: request.sort,
        from: request.from,
        size: request.size,
        search_after: request.search_after,
      },
    });

    return {
      hits: response.hits.hits.map((hit) => ({
        id: hit._id || '',
        score: hit._score || 0,
        index: hit._index,
        _source: hit._source as Record<string, any>,
        highlight: hit.highlight,
      })),
      total:
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total as SearchTotalHits).value,
      took: response.took,
      nextPage:
        response.hits.hits.length === request.size
          ? response.hits.hits[response.hits.hits.length - 1].sort
          : undefined,
    };
  }

  /**
   * Indexe un document dans Elasticsearch
   */
  async index(indexDto: IndexDto): Promise<IndexResponseDto> {
    try {
      const { index, document, id, refresh = false } = indexDto;
      const response = await this.esService.index({
        index: index || 'default',
        id,
        body: document,
        refresh,
      });

      return {
        id: response._id,
        index: response._index,
        version: response._version,
        result: response.result,
      };
    } catch (error) {
      this.logger.error(`Error indexing document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Supprime un document d'Elasticsearch
   */
  async delete(deleteDto: DeleteDto): Promise<DeleteResponseDto> {
    try {
      const { index, id, refresh = false } = deleteDto;
      const response = await this.esService.delete({
        index: index || 'default',
        id,
        refresh,
      });

      return {
        id: response._id,
        index: response._index,
        result: response.result,
      };
    } catch (error) {
      this.logger.error(`Error deleting document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Indexe plusieurs documents en une seule opération
   */
  async bulkIndex(bulkIndexDto: BulkIndexDto): Promise<BulkIndexResponseDto> {
    try {
      const { index, documents, refresh = false } = bulkIndexDto;
      const body = documents.flatMap((doc) => [
        {
          index: {
            _index: index || 'default',
            _id: doc.id,
          },
        },
        doc,
      ]);

      const response = await this.esService.bulk({
        refresh,
        body,
      });

      return {
        took: response.took,
        errors: response.errors,
        items: response.items.map((item: any) => ({
          id: item.index._id,
          result: item.index.result,
        })),
      };
    } catch (error) {
      this.logger.error(`Error performing bulk index: ${error.message}`);
      throw error;
    }
  }

  /**
   * Vérifie si l'index existe et le crée si nécessaire
   */
  async ensureIndex(index: string = this.defaultIndex): Promise<boolean> {
    try {
      const exists = await this.esService.indices.exists({ index });

      if (!exists) {
        await this.esService.indices.create({
          index,
          body: {
            mappings: {
              properties: {
                content: { type: 'text' },
                title: { type: 'text' },
                created_at: { type: 'date' },
                updated_at: { type: 'date' },
                tags: { type: 'keyword' },
                category: { type: 'keyword' },
              },
            },
          },
        });
        this.logger.log(`Created index: ${index}`);
      }

      return true;
    } catch (error) {
      this.logger.error(`Error ensuring index exists: ${error.message}`);
      return false;
    }
  }

  /**
   * Vérifie la santé d'Elasticsearch
   */
  async checkHealth() {
    try {
      const response = await this.esService.ping();
      return {
        status: 'ok',
        elasticsearch: {
          status: response ? 'ok' : 'error',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Error checking health: ${error.message}`);
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  /**
   * Gère les alias d'index
   */
  async manageIndexAlias(
    indexName: string,
    aliasName: string,
    operation: 'add' | 'remove',
  ): Promise<boolean> {
    try {
      const exists = await this.esService.indices.exists({ index: indexName });
      if (!exists) {
        throw new Error(`Index ${indexName} does not exist`);
      }

      const actions: Array<{
        add?: { index: string; alias: string };
        remove?: { index: string; alias: string };
      }> = [];

      if (operation === 'add') {
        actions.push({
          add: {
            index: indexName,
            alias: aliasName,
          },
        });
      } else {
        actions.push({
          remove: {
            index: indexName,
            alias: aliasName,
          },
        });
      }

      await this.esService.indices.updateAliases({
        body: {
          actions,
        },
      });

      this.logger.log(
        `Successfully ${operation}ed alias ${aliasName} for index ${indexName}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error managing index alias: ${error.message}`);
      return false;
    }
  }

  /**
   * Crée un nouvel index avec un alias
   */
  async createIndexWithAlias(
    indexName: string,
    aliasName: string,
    mappings: any,
  ): Promise<boolean> {
    try {
      // Créer le nouvel index
      await this.esService.indices.create({
        index: indexName,
        body: {
          mappings,
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
          },
        },
      });

      // Ajouter l'alias
      await this.manageIndexAlias(indexName, aliasName, 'add');

      this.logger.log(
        `Successfully created index ${indexName} with alias ${aliasName}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error creating index with alias: ${error.message}`);
      return false;
    }
  }

  /**
   * Réindexe les données d'un index vers un autre
   */
  async reindex(sourceIndex: string, targetIndex: string): Promise<boolean> {
    try {
      await this.esService.reindex({
        body: {
          source: {
            index: sourceIndex,
          },
          dest: {
            index: targetIndex,
          },
        },
      });

      this.logger.log(
        `Successfully reindexed from ${sourceIndex} to ${targetIndex}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error reindexing: ${error.message}`);
      return false;
    }
  }

  async createIndex(index: string, mappings: any): Promise<void> {
    const exists = await this.esService.indices.exists({ index });
    if (!exists) {
      await this.esService.indices.create({
        index,
        body: {
          mappings,
        },
      });
    }
  }

  async deleteIndex(index: string): Promise<void> {
    const exists = await this.esService.indices.exists({ index });
    if (exists) {
      await this.esService.indices.delete({ index });
    }
  }

  async updateAlias(index: string, alias: string): Promise<void> {
    await this.esService.indices.updateAliases({
      body: {
        actions: [
          {
            add: {
              index,
              alias,
            },
          },
        ],
      },
    });
  }

  async enhanceSearchWithRag(query: string, documents: any[]): Promise<any> {
    try {
      this.logger.log(`Enhancing search with RAG: ${query}`);
      
      // Convertir les documents en format approprié pour le RAG
      const document = {
        content: documents.map(doc => JSON.stringify(doc)).join('\n'),
        title: `Search results for: ${query}`,
        timestamp: new Date().toISOString(),
      };
      
      // Utiliser le service RAG pour améliorer les résultats
      const enhancedResults = await this.ragClientService.indexAndQuery(document, query);
      
      return {
        original_results: documents,
        enhanced_context: enhancedResults,
      };
    } catch (error) {
      this.logger.error(`Error enhancing search with RAG: ${error.message}`);
      return { original_results: documents };
    }
  }
}
