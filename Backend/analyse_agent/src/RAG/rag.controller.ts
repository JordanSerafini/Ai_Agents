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
import { SqlQueriesService } from '../sql-queries/sql-queries.service';

@Controller('rag')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly sqlQueriesService: SqlQueriesService,
  ) {}

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

  @Post('collection/:name/cleanup')
  async cleanupCollection(@Param('name') collectionName: string) {
    try {
      // Vérifier si la collection existe
      const collection =
        await this.ragService.getOrCreateCollection(collectionName);

      // Obtenir tous les documents avec leurs métadonnées
      const allDocuments = await collection.get({
        include: ['embeddings', 'documents', 'metadatas'],
      });

      // Identifiants à supprimer (ceux qui n'ont pas d'embedding)
      const idsToDelete: string[] = [];

      if (allDocuments && allDocuments.ids) {
        for (let i = 0; i < allDocuments.ids.length; i++) {
          // Si l'embedding est vide ou inexistant pour cet ID
          if (
            !allDocuments.embeddings ||
            !allDocuments.embeddings[i] ||
            allDocuments.embeddings[i].length === 0
          ) {
            idsToDelete.push(allDocuments.ids[i]);
          }
        }
      }

      // Si nous avons des IDs à supprimer
      if (idsToDelete.length > 0) {
        // Supprimer les documents avec ces IDs
        await collection.delete({
          ids: idsToDelete,
        });
      }

      return {
        success: true,
        collectionName,
        documentsTotal: allDocuments.ids?.length || 0,
        documentsInvalid: idsToDelete.length,
        documentsRemaining:
          (allDocuments.ids?.length || 0) - idsToDelete.length,
        message: `Nettoyage terminé: ${idsToDelete.length} documents invalides supprimés`,
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors du nettoyage de la collection: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('collection/:name/reset')
  async resetCollection(@Param('name') collectionName: string) {
    try {
      // Supprimer et recréer la collection
      const client = this.ragService.getChromaClient();

      // Vérifier si la collection existe
      const collections = await client.listCollections();
      const collectionExists = collections.some((c) => c === collectionName);

      if (collectionExists) {
        // Supprimer la collection existante
        await client.deleteCollection({ name: collectionName });
      }

      // Créer une nouvelle collection
      const newCollection =
        await this.ragService.createCollection(collectionName);

      return {
        success: true,
        message: `Collection ${collectionName} réinitialisée avec succès`,
        collection: newCollection,
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la réinitialisation de la collection: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reload-sql-queries')
  async reloadSqlQueries() {
    try {
      // Appeler la méthode de réinitialisation directement
      const result = await this.sqlQueriesService.resetSqlQueriesCollection();

      return {
        success: true,
        message: 'Collection sql_queries rechargée avec succès',
        details: result,
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors du rechargement des requêtes SQL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reload-collection')
  async reloadCollection(@Body() body: { collection: string }) {
    try {
      const { collection } = body;

      if (!collection) {
        throw new BadRequestException('Le nom de la collection est requis');
      }

      // Si c'est la collection sql_queries, utiliser le service dédié
      if (collection === 'sql_queries') {
        const result = await this.sqlQueriesService.resetSqlQueriesCollection();
        return {
          success: true,
          message: `Collection ${collection} rechargée avec succès`,
          details: result,
        };
      }
      // Sinon, réinitialiser la collection génériquement
      else {
        // Supprimer et recréer la collection
        const client = this.ragService.getChromaClient();

        // Vérifier si la collection existe
        const collections = await client.listCollections();
        const collectionExists = collections.some((c) => c === collection);

        if (collectionExists) {
          // Supprimer la collection existante
          await client.deleteCollection({ name: collection });
        }

        // Créer une nouvelle collection
        const newCollection =
          await this.ragService.createCollection(collection);

        return {
          success: true,
          message: `Collection ${collection} réinitialisée avec succès`,
          collection: newCollection,
        };
      }
    } catch (error) {
      throw new HttpException(
        `Erreur lors du rechargement de la collection: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
