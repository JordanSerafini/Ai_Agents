import { Body, Controller, Post } from '@nestjs/common';
import { RagService } from './rag.service';

class StoreDocumentDto {
  text: string;
  metadata?: Record<string, any>;
}

class QueryDto {
  query: string;
  includeContext?: boolean;
}

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('store')
  async storeDocument(@Body() dto: StoreDocumentDto) {
    return this.ragService.storeDocument(dto.text, dto.metadata);
  }

  @Post('query')
  async query(@Body() dto: QueryDto) {
    return this.ragService.generateResponse(dto.query, dto.includeContext);
  }

  @Post('search')
  async search(@Body() dto: { query: string; limit?: number }) {
    return this.ragService.retrieveDocuments(dto.query, dto.limit);
  }
} 