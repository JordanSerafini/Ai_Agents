import { Controller, Post, Body, Get, Query, Logger } from '@nestjs/common';
import { DocumentService } from './document.service';

@Controller('documents')
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(private readonly documentService: DocumentService) {}

  @Post('index')
  async indexDocument(@Body() document: any) {
    this.logger.log(`Indexing document: ${document.title}`);
    return this.documentService.indexDocument(document);
  }

  @Get('search')
  async searchDocuments(
    @Query('query') query: string,
    @Query('size') size?: number,
  ) {
    this.logger.log(`Searching documents for query: ${query}`);
    return this.documentService.searchDocuments(query, size);
  }

  @Post('ensure-index')
  async ensureIndex() {
    this.logger.log('Ensuring index exists');
    return this.documentService.ensureIndex();
  }
} 