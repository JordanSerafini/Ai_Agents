import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';

interface DocumentSource {
  content: string;
  title: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly indexName: string;

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {
    this.indexName = this.configService.get<string>('ELASTICSEARCH_INDEX', 'documents');
  }

  async indexDocument(document: DocumentSource): Promise<any> {
    try {
      const response = await this.elasticsearchService.index({
        index: this.indexName,
        body: {
          ...document,
          timestamp: new Date().toISOString(),
        },
      });
      return response;
    } catch (error) {
      this.logger.error(`Error indexing document: ${error.message}`);
      throw error;
    }
  }

  async searchDocuments(query: string, size: number = 5): Promise<any[]> {
    try {
      const response = await this.elasticsearchService.search({
        index: this.indexName,
        body: {
          query: {
            multi_match: {
              query,
              fields: ['content', 'title'],
            },
          },
          size,
        },
      });
      return response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...(hit._source as DocumentSource),
      }));
    } catch (error) {
      this.logger.error(`Error searching documents: ${error.message}`);
      throw error;
    }
  }

  async ensureIndex(): Promise<boolean> {
    try {
      const exists = await this.elasticsearchService.indices.exists({
        index: this.indexName,
      });

      if (!exists) {
        await this.elasticsearchService.indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                content: { type: 'text' },
                title: { type: 'text' },
                timestamp: { type: 'date' },
                metadata: { type: 'object' },
              },
            },
          },
        });
        this.logger.log(`Created index: ${this.indexName}`);
      }

      return true;
    } catch (error) {
      this.logger.error(`Error ensuring index exists: ${error.message}`);
      return false;
    }
  }

  async listDocuments(page: number = 1, size: number = 10, search?: string): Promise<any> {
    try {
      const from = (page - 1) * size;
      
      let query: any = { match_all: {} };
      if (search) {
        query = {
          multi_match: {
            query: search,
            fields: ['content', 'title']
          }
        };
      }
      
      const response = await this.elasticsearchService.search({
        index: this.indexName,
        body: {
          from,
          size,
          query,
          sort: [{ timestamp: { order: 'desc' } }]
        }
      });
      
      let total = 0;
      if (typeof response.hits.total === 'number') {
        total = response.hits.total;
      } else if (response.hits.total && typeof response.hits.total === 'object' && 'value' in response.hits.total) {
        total = response.hits.total.value;
      }
      
      const documents = response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...(hit._source as DocumentSource)
      }));
      
      return {
        documents,
        pagination: {
          total,
          page,
          size,
          totalPages: Math.ceil(total / size)
        }
      };
    } catch (error) {
      this.logger.error(`Error listing documents: ${error.message}`);
      throw error;
    }
  }

  async deleteDocument(id: string): Promise<any> {
    try {
      const response = await this.elasticsearchService.delete({
        index: this.indexName,
        id
      });
      return response;
    } catch (error) {
      this.logger.error(`Error deleting document: ${error.message}`);
      throw error;
    }
  }
} 