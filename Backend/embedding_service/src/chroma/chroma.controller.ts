import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ChromaService } from './chroma.service';

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

@Controller('chroma')
export class ChromaController {
  constructor(private readonly chromaService: ChromaService) {}

  @Post('document')
  async addDocument(@Body() dto: AddDocumentDto) {
    return this.chromaService.addDocument(
      dto.text,
      dto.metadata,
      dto.id,
      dto.collectionName,
    );
  }

  @Post('query')
  async queryCollection(@Body() dto: QueryCollectionDto) {
    return this.chromaService.queryCollection(
      dto.text,
      dto.collectionName,
      dto.limit,
    );
  }

  @Get('collection/:name')
  async getCollection(@Param('name') name: string) {
    return this.chromaService.getCollection(name);
  }

  @Post('collection/:name')
  async createCollection(@Param('name') name: string) {
    await this.chromaService.createCollection(name);
    return { success: true, message: `Collection ${name} créée` };
  }
}
