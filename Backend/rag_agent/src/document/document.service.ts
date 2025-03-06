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
} 