import { Injectable, Logger } from '@nestjs/common';

interface StaffEvent {
  id: number;
  firstname: string;
  lastname: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string;
}

@Injectable()
export class FormatterService {
  private readonly logger = new Logger(FormatterService.name);

  /**
   * Formate la réponse pour les requêtes de disponibilité
   */
  formaterReponseDisponibilite(resultats: StaffEvent[]): string {
    // Regrouper par employé
    const employes = new Map<
      number,
      {
        nom: string;
        evenements: Array<{
          titre: string;
          debut: Date;
          fin: Date;
          lieu: string;
        }>;
      }
    >();

    resultats.forEach((r: StaffEvent) => {
      if (!employes.has(r.id)) {
        employes.set(r.id, {
          nom: `${r.firstname} ${r.lastname}`,
          evenements: [],
        });
      }

      if (r.title) {
        const employe = employes.get(r.id);
        if (employe) {
          employe.evenements.push({
            titre: r.title,
            debut: new Date(r.start_date),
            fin: new Date(r.end_date),
            lieu: r.location,
          });
        }
      }
    });

    // Construire la réponse
    const dateDebut = new Date(resultats[0]?.start_date);
    const dateFin = new Date(resultats[0]?.end_date);
    const semaine = dateDebut
      ? `du ${dateDebut.toLocaleDateString('fr-FR')} au ${dateFin.toLocaleDateString('fr-FR')}`
      : 'la semaine prochaine';

    let reponse = `Pour ${semaine}, voici la situation :\n\n`;

    employes.forEach((employe) => {
      reponse += `${employe.nom} :\n`;
      if (employe.evenements.length > 0) {
        reponse += 'Événements prévus :\n';
        employe.evenements.forEach((evt) => {
          const heureDebut = evt.debut.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const heureFin = evt.fin.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const date = evt.debut.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });
          reponse += `- ${date} de ${heureDebut} à ${heureFin} : ${evt.titre} à ${evt.lieu}\n`;
        });
      } else {
        reponse += 'Entièrement disponible\n';
      }
      reponse += '\n';
    });

    return reponse;
  }
} 