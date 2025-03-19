import { Controller, Get, Param, Logger, Post } from '@nestjs/common';
import { RapportService, RapportEvaluation } from './rapport.service';
import { RagValidatorService } from '../rag-validator/rag-validator.service';

@Controller('rapports')
export class RapportController {
  private readonly logger = new Logger(RapportController.name);

  constructor(
    private readonly rapportService: RapportService,
    private readonly ragValidatorService: RagValidatorService,
  ) {}

  @Get()
  async getAllRapports() {
    this.logger.log('Récupération de tous les rapports');
    try {
      const rapports = await this.rapportService.getAllRapports();
      return {
        success: true,
        count: rapports.length,
        rapports,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des rapports: ${error.message}`,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      };
    }
  }

  @Get(':id')
  async getRapportById(@Param('id') id: string): Promise<{
    success: boolean;
    rapport?: RapportEvaluation;
    message?: string;
  }> {
    this.logger.log(`Récupération du rapport avec l'ID: ${id}`);
    try {
      const rapport = await this.rapportService.getRapport(id);
      return {
        success: true,
        rapport,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du rapport ${id}: ${error.message}`,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      };
    }
  }

  @Post('generate/:collection')
  async generateRapportManually(@Param('collection') collection: string) {
    this.logger.log(
      `Génération manuelle d'un rapport pour la collection ${collection}`,
    );
    try {
      // Pour générer un rapport manuellement, on valide d'abord la collection
      // et on génère un rapport à partir des résultats
      const validationResult =
        await this.ragValidatorService.validateCollection(collection);

      return {
        success: true,
        message: `Rapport généré avec succès pour la collection ${collection}`,
        rapportId: validationResult.rapportId || 'non disponible',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération du rapport: ${error.message}`,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      };
    }
  }
}
