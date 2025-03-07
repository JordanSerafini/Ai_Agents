import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AnalyseRequestDto } from '../../dto/analyse-request.dto';
import { AnalyseResult } from '../../interfaces/analyse.interface';
import { RouterConfigService } from './config.service';
import {
  Metadonnees,
  RouterResponse,
  QueryBuilderResponse,
} from './interfaces';
import {
  AnalyseQueryData,
  QueryBuilderResult,
} from '../../../querybuilder/interfaces/query-builder.types';

@Injectable()
export class QueryBuilderService {
  private readonly logger = new Logger(QueryBuilderService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: RouterConfigService,
  ) {}

  /**
   * Traite une requête pour l'agent QueryBuilder
   */
  async processRequest(
    request: AnalyseRequestDto,
    additionalData?: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      const analyseResult = {
        ...additionalData,
        metadonnees: additionalData?.metadonnees as Metadonnees,
      } as AnalyseResult;

      if (!analyseResult.metadonnees?.tablesIdentifiees) {
        return {
          reponse:
            "Impossible de générer la requête : aucune table identifiée dans l'analyse.",
        };
      }

      // Construire l'objet AnalyseQueryData à partir des métadonnées
      const queryData = this.buildQueryData(analyseResult);

      // Vérifier et désérialiser si nécessaire
      const questionData =
        typeof queryData === 'string' ? JSON.parse(queryData) : queryData;

      // Log détaillé des conditions pour débogage
      this.logConditions(questionData);

      // Options pour la requête
      const options = {
        includeMetadata: true,
        maxResults: 100,
      };

      this.logger.debug(
        `Envoi de la requête au QueryBuilder: ${JSON.stringify(questionData)}`,
      );

      const response = await firstValueFrom(
        this.httpService.post<QueryBuilderResult>(
          `${this.configService.queryBuilderAgentUrl}/querybuilder/build`,
          questionData,
          {
            params: {
              options: JSON.stringify(options),
            },
          },
        ),
      );

      if (response.data.success) {
        return this.formatResponse(response.data);
      }

      return {
        reponse: `Erreur lors de la génération de la requête SQL: ${response.data.error}`,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la communication avec l'agent QueryBuilder: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Construit les données de requête à partir des métadonnées d'analyse
   */
  private buildQueryData(analyseResult: AnalyseResult): AnalyseQueryData {
    return {
      tables: [
        ...analyseResult.metadonnees.tablesIdentifiees.principales.map(
          (table) => ({
            nom: table.nom,
            alias: table.alias || table.nom.charAt(0),
            type: 'PRINCIPALE' as const,
            colonnes: table.colonnes || ['*'],
          }),
        ),
        ...analyseResult.metadonnees.tablesIdentifiees.jointures.map(
          (table) => ({
            nom: table.nom,
            alias: table.alias || table.nom.charAt(0),
            type: 'JOINTE' as const,
            colonnes: table.colonnes || ['*'],
            condition_jointure: table.condition,
          }),
        ),
      ],
      conditions: [
        ...(analyseResult.metadonnees.filtres?.temporels || []).map((filtre) =>
          this.processTemporalFilter(filtre, analyseResult),
        ),
        ...(analyseResult.metadonnees.filtres?.logiques || []).map((filtre) =>
          this.processLogicalFilter(filtre),
        ),
      ],
      metadata: {
        intention: analyseResult.intention || '',
        description: analyseResult.contexte || '',
        champsRequis: analyseResult.metadonnees.champsRequis?.selection,
        parametresRequete: {
          tri: analyseResult.metadonnees.parametresRequete?.tri,
          limite: analyseResult.metadonnees.parametresRequete?.limite,
        },
      },
    };
  }

  /**
   * Traite un filtre temporel
   */
  private processTemporalFilter(filtre: string, analyseResult: AnalyseResult) {
    const periodeTemporelle = analyseResult.metadonnees?.periodeTemporelle;

    // Correction pour PostgreSQL: Remplacer CURDATE() par CURRENT_DATE
    let expression = filtre;
    if (expression.includes('CURDATE()')) {
      expression = expression.replace('CURDATE()', 'CURRENT_DATE');
    }

    // Correction pour PostgreSQL: Corriger la syntaxe des intervalles
    const intervalPatterns = [
      {
        pattern: /INTERVAL (\d+) DAY/g,
        replacement: "INTERVAL '$1 day'",
      },
      {
        pattern: /INTERVAL (\d+) MONTH/g,
        replacement: "INTERVAL '$1 month'",
      },
      {
        pattern: /INTERVAL (\d+) WEEK/g,
        replacement: "INTERVAL '$1 week'",
      },
      {
        pattern: /INTERVAL (\d+) YEAR/g,
        replacement: "INTERVAL '$1 year'",
      },
    ];

    intervalPatterns.forEach(({ pattern, replacement }) => {
      if (pattern.test(expression)) {
        expression = expression.replace(pattern, replacement);
      }
    });

    // Ne pas ajouter de filtre sur event_type si la question concerne les chantiers/projets
    const isProjectQuery =
      analyseResult.contexte?.toLowerCase().includes('chantier') ||
      analyseResult.contexte?.toLowerCase().includes('projet');

    if (
      isProjectQuery &&
      expression.includes("ce.event_type = 'reunion_chantier'")
    ) {
      // Supprimer la condition sur event_type
      expression = expression.replace(
        " AND ce.event_type = 'reunion_chantier'",
        '',
      );
    }

    // Extraire les noms des placeholders de l'expression pour garantir la correspondance
    const placeholderRegex = /:([a-zA-Z0-9_]+)/g;
    const matches = [...expression.matchAll(placeholderRegex)];
    const placeholders = matches.map((match) => match[1]);

    // Créer les paramètres avec les placeholders exacts de l'expression
    const parametres = {};
    if (placeholders.length > 0) {
      if (placeholders.length === 1) {
        // Un seul placeholder, utiliser la même date pour début et fin
        parametres[placeholders[0]] =
          periodeTemporelle?.debut || new Date().toISOString().split('T')[0];
      } else {
        // Deux placeholders ou plus
        parametres[placeholders[0]] =
          periodeTemporelle?.debut || new Date().toISOString().split('T')[0];
        parametres[placeholders[1]] =
          periodeTemporelle?.fin || new Date().toISOString().split('T')[0];
      }
    }

    return {
      type: 'TEMPOREL' as const,
      expression: expression,
      parametres: parametres,
    };
  }

  /**
   * Traite un filtre logique
   */
  private processLogicalFilter(filtre: string) {
    // Extraire les noms des placeholders de l'expression pour garantir la correspondance
    const placeholderRegex = /:([a-zA-Z0-9_]+)/g;
    const matches = [...filtre.matchAll(placeholderRegex)];
    const placeholders = matches.map((match) => match[1]);

    // Créer les paramètres avec des valeurs par défaut
    const parametres = {};
    placeholders.forEach((placeholder) => {
      if (placeholder === 'status') {
        parametres[placeholder] = 'en_cours';
      } else if (placeholder === 'type') {
        parametres[placeholder] = 'chantier';
      } else {
        parametres[placeholder] = 'valeur_par_defaut';
      }
    });

    return {
      type: 'FILTRE' as const,
      expression: filtre,
      parametres: parametres,
    };
  }

  /**
   * Log les conditions pour débogage
   */
  private logConditions(questionData: any): void {
    if (questionData.conditions && questionData.conditions.length > 0) {
      questionData.conditions.forEach((cond, index) => {
        this.logger.debug(`Condition ${index} - Type: ${cond.type}`);
        this.logger.debug(
          `Condition ${index} - Expression: ${cond.expression}`,
        );
        if (cond.parametres) {
          this.logger.debug(
            `Condition ${index} - Paramètres: ${JSON.stringify(cond.parametres)}`,
          );
        }
      });
    }
  }

  /**
   * Formate la réponse de l'agent QueryBuilder
   */
  private formatResponse(data: QueryBuilderResult): RouterResponse {
    // Afficher la requête SQL générée
    let reponse = `Requête SQL générée: ${data.sql}\n\n`;

    // Ajouter l'explication de la requête
    if (data.explanation) {
      reponse += `Explication: ${data.explanation}\n\n`;
    }

    // Ajouter les résultats de la requête s'ils sont disponibles
    if (data.data && data.data.length > 0) {
      reponse += `Résultats (${data.data.length} lignes):\n`;

      // Limiter à 10 résultats pour éviter une réponse trop longue
      const limitedData = data.data.slice(0, 10);

      // Formater les résultats en tableau
      try {
        // Extraire les noms des colonnes du premier résultat
        const columns = Object.keys(limitedData[0]);

        // Ajouter les en-têtes des colonnes
        reponse += columns.join(' | ') + '\n';
        reponse += columns.map(() => '---').join(' | ') + '\n';

        // Ajouter les données
        limitedData.forEach((row) => {
          reponse +=
            columns
              .map((col) => {
                const value = row[col];
                if (value === null || value === undefined) return 'NULL';
                if (typeof value === 'object') return JSON.stringify(value);
                return String(value);
              })
              .join(' | ') + '\n';
        });

        // Indiquer s'il y a plus de résultats
        if (data.data.length > 10) {
          reponse += `\n... et ${data.data.length - 10} autres résultats.`;
        }
      } catch (error) {
        // En cas d'erreur de formatage, afficher les données brutes
        reponse += JSON.stringify(limitedData, null, 2);
      }
    } else if (data.data) {
      reponse += 'Aucun résultat trouvé.';
    }

    return { reponse };
  }
}
