import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyseSemantiqueResponse,
  AnalyseQueryData,
} from '../../interfaces/analyse.interface';
import { TemporalService } from './temporal.service';

@Injectable()
export class QueryAnalysisService {
  private readonly logger = new Logger(QueryAnalysisService.name);

  constructor(private readonly temporalService: TemporalService) {}

  /**
   * Construit une requête structurée à partir d'une analyse sémantique
   */
  buildStructuredQuery(
    analysisResult: AnalyseSemantiqueResponse,
  ): AnalyseQueryData {
    return {
      tables: analysisResult.structure_requete.tables.map((table) => ({
        nom: table.nom,
        alias: table.alias || table.nom.toLowerCase(),
        type: table.type || 'PRINCIPALE',
        colonnes: Array.isArray(table.colonnes) ? table.colonnes : ['*'],
        condition_jointure:
          table.type === 'JOINTE'
            ? table.condition_jointure ||
              `${table.alias || table.nom.toLowerCase()}.id = principale.${table.nom.toLowerCase()}_id`
            : undefined,
      })),
      conditions: analysisResult.structure_requete.conditions.map((cond) => {
        if (cond.type === 'TEMPOREL') {
          return {
            type: 'TEMPOREL',
            expression:
              'EXTRACT(MONTH FROM i.issue_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM i.issue_date) = EXTRACT(YEAR FROM CURRENT_DATE)',
            parametres: {},
          };
        }
        // S'assurer que tous les paramètres sont extraits de l'expression
        const placeholders = this.temporalService.extractPlaceholders(
          cond.expression,
        );
        const parametres = cond.parametres || {};

        // Remplir les paramètres manquants avec des valeurs par défaut
        placeholders.forEach((placeholder) => {
          if (!parametres[placeholder] && placeholder === 'type') {
            parametres[placeholder] = 'chantier'; // Valeur par défaut pour le type
          }
        });

        return {
          type: 'FILTRE' as const,
          expression: cond.expression,
          parametres: parametres,
        };
      }),
      groupBy: analysisResult.structure_requete.groupements || [],
      orderBy: analysisResult.structure_requete.ordre || [],
      metadata: {
        intention:
          analysisResult.analyse_semantique.intention.action || 'RECHERCHE',
        description:
          analysisResult.analyse_semantique.intention.objectif ||
          'Recherche générale',
      },
    };
  }

  /**
   * Valide la structure d'une analyse sémantique
   */
  validerStructureAnalyse(analyse: AnalyseSemantiqueResponse): boolean {
    if (
      !analyse?.analyse_semantique?.intention?.action ||
      !analyse?.analyse_semantique?.intention?.objectif ||
      !analyse?.analyse_semantique?.temporalite?.periode ||
      !analyse?.analyse_semantique?.entites?.principale ||
      !analyse?.structure_requete?.tables ||
      !Array.isArray(analyse.structure_requete.tables) ||
      analyse.structure_requete.tables.length === 0
    ) {
      return false;
    }

    // Vérification des tables
    return analyse.structure_requete.tables.every(
      (table) =>
        table.nom &&
        table.alias &&
        table.type &&
        Array.isArray(table.colonnes) &&
        table.colonnes.length > 0,
    );
  }
}
