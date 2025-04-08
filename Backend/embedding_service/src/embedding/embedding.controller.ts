import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

class CreateEmbeddingDto {
  text: string;
}

class AddDocumentDto {
  text: string;
  metadata?: Record<string, any>;
  id?: string;
  collectionName?: string;
}

class QueryCollectionDto {
  text: string;
  collectionName?: string;
  limit?: number;
}

@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Post()
  async createEmbedding(@Body() body: CreateEmbeddingDto) {
    return {
      embedding: await this.embeddingService.createEmbedding(body.text),
    };
  }

  @Post('document')
  async addDocument(@Body() dto: AddDocumentDto) {
    return this.embeddingService.addDocumentToChroma(
      dto.text,
      dto.metadata,
      dto.id,
      dto.collectionName,
    );
  }

  @Post('query')
  async queryCollection(@Body() dto: QueryCollectionDto) {
    return this.embeddingService.queryChromaDB(
      dto.text,
      dto.collectionName,
      dto.limit,
    );
  }

  @Get('collection/:name')
  async getCollection(@Param('name') name: string) {
    return this.embeddingService.getCollection(name);
  }

  @Post('collection/:name')
  async createCollection(@Param('name') name: string) {
    return this.embeddingService.createCollection(name);
  }
}
