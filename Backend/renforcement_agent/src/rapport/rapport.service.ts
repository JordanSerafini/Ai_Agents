import { Injectable, Logger } from '@nestjs/common';
import { RagRating } from '../RAG/rag.service';
import * as fs from 'fs/promises';
import * as path from 'path';

// Exporter l'interface pour qu'elle soit accessible aux autres modules
export interface RapportEvaluation {
  id: string;
  timestamp: string;
  collection: string;
  totalDocuments: number;
  evaluatedDocuments: number;
  averageRating: number;
  documentRatings: Array<{
    id: string;
    rating: RagRating;
  }>;
  summary: string;
}

@Injectable()
export class RapportService {
  private readonly logger = new Logger(RapportService.name);
  private readonly rapportsDir = '/app/data/persistence/rapports';

  constructor() {
    // Appeler la méthode async avec void pour éviter l'erreur de promise non gérée
    void this.initRapportsDirectory();
  }

  /**
   * Initialise le répertoire des rapports
   */
  private async initRapportsDirectory() {
    try {
      await fs.mkdir(this.rapportsDir, { recursive: true });
      this.logger.log(
        `Répertoire des rapports initialisé: ${this.rapportsDir}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation du répertoire des rapports: ${error.message}`,
      );
    }
  }

  /**
   * Génère et enregistre un rapport d'évaluation
   * @param collection Nom de la collection évaluée
   * @param result Résultat de l'évaluation
   * @returns ID du rapport généré
   */
  async generateRapport(
    collection: string,
    result: {
      totalDocuments: number;
      evaluatedDocuments: number;
      averageRating: number;
      documentRatings: Array<{ id: string; rating: RagRating }>;
    },
  ): Promise<string> {
    try {
      const timestamp = new Date().toISOString();
      const rapportId = `rapport-${collection}-${timestamp.replace(/[:.]/g, '-')}`;

      // Générer un résumé du rapport
      const summary = this.generateSummary(collection, result);

      // Créer l'objet rapport
      const rapport: RapportEvaluation = {
        id: rapportId,
        timestamp,
        collection,
        totalDocuments: result.totalDocuments,
        evaluatedDocuments: result.evaluatedDocuments,
        averageRating: result.averageRating,
        documentRatings: result.documentRatings,
        summary,
      };

      // Enregistrer le rapport au format JSON
      const rapportPath = path.join(this.rapportsDir, `${rapportId}.json`);
      await fs.writeFile(rapportPath, JSON.stringify(rapport, null, 2), 'utf8');

      // Générer également une version texte pour faciliter la lecture
      const textRapportPath = path.join(this.rapportsDir, `${rapportId}.txt`);
      await fs.writeFile(
        textRapportPath,
        this.generateTextRapport(rapport),
        'utf8',
      );

      this.logger.log(`Rapport d'évaluation ${rapportId} généré et enregistré`);

      return rapportId;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération du rapport: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Génère un résumé du rapport d'évaluation
   * @param collection Nom de la collection
   * @param result Résultat de l'évaluation
   * @returns Résumé textuel de l'évaluation
   */
  private generateSummary(
    collection: string,
    result: {
      totalDocuments: number;
      evaluatedDocuments: number;
      averageRating: number;
      documentRatings: Array<{ id: string; rating: RagRating }>;
    },
  ): string {
    // Calculer des statistiques supplémentaires
    const highQualityDocs = result.documentRatings.filter(
      (doc) => doc.rating.overall >= 4,
    ).length;
    const mediumQualityDocs = result.documentRatings.filter(
      (doc) => doc.rating.overall >= 3 && doc.rating.overall < 4,
    ).length;
    const lowQualityDocs = result.documentRatings.filter(
      (doc) => doc.rating.overall < 3,
    ).length;

    const relevanceAvg =
      result.documentRatings.reduce(
        (sum, doc) => sum + doc.rating.relevance,
        0,
      ) / (result.documentRatings.length || 1);
    const qualityAvg =
      result.documentRatings.reduce((sum, doc) => sum + doc.rating.quality, 0) /
      (result.documentRatings.length || 1);
    const completenessAvg =
      result.documentRatings.reduce(
        (sum, doc) => sum + doc.rating.completeness,
        0,
      ) / (result.documentRatings.length || 1);

    return `
Rapport d'évaluation RAG pour la collection "${collection}"
Date: ${new Date().toLocaleString()}

RÉSUMÉ DE L'ÉVALUATION:
- Documents évalués: ${result.evaluatedDocuments}/${result.totalDocuments} (${Math.round((result.evaluatedDocuments / result.totalDocuments) * 100)}%)
- Note moyenne globale: ${result.averageRating.toFixed(2)}/5

RÉPARTITION DES NOTES:
- Documents de haute qualité (≥4/5): ${highQualityDocs} (${Math.round((highQualityDocs / result.evaluatedDocuments) * 100)}%)
- Documents de qualité moyenne (3-4/5): ${mediumQualityDocs} (${Math.round((mediumQualityDocs / result.evaluatedDocuments) * 100)}%)
- Documents de faible qualité (<3/5): ${lowQualityDocs} (${Math.round((lowQualityDocs / result.evaluatedDocuments) * 100)}%)

SCORES MOYENS PAR CRITÈRE:
- Pertinence: ${relevanceAvg.toFixed(2)}/5
- Qualité: ${qualityAvg.toFixed(2)}/5
- Complétude: ${completenessAvg.toFixed(2)}/5

CONCLUSIONS:
${this.generateConclusions(result.averageRating, relevanceAvg, qualityAvg, completenessAvg)}
    `;
  }

  /**
   * Génère des conclusions basées sur les scores
   */
  private generateConclusions(
    overallAvg: number,
    relevanceAvg: number,
    qualityAvg: number,
    completenessAvg: number,
  ): string {
    // Initialiser le tableau de conclusions avec le bon type
    const conclusions: string[] = [];

    // Évaluation générale
    if (overallAvg >= 4) {
      conclusions.push('La qualité globale de la collection est excellente.');
    } else if (overallAvg >= 3) {
      conclusions.push(
        'La qualité globale de la collection est satisfaisante mais peut être améliorée.',
      );
    } else {
      conclusions.push(
        'La qualité globale de la collection est insuffisante et nécessite une attention particulière.',
      );
    }

    // Analyse par critère
    const lowestScore = Math.min(relevanceAvg, qualityAvg, completenessAvg);

    if (lowestScore === relevanceAvg && relevanceAvg < 3.5) {
      conclusions.push(
        'La pertinence des documents est le point faible principal. Envisagez de revoir les critères de sélection des documents.',
      );
    }

    if (lowestScore === qualityAvg && qualityAvg < 3.5) {
      conclusions.push(
        "La qualité factuelle des documents est à améliorer. Vérifiez l'exactitude des informations.",
      );
    }

    if (lowestScore === completenessAvg && completenessAvg < 3.5) {
      conclusions.push(
        'La complétude des documents est insuffisante. Enrichissez les documents avec plus de détails.',
      );
    }

    // Recommandations générales
    conclusions.push(
      'Recommandations: ' +
        (overallAvg < 3.5
          ? 'Une révision systématique de la collection est conseillée.'
          : "Concentrez les efforts d'amélioration sur les documents de faible qualité identifiés."),
    );

    return conclusions.join('\n');
  }

  /**
   * Génère une version texte du rapport complet
   * @param rapport Objet rapport
   * @returns Version texte du rapport
   */
  private generateTextRapport(rapport: RapportEvaluation): string {
    const header = `
==============================================================
RAPPORT D'ÉVALUATION RAG DÉTAILLÉ
==============================================================
ID du rapport: ${rapport.id}
Date: ${new Date(rapport.timestamp).toLocaleString()}
Collection: ${rapport.collection}
==============================================================

${rapport.summary}

==============================================================
DÉTAIL DES ÉVALUATIONS PAR DOCUMENT
==============================================================
`;

    const documentsDetail = rapport.documentRatings
      .sort((a, b) => b.rating.overall - a.rating.overall)
      .map((docRating, index) => {
        const detailedEval = docRating.rating.detailedEvaluation;

        let details = `
DOCUMENT #${index + 1} (ID: ${docRating.id})
Score global: ${docRating.rating.overall}/5
- Pertinence: ${docRating.rating.relevance}/5
- Qualité: ${docRating.rating.quality}/5
- Complétude: ${docRating.rating.completeness}/5

`;

        if (detailedEval) {
          details += `ÉVALUATION DÉTAILLÉE:
${docRating.rating.feedback}

`;
        }

        return details;
      })
      .join('--------------------------------------------------------------\n');

    return header + documentsDetail;
  }

  /**
   * Récupère un rapport par son ID
   * @param rapportId ID du rapport
   * @returns Rapport d'évaluation
   */
  async getRapport(rapportId: string): Promise<RapportEvaluation> {
    try {
      const rapportPath = path.join(this.rapportsDir, `${rapportId}.json`);
      const content = await fs.readFile(rapportPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du rapport ${rapportId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Récupère la liste des rapports disponibles
   * @returns Liste des rapports
   */
  async getAllRapports(): Promise<
    Array<{ id: string; timestamp: string; collection: string }>
  > {
    try {
      const files = await fs.readdir(this.rapportsDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      // Déclarer un tableau correctement typé
      const rapports: Array<{
        id: string;
        timestamp: string;
        collection: string;
      }> = [];

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(
            path.join(this.rapportsDir, file),
            'utf8',
          );
          const rapport = JSON.parse(content);
          rapports.push({
            id: rapport.id,
            timestamp: rapport.timestamp,
            collection: rapport.collection,
          });
        } catch (error) {
          this.logger.warn(
            `Impossible de lire le rapport ${file}: ${error.message}`,
          );
        }
      }

      return rapports.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des rapports: ${error.message}`,
      );
      return [];
    }
  }
}
