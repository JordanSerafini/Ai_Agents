import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { AddDocumentDto } from './dto/add-document.dto';
import { QueryCollectionDto } from './dto/query-collection.dto';
import { ChromaDocument, ChromaCollection } from '../chroma/chroma.service';

@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('generate')
  async generateEmbedding(@Body('text') text: string) {
    const embedding = await this.embeddingService.createEmbedding(text);
    return { embedding };
  }

  @Post('document')
  async addDocument(@Body() dto: AddDocumentDto): Promise<ChromaDocument> {
    return this.embeddingService.addDocument(
      dto.content,
      dto.metadata || {},
      dto.id,
      dto.collection_name || 'default',
    );
  }

  @Post('query')
  async queryChromaDB(@Body() dto: QueryCollectionDto) {
    return this.embeddingService.queryChromaDB(
      dto.query,
      dto.collection_name || 'default',
      dto.limit || 5,
    );
  }

  /**
   * Récupère les informations d'une collection ChromaDB
   */
  @Get('collection/:name')
  async getCollection(@Param('name') name: string): Promise<ChromaCollection> {
    return this.embeddingService.getCollection(name);
  }

  /**
   * Crée une nouvelle collection dans ChromaDB
   */
  @Post('collection/:name')
  async createCollection(
    @Param('name') name: string,
  ): Promise<ChromaCollection> {
    return this.embeddingService.createCollection(name);
  }
}
