import { Controller, Post, Body, Logger, Get } from '@nestjs/common';
import { AnalyseService } from '../services/analyse.service';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { ReorientationRequestDto } from '../dto/reorientation-request.dto';
import { ReorientationService } from '../services/reorientation.service';
import { QueryBuilderClientService } from '../services/clients';

@Controller('analyse')
export class AnalyseController {
  private readonly logger = new Logger(AnalyseController.name);

  constructor(
    private readonly analyseService: AnalyseService,
    private readonly reorientationService: ReorientationService,
    private readonly queryBuilderClient: QueryBuilderClientService,
  ) {}

  @Post()
  async analyser(@Body() request: AnalyseRequestDto) {
    this.logger.log(
      `Requête reçue: userId=${request.userId}, useHistory=${request.useHistory}, question="${request.question}"`,
    );
    return this.analyseService.analyser(request);
  }

  @Post('reorienter')
  async reorienterQuestion(@Body() request: ReorientationRequestDto) {
    this.logger.log(
      `Requête de réorientation reçue: userId=${request.userId}, question="${request.question}"`,
    );
    return this.reorientationService.reorienterQuestion(request);
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'analyse_agent',
    };
  }

  @Get('database-metadata')
  async getDatabaseMetadata() {
    try {
      // Utiliser le client QueryBuilder pour obtenir les métadonnées
      const health = await this.queryBuilderClient.checkHealth();
      if (!health) {
        return {
          error: "L'agent QueryBuilder n'est pas disponible",
          status: 'error',
        };
      }

      // Rediriger vers l'endpoint de métadonnées de l'agent QueryBuilder
      return {
        message:
          "Cette fonctionnalité est maintenant gérée par l'agent QueryBuilder",
        redirectTo: '/querybuilder/database-metadata',
      };
    } catch (error) {
      return {
        error: `Erreur lors de la communication avec l'agent QueryBuilder, ${error}`,
        status: 'error',
      };
    }
  }
}
