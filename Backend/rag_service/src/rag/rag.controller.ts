import { Body, Controller, Post } from '@nestjs/common';
import { RagService } from './rag.service';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  Min,
  Max,
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

class SimilarQuestionsDto {
  @IsNotEmpty()
  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;
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

  @Post('similar-questions')
  async findSimilarQuestions(@Body() dto: SimilarQuestionsDto) {
    return this.ragService.findMultipleSimilarQuestions(
      dto.query,
      dto.limit || 5,
      dto.threshold || 0.5,
    );
  }

  @Post('analyze-intent')
  async analyzeQuestionIntent(@Body() dto: SimilarQuestionsDto) {
    const similarQuestions = await this.ragService.findMultipleSimilarQuestions(
      dto.query,
      dto.limit || 5,
      dto.threshold || 0.5,
    );
    
    // Si nous n'avons pas de questions similaires, essayons de générer une réponse
    if (similarQuestions.questions.length === 0) {
      const response = await this.ragService.generateResponse(dto.query, true);
      return {
        originalQuery: dto.query,
        similarQuestions: [],
        generatedResponse: response,
        analysis: {
          foundMatch: false,
          recommendation: "Aucune question similaire trouvée. Une nouvelle réponse a été générée."
        }
      };
    }
    
    // Obtenir une analyse sémantique des questions similaires
    // Ceci est juste une structure - dans un cas réel, vous pourriez utiliser un LLM pour analyser
    return {
      originalQuery: dto.query, 
      similarQuestions: similarQuestions.questions,
      analysis: {
        foundMatch: true,
        bestMatch: similarQuestions.questions[0],
        confidenceScore: similarQuestions.questions[0].similarity,
        alternativeCount: similarQuestions.questions.length - 1,
        recommendation: similarQuestions.questions[0].similarity > 0.85 
          ? "Une correspondance très proche a été trouvée" 
          : "Plusieurs options possibles, vérification humaine recommandée"
      }
    };
  }
}
