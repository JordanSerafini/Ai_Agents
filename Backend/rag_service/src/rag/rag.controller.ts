import { Body, Controller, Post } from '@nestjs/common';
import { RagService } from './rag.service';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
} from 'class-validator';

class StoreDocumentDto {
  @IsNotEmpty()
  @IsString()
  text: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

class QueryDto {
  @IsNotEmpty()
  @IsString()
  query: string;

  @IsOptional()
  @IsBoolean()
  includeContext?: boolean;
}

class ChatbotQueryDto {
  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsBoolean()
  includeContext?: boolean;

  @IsOptional()
  @IsString()
  userId?: string;
}

class SearchDto {
  @IsNotEmpty()
  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
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
  async search(@Body() dto: SearchDto): Promise<any> {
    return this.ragService.retrieveDocuments(dto.query, dto.limit);
  }

  @Post('chatbot')
  async chatbotQuery(@Body() dto: ChatbotQueryDto) {
    // Récupérer la réponse en utilisant le service RAG
    const response = await this.ragService.generateResponse(
      dto.message,
      dto.includeContext,
    );

    // Retourner une réponse formatée pour le chatbot
    return {
      query: dto.message,
      response,
      timestamp: new Date().toISOString(),
      userId: dto.userId || 'anonymous',
    };
  }
}
