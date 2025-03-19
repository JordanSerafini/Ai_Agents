import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RagService } from './rag.service';

interface BestMatch {
  prompt: string;
  id: string;
  similarity: number;
  metadata?: Record<string, any>;
}

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('collection/:name')
  async createCollection(@Param('name') name: string) {
    return this.ragService.createCollection(name);
  }

  @Post('collection/:name/documents')
  async addDocuments(
    @Param('name') collectionName: string,
    @Body() body: { documents: string[] },
  ) {
    return this.ragService.addDocuments(collectionName, body.documents);
  }

  @Post('collection/:name/upsert')
  async upsertDocuments(
    @Param('name') collectionName: string,
    @Body()
    body: {
      documents: string[];
      ids?: string[];
      metadatas?: Record<string, any>[];
    },
  ) {
    return this.ragService.upsertDocuments(
      collectionName,
      body.documents,
      body.ids,
      body.metadatas,
    );
  }

  @Get('collection/:name/similar')
  async findSimilarDocuments(
    @Param('name') collectionName: string,
    @Query('query') query: string,
    @Query('limit') limit?: number,
  ) {
    return this.ragService.findSimilarDocuments(
      collectionName,
      query,
      limit ? parseInt(limit.toString(), 10) : undefined,
    );
  }

  @Get('collection/:name/check-prompt')
  async findSimilarPrompt(
    @Param('name') collectionName: string,
    @Query('prompt') prompt: string,
    @Query('threshold') threshold?: number,
  ) {
    return this.ragService.findSimilarPrompt(
      collectionName,
      prompt,
      threshold ? parseFloat(threshold.toString()) : undefined,
    );
  }

  @Get('collection/:name/document/:id')
  async getDocument(
    @Param('name') collectionName: string,
    @Param('id') documentId: string,
  ) {
    return this.ragService.getDocument(collectionName, documentId);
  }

  @Get('collection/:name/documents')
  async getAllDocuments(@Param('name') collectionName: string) {
    return this.ragService.getAllDocuments(collectionName);
  }

  @Post('collection/:name/validate')
  async validateCollection(@Param('name') collectionName: string) {
    return this.ragService.validateCollection(collectionName);
  }
}
