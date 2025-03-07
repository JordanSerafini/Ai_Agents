import { Injectable, Logger } from '@nestjs/common';

interface PeriodeTemporelle {
  debut: string;
  fin: string;
  precision: 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';
  type: 'DYNAMIQUE' | 'FIXE';
}

@Injectable()
export class TemporalService {
  private readonly logger = new Logger(TemporalService.name);

  /**
   * Extrait les placeholders d'une expression
   */
  extractPlaceholders(expression: string): string[] {
    const regex = /:(\w+)/g;
    const placeholders: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(expression)) !== null) {
      placeholders.push(match[1]);
    }
    return placeholders;
  }

  /**
   * Génère des paramètres temporels à partir des placeholders et des dates
   */
  generateTemporalParameters(
    placeholders: string[],
    dates: { debut: string; fin: string },
  ): Record<string, string> {
    return placeholders.reduce(
      (params: Record<string, string>, placeholder) => {
        if (placeholder.includes('debut')) {
          params[placeholder] = dates.debut;
        } else if (placeholder.includes('fin')) {
          params[placeholder] = dates.fin;
        } else {
          this.logger.warn(`Placeholder non reconnu: ${placeholder}`);
          params[placeholder] = dates.debut; // Valeur par défaut
        }
        return params;
      },
      {},
    );
  }

  /**
   * Calcule les dates dynamiques en fonction de la période spécifiée
   */
  calculerDatesDynamiques(periode: {
    type: 'DYNAMIQUE' | 'FIXE';
    precision: 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';
    reference?: 'PASSÉ' | 'PRESENT' | 'FUTUR';
    debut?: string;
    fin?: string;
  }): { debut: string; fin: string } {
    const aujourdhui = new Date();

    if (periode.type === 'DYNAMIQUE') {
      if (periode.precision === 'SEMAINE') {
        // Calcul pour la semaine prochaine
        const debutSemaine = new Date(aujourdhui);
        debutSemaine.setDate(aujourdhui.getDate() + (8 - aujourdhui.getDay()));

        const finSemaine = new Date(debutSemaine);
        finSemaine.setDate(debutSemaine.getDate() + 6);

        return {
          debut: debutSemaine.toISOString().split('T')[0],
          fin: finSemaine.toISOString().split('T')[0],
        };
      }

      if (periode.precision === 'MOIS') {
        // Calcul pour le mois prochain
        const debutMois = new Date(
          aujourdhui.getFullYear(),
          aujourdhui.getMonth() + 1,
          1,
        );
        const finMois = new Date(
          aujourdhui.getFullYear(),
          aujourdhui.getMonth() + 2,
          0,
        );

        return {
          debut: debutMois.toISOString().split('T')[0],
          fin: finMois.toISOString().split('T')[0],
        };
      }
    }

    // Si période fixe ou autre précision
    return {
      debut: periode.debut || aujourdhui.toISOString().split('T')[0],
      fin: periode.fin || aujourdhui.toISOString().split('T')[0],
    };
  }
}
