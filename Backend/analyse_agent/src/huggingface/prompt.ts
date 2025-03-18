/**
 * Liste des services disponibles pour le traitement des questions
 */
export const SERVICES = ['querybuilder', 'workflow'] as const;
export type Service = (typeof SERVICES)[number];

/**
 * Génère un prompt pour l'analyse des questions
 * @param question - La question à analyser
 * @returns Le prompt formaté pour l'analyse
 * @throws Error si la question est vide
 */
export function getAnalysisPrompt(question: string): string {
  if (!question || question.trim().length === 0) {
    throw new Error('La question ne peut pas être vide');
  }

  return `<s>[INST] ${question}
  Tu es un assistant chatbot ia qui répond à des questions sur la société.
  Tu réponds uniquement en français.
  Tu dois comprendre et reformuler si besoin la question pour qu'elle soit plus précise et plus facile à traiter par les autres services.
  Tu dois retourner la question, la question reformulée et choisir l'agent qui doit traiter la question.
  Tu dois retourner la réponse sous le format suivant :
  Question: [question]
  Question reformulée: [question reformulée]
  Agent: [agent qui doit traiter la question]

  Voici les agents disponibles ${SERVICES.join(', ')} :
  - querybuilder: agent qui répond à des questions sur les données de la base de données.
  - workflow: agent qui fais différentes tâches en fonction de la question.
  </s>`;
}
