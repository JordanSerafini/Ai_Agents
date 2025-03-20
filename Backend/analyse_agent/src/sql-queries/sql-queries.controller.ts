import {
  Controller,
  Post,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SqlQueriesService } from './sql-queries.service';

@Controller('sql-queries')
export class SqlQueriesController {
  constructor(private readonly sqlQueriesService: SqlQueriesService) {}

  @Get()
  async getAllQueries() {
    try {
      return await this.sqlQueriesService.getAllQueries();
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la récupération des requêtes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cleanup')
  async cleanupQueries() {
    try {
      return await this.sqlQueriesService.cleanupNonExistingEmbeddings();
    } catch (error) {
      throw new HttpException(
        `Erreur lors du nettoyage des embeddings: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reload')
  async reloadQueries() {
    try {
      return await this.sqlQueriesService.resetSqlQueriesCollection();
    } catch (error) {
      throw new HttpException(
        `Erreur lors du rechargement des requêtes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
