import { Controller, Post, Body, Get, Query, Logger, Delete, Param, Res } from '@nestjs/common';
import { DocumentService } from './document.service';
import { join } from 'path';

@Controller('document')
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

  @Get('list')
  async listDocuments(
    @Query('page') page: number = 1,
    @Query('size') size: number = 10,
    @Query('search') search?: string
  ) {
    this.logger.log(`Listing documents: page=${page}, size=${size}, search=${search || 'none'}`);
    return this.documentService.listDocuments(page, size, search);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string) {
    this.logger.log(`Deleting document with ID: ${id}`);
    return this.documentService.deleteDocument(id);
  }

  @Get('ui')
  async getUI(@Res() res) {
    this.logger.log('Serving RAG document management UI');
    return res.sendFile(join(__dirname, 'ui', 'index.html'));
  }
} 