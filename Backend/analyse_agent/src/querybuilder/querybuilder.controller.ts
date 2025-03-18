import { Controller, Post, Body, Logger } from '@nestjs/common';
import { QueryBuilderService } from './querybuilder.service';

@Controller('querybuilder')
export class QueryBuilderController {
  private readonly logger = new Logger(QueryBuilderController.name);

  constructor(private readonly queryBuilderService: QueryBuilderService) {}

  @Post('execute')
  async executeQuery(@Body() body: { query: string; params?: any[] }) {
    const { query, params = [] } = body;
    this.logger.log(`Requête SQL reçue: ${query}`);

    // Vérifier si la requête est sécurisée
    if (!this.queryBuilderService.isSafeSqlQuery(query)) {
      this.logger.warn(
        `Requête SQL potentiellement dangereuse rejetée: ${query}`,
      );
      return {
        success: false,
        error: 'Requête SQL non autorisée pour des raisons de sécurité',
      };
    }

    try {
      const result = await this.queryBuilderService.executeQuery(query, params);
      return {
        success: true,
        data: result.rows,
        rowCount: result.rowCount,
        duration: result.duration,
      };
    } catch (error) {
      this.logger.error(`Erreur d'exécution de la requête: ${error.message}`);
      const friendlyMessage =
        this.queryBuilderService.parsePostgresError(error);
      return {
        success: false,
        error: friendlyMessage,
      };
    }
  }
}
