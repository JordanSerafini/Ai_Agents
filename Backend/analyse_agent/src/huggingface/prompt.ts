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

  return `<s>[INST] ${question} [/INST]
Je suis un assistant spécialisé dans l'analyse de questions d'entreprise.

Voici mon analyse de ta question :

Question: ${question}
Question reformulée: [Je vais reformuler ta question pour la rendre plus précise]

Pour déterminer l'agent approprié, je dois choisir entre :
- querybuilder: pour les questions liées aux données, statistiques, montants, rapports financiers
- workflow: pour les actions à effectuer, processus métier, ou tâches spécifiques

Basé sur ta question, je choisis:
Agent: querybuilder

Ma réponse respecte exactement ce format:
Question: [question originale]
Question reformulée: [question reformulée plus précise]
Agent: [nom de l'agent choisi, soit "querybuilder" soit "workflow"]</s>`;
}
