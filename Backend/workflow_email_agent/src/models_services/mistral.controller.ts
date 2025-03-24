import {
  Controller,
  Post,
  Body,
  Logger,
  UsePipes,
  ValidationPipe,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ModelService } from './models.service';
import { FileInterceptor } from '@nestjs/platform-express';

export class AnalyseQuestionDto {
  question: string;
}

@Controller('mistral')
export class MistralController {
  private readonly logger = new Logger(MistralController.name);

  constructor(private readonly modelService: ModelService) {}

  @Post('analyse')
  @UsePipes(new ValidationPipe({ transform: true }))
  async analyseQuestion(@Body() dto: AnalyseQuestionDto) {
    this.logger.log(
      `Analyse de question via Mistral: "${dto.question?.substring(0, 30)}..."`,
    );

    if (!dto.question || dto.question.trim().length === 0) {
      throw new HttpException(
        'Question invalide ou vide',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const response = await this.modelService.analyzeWithMistralHF(
        dto.question,
      );

      return {
        success: true,
        question: dto.question,
        answer: response,
        source: 'huggingface',
      };
    } catch (error) {
      this.logger.error(`Erreur lors de l'analyse Mistral: ${error.message}`);
      throw new HttpException(
        `Erreur lors de l'analyse: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('analyze-file')
  @UseInterceptors(FileInterceptor('file'))
  async analyzeFile(@UploadedFile() file) {
    this.logger.log(`Analyse de fichier avec Mistral: ${file?.originalname}`);

    if (!file) {
      throw new HttpException('Aucun fichier fourni', HttpStatus.BAD_REQUEST);
    }

    try {
      // Encoder le fichier en base64
      const fileContent = file.buffer.toString('base64');

      // Envoyer à l'analyse
      const result = await this.modelService.analyzeFileWithMistralHF(
        fileContent,
        file.mimetype,
      );

      return {
        success: true,
        filename: file.originalname,
        fileType: file.mimetype,
        analysis: result,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse du fichier: ${error.message}`,
      );
      throw new HttpException(
        `Erreur lors de l'analyse: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('analyze-invoice')
  @UsePipes(new ValidationPipe({ transform: true }))
  async analyzeInvoice(
    @Body() dto: { ocrText: string; donutAnalysis: any; fileContent?: string },
  ) {
    this.logger.log('Analyse combinée de facture via Mistral');

    if (!dto.ocrText || dto.ocrText.trim().length === 0) {
      throw new HttpException(
        'Texte OCR invalide ou vide',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.modelService.analyzeInvoiceCombined(
        dto.ocrText,
        dto.donutAnalysis || {},
        dto.fileContent,
      );

      return {
        success: true,
        result,
        confidence: result.note || 0,
      };
    } catch (error) {
      this.logger.error(`Erreur lors de l'analyse combinée: ${error.message}`);
      throw new HttpException(
        `Erreur lors de l'analyse: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
