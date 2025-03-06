import { Injectable, Logger } from '@nestjs/common';
import { AnalyseQueryData } from '../interfaces/query-builder.types';
import { QueryBuilderException } from '../exceptions/query-builder.exception';

@Injectable()
export class QueryValidatorService {
  private readonly logger = new Logger(QueryValidatorService.name);

  /**
   * Valide les données de requête pour s'assurer qu'elles sont complètes et cohérentes
   */
  validateQueryData(data: AnalyseQueryData): void {
    this.logger.debug('Validation des données de requête');

    // Validation des tables
    if (
      !data.tables ||
      !Array.isArray(data.tables) ||
      data.tables.length === 0
    ) {
      throw new QueryBuilderException('Les tables sont requises');
    }

    // Vérification de la table principale
    const mainTables = data.tables.filter((t) => t.type === 'PRINCIPALE');
    if (mainTables.length === 0) {
      throw new QueryBuilderException(
        'Au moins une table principale est requise',
      );
    }
    if (mainTables.length > 1) {
      throw new QueryBuilderException(
        'Une seule table principale est autorisée',
      );
    }

    // Validation des propriétés des tables
    data.tables.forEach((table) => {
      if (!table.nom || typeof table.nom !== 'string') {
        throw new QueryBuilderException(`Nom de table invalide: ${table.nom}`);
      }
      if (!table.alias || typeof table.alias !== 'string') {
        throw new QueryBuilderException(
          `Alias invalide pour la table ${table.nom}`,
        );
      }
      if (!Array.isArray(table.colonnes) || table.colonnes.length === 0) {
        throw new QueryBuilderException(
          `Colonnes invalides pour la table ${table.nom}`,
        );
      }
      if (table.type === 'JOINTE' && !table.condition_jointure) {
        throw new QueryBuilderException(
          `Condition de jointure manquante pour la table ${table.nom}`,
        );
      }
    });

    // Validation des conditions
    if (data.conditions) {
      if (!Array.isArray(data.conditions)) {
        throw new QueryBuilderException(
          'Les conditions doivent être un tableau',
        );
      }

      const validConditionTypes = ['FILTRE', 'TEMPOREL', 'LOGIQUE'];

      data.conditions.forEach((condition, index) => {
        if (!condition.type || !condition.expression) {
          throw new QueryBuilderException(
            `Condition invalide à l'index ${index}`,
          );
        }
        if (!validConditionTypes.includes(condition.type)) {
          throw new QueryBuilderException(
            `Type de condition invalide: ${condition.type}`,
          );
        }
        // Validation des paramètres si présents
        if (condition.parametres && typeof condition.parametres !== 'object') {
          throw new QueryBuilderException(
            `Paramètres invalides pour la condition à l'index ${index}`,
          );
        }
      });
    }

    // Validation des métadonnées
    if (data.metadata) {
      if (typeof data.metadata !== 'object') {
        throw new QueryBuilderException(
          'Les métadonnées doivent être un objet',
        );
      }
      if (
        data.metadata.intention &&
        typeof data.metadata.intention !== 'string'
      ) {
        throw new QueryBuilderException(
          "L'intention doit être une chaîne de caractères",
        );
      }
      if (
        data.metadata.description &&
        typeof data.metadata.description !== 'string'
      ) {
        throw new QueryBuilderException(
          'La description doit être une chaîne de caractères',
        );
      }
    }
  }
}
