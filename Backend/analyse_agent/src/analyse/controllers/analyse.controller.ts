import { Controller, Post, Body, Logger, UsePipes } from '@nestjs/common';
import { AnalyseService } from '../services/analyse.service';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AnalyseResponseDto } from '../dto/analyse-response.dto';
import { AnalyseValidationPipe } from '../pipes/analyse-validation.pipe';

@Controller('analyse')
export class AnalyseController {
  private readonly logger = new Logger(AnalyseController.name);

  constructor(private readonly analyseService: AnalyseService) {}

  @Post()
  @UsePipes(AnalyseValidationPipe)
  async analyserDemande(
    @Body() demande: AnalyseRequestDto,
  ): Promise<AnalyseResponseDto> {
    try {
      this.logger.log(`Analyse de la demande ${demande.id}`);
      return await this.analyseService.analyseDemande(demande);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Erreur lors de l'analyse: ${error.message}`);
      } else {
        this.logger.error("Erreur inconnue lors de l'analyse");
      }
      throw error;
    }
  }
}
