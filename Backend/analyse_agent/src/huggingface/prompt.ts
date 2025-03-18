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

  return `<s>[INST] 
Analyse la question suivante: "${question}"

Reformule-la de manière plus précise et détermine l'agent le plus approprié pour y répondre.

Format de ta réponse (respecte exactement ce format):
Question: [répète la question originale]
Question reformulée: [ta reformulation plus précise]
Agent: [choisis entre "querybuilder" ou "workflow"]

"querybuilder" pour: questions sur données, requêtes, statistiques, rapports
"workflow" pour: actions à effectuer, processus métier, tâches administratives
[/INST]

Question: ${question}
Question reformulée: Quel est le montant total cumulé de tous les devis émis depuis le début de l'année courante jusqu'à aujourd'hui?
Agent: querybuilder</s>`;
}
