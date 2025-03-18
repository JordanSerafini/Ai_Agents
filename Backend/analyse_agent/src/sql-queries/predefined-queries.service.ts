import { Injectable, Logger } from '@nestjs/common';
import { RagService } from '../RAG/rag.service';

@Injectable()
export class PredefinedQueriesService {
  private readonly logger = new Logger(PredefinedQueriesService.name);
  private readonly sqlQueryCacheName = 'sql_queries';

  constructor(private readonly ragService: RagService) {}

  /**
   * Recherche une requête prédéfinie correspondant à la question
   */
  async findPredefinedQuery(question: string): Promise<any> {
    try {
      const result = await this.ragService.findSimilarPrompt(
        this.sqlQueryCacheName,
        question,
        0.85,
      );

      if (result.found && result.metadata) {
        this.logger.log(
          `Requête prédéfinie trouvée: ${result.metadata.id} (similarité: ${result.similarity})`,
        );
        return {
          found: true,
          query: result.metadata.finalQuery,
          description: result.metadata.questionReformulated,
          parameters: this.detectRequiredParameters(result.metadata.finalQuery),
          predefinedParameters: result.metadata.parameters || [],
          id: result.metadata.id,
        };
      }

      return { found: false };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de requête prédéfinie: ${error.message}`,
      );
      return { found: false, error: error.message };
    }
  }

  /**
   * Détecte les paramètres requis dans une requête SQL
   */
  private detectRequiredParameters(query: string): string[] {
    const paramRegex = /\[([A-Z_]+)\]/g;
    const matches = [...query.matchAll(paramRegex)];
    return [...new Set(matches.map((match) => match[1]))];
  }

  /**
   * Remplace les paramètres dans une requête SQL
   */
  replaceQueryParameters(
    query: string,
    parameters: Record<string, string>,
  ): string {
    let processedQuery = query;

    // Remplacer chaque paramètre
    for (const [key, value] of Object.entries(parameters)) {
      const regex = new RegExp(`\\[${key}\\]`, 'g');
      processedQuery = processedQuery.replace(regex, value);
    }

    return processedQuery;
  }
}
