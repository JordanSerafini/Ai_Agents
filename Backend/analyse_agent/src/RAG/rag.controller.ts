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
    @Body() body: { documents: string[]; ids?: string[] },
  ) {
    return this.ragService.upsertDocuments(
      collectionName,
      body.documents,
      body.ids,
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

  @Post('question')
  async processQuestion(@Body() body: { question: string }): Promise<any> {
    try {
      const { question } = body;

      if (!question) {
        throw new BadRequestException('La question est requise');
      }

      // Utiliser la nouvelle méthode processQuestion qui intègre la recherche de questions similaires
      const result = await this.ragService.processQuestion(question);

      return result;
    } catch (error) {
      throw new HttpException(
        `Erreur lors du traitement de la question: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
