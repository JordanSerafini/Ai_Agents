import { Controller, Post, Body, Get, Query, Logger } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(private readonly ragService: RagService) {}

  @Post('query')
  async query(@Body() body: { query: string }) {
    this.logger.log(`Processing RAG query: ${body.query}`);
    return this.ragService.query(body.query);
  }

  @Post('index-and-query')
  async indexAndQuery(@Body() body: { document: any; query: string }) {
    this.logger.log(`Indexing document and processing query: ${body.query}`);
    return this.ragService.indexAndQuery(body.document, body.query);
  }
}
