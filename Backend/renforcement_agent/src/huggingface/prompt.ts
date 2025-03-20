import { getSchemaForPrompt } from './bdd';

export type Service = 'querybuilder' | 'elasticsearch' | 'workflow';

/**
 * Génère un prompt pour évaluer la pertinence d'une question utilisateur stockée dans RAG
 */
export function getPromptEvaluationPrompt(question: string): string {
  return `
Tu es un assistant expert en évaluation de prompts pour un système RAG (Retrieval-Augmented Generation) dans le secteur du BTP.

Voici un prompt utilisateur stocké dans notre base de connaissances :
"""
${question}
"""

Évalue ce prompt selon les critères suivants (note de 1 à 5) :

1. PERTINENCE (1-5) : Dans quelle mesure ce prompt est pertinent pour une entreprise de BTP ?
   - 5: Parfaitement pertinent, concerne directement l'activité BTP
   - 3: Modérément pertinent, lien indirect avec le BTP
   - 1: Non pertinent, hors sujet pour le secteur BTP

2. CLARTÉ (1-5) : Le prompt est-il clair et bien formulé ?
   - 5: Parfaitement clair, question précise et complète
   - 3: Modérément clair, quelques ambiguïtés
   - 1: Très confus ou incomplet

3. FAISABILITÉ (1-5) : Est-il possible de répondre à ce prompt avec les données disponibles en BTP ?
   - 5: Totalement faisable, les données sont certainement disponibles
   - 3: Partiellement faisable, certaines données pourraient manquer
   - 1: Infaisable, demande des données qui n'existent pas dans un système BTP

Retourne UNIQUEMENT ta réponse au format JSON :
{
  "pertinence": [note de 1-5],
  "clarté": [note de 1-5],
  "faisabilité": [note de 1-5],
  "score_global": [moyenne des 3 notes],
  "analyse": "[brève analyse de 1-2 phrases]",
  "suggestion_amélioration": "[suggestion spécifique pour améliorer ce prompt]"
}
`;
}

/**
 * Génère un prompt pour évaluer la pertinence d'une requête SQL stockée dans RAG
 */
export function getSqlEvaluationPrompt(
  sqlQuery: string,
  originalQuestion: string,
): string {
  return `
Tu es un expert SQL spécialisé dans l'évaluation de requêtes pour une entreprise de BTP.

Question utilisateur originale :
"""
${originalQuestion}
"""

Voici la structure de la base de données, cest très important de bien la prendre en compte et de verifier l'exactitude des tables et des champs :
"""
${getSchemaForPrompt()}
"""

Requête SQL générée et stockée dans notre base de connaissances :
"""
${sqlQuery}
"""

Évalue cette requête SQL selon les critères suivants (note de 1 à 5) :

1. PRÉCISION (1-5) : La requête SQL répond-elle exactement à la question posée ?
   - 5: Parfaitement adaptée, répond exactement à la question
   - 3: Partiellement adaptée, répond à une partie de la question
   - 1: Inadaptée, ne répond pas à la question

2. QUALITÉ TECHNIQUE (1-5) : La requête est-elle techniquement correcte et optimisée ?
   - 5: Parfaite, syntaxe correcte et requête optimisée
   - 3: Acceptable, syntaxe correcte mais pourrait être optimisée
   - 1: Problématique, erreurs de syntaxe ou très inefficace

3. COMPLÉTUDE (1-5) : La requête récupère-t-elle toutes les données nécessaires ?
   - 5: Complète, récupère toutes les données nécessaires
   - 3: Partielle, manque quelques données secondaires
   - 1: Incomplète, manque des données essentielles

Retourne UNIQUEMENT ta réponse au format JSON :
{
  "précision": [note de 1-5],
  "qualité_technique": [note de 1-5],
  "complétude": [note de 1-5],
  "score_global": [moyenne des 3 notes],
  "analyse": "[brève analyse de 1-2 phrases]",
  "suggestion_amélioration": "[suggestion spécifique pour améliorer cette requête]"
}
`;
}

/**
 * Génère un prompt pour corriger et améliorer une question utilisateur
 */
export function getPromptImprovementPrompt(
  question: string,
  evaluation: any,
): string {
  return `
Tu es un expert en formulation de prompts pour un système d'information BTP.

Voici un prompt utilisateur qui nécessite une amélioration :
"""
${question}
"""

Évaluation actuelle de ce prompt :
- Pertinence: ${evaluation.pertinence}/5
- Clarté: ${evaluation.clarté}/5
- Faisabilité: ${evaluation.faisabilité}/5
- Score global: ${evaluation.score_global}/5
- Analyse: "${evaluation.analyse}"

Ta mission est de reformuler ce prompt pour le rendre plus clair, plus pertinent et plus précis pour notre contexte BTP. 
Pour les scores inférieurs à 3, concentre-toi particulièrement sur l'amélioration de ces aspects.

Retourne UNIQUEMENT le prompt amélioré, sans autre explication.
`;
}

/**
 * Génère un prompt pour corriger et améliorer une requête SQL
 */
export function getSqlImprovementPrompt(
  sqlQuery: string,
  originalQuestion: string,
  evaluation: any,
): string {
  return `
Tu es un expert SQL spécialisé dans l'optimisation de requêtes pour une base de données BTP.

Question utilisateur :
"""
${originalQuestion}
"""

Requête SQL actuelle :
"""
${sqlQuery}
"""

Évaluation de cette requête :
- Précision: ${evaluation.précision}/5
- Qualité technique: ${evaluation.qualité_technique}/5 
- Complétude: ${evaluation.complétude}/5
- Score global: ${evaluation.score_global}/5
- Analyse: "${evaluation.analyse}"

Ta mission est de corriger et améliorer cette requête SQL pour :
1. Répondre plus précisément à la question utilisateur
2. Améliorer la qualité technique (syntaxe, performance)
3. Garantir la complétude des données retournées

Concentre-toi particulièrement sur les critères ayant reçu des scores inférieurs à 3.

Retourne UNIQUEMENT la requête SQL améliorée, sans autre explication ni commentaire.
`;
}

/**
 * Génère un prompt pour l'analyse globale des collections RAG
 */
export function getRagAnalysisPrompt(stats: any): string {
  return `
Tu es un expert en analyse de données RAG (Retrieval-Augmented Generation) pour un système BTP.

Voici les statistiques actuelles de nos collections RAG :

Collection "user_prompts" (questions utilisateurs) :
- Nombre total de documents : ${stats.user_prompts.totalDocuments}
- Score moyen de qualité : ${stats.user_prompts.averageRating}/5
- Documents de faible qualité (score < 3) : ${stats.user_prompts.lowQualityDocuments}
- Documents de haute qualité (score ≥ 4) : ${stats.user_prompts.highQualityDocuments}

Collection "sql_queries" (requêtes SQL) :
- Nombre total de documents : ${stats.sql_queries.totalDocuments}
- Score moyen de qualité : ${stats.sql_queries.averageRating}/5
- Documents de faible qualité (score < 3) : ${stats.sql_queries.lowQualityDocuments}
- Documents de haute qualité (score ≥ 4) : ${stats.sql_queries.highQualityDocuments}

Analyse ces statistiques et fournis :
1. Un résumé de l'état actuel de la qualité des données dans ces collections
2. Les points forts et points faibles identifiés
3. Des recommandations concrètes pour améliorer la qualité globale
4. Une stratégie pour traiter en priorité les documents de faible qualité

Retourne ta réponse au format JSON :
{
  "état_actuel": "[résumé concis de l'état actuel]",
  "points_forts": ["point fort 1", "point fort 2", ...],
  "points_faibles": ["point faible 1", "point faible 2", ...],
  "recommandations": ["recommandation 1", "recommandation 2", ...],
  "stratégie_prioritaire": "[stratégie pour traiter les documents faibles]"
}
`;
}

/**
 * Génère un prompt pour le rapport de validation complet
 */
export function getValidationReportPrompt(
  userPromptsEvaluations: any[],
  sqlQueriesEvaluations: any[],
): string {
  const userPromptsExamples = userPromptsEvaluations
    .slice(0, 3)
    .map(
      (item) =>
        `- "${item.content.substring(0, 50)}..." (Score: ${item.rating.overall}/5, Feedback: "${item.rating.feedback}")`,
    )
    .join('\n');

  const sqlQueriesExamples = sqlQueriesEvaluations
    .slice(0, 3)
    .map(
      (item) =>
        `- "${item.content.substring(0, 50)}..." (Score: ${item.rating.overall}/5, Feedback: "${item.rating.feedback}")`,
    )
    .join('\n');

  return `
Tu es un expert en qualité des données pour un système RAG (Retrieval-Augmented Generation) dans le secteur BTP.

Je te demande de générer un rapport de validation complet sur l'état actuel de nos collections de données :

RÉSUMÉ DES ÉVALUATIONS :

Collection "user_prompts" :
- Documents évalués : ${userPromptsEvaluations.length}
- Score moyen : ${
    userPromptsEvaluations.reduce((sum, item) => sum + item.rating.overall, 0) /
      userPromptsEvaluations.length || 0
  }/5
- Exemples :
${userPromptsExamples}

Collection "sql_queries" :
- Documents évalués : ${sqlQueriesEvaluations.length}
- Score moyen : ${
    sqlQueriesEvaluations.reduce((sum, item) => sum + item.rating.overall, 0) /
      sqlQueriesEvaluations.length || 0
  }/5
- Exemples :
${sqlQueriesExamples}

Génère un rapport de validation structuré qui comprend :
1. Un résumé exécutif de l'état des collections
2. Une analyse détaillée des forces et faiblesses identifiées
3. Des recommandations spécifiques pour améliorer la qualité des données
4. Un plan d'action priorisé pour implémenter ces améliorations

Retourne ta réponse au format JSON :
{
  "résumé_exécutif": "[résumé concis de 3-4 phrases]",
  "analyse": {
    "forces": ["force 1", "force 2", ...],
    "faiblesses": ["faiblesse 1", "faiblesse 2", ...]
  },
  "recommandations": [
    {
      "problème": "[description du problème]",
      "solution": "[solution proposée]",
      "impact": "[impact attendu]"
    },
    ...
  ],
  "plan_action": [
    {
      "priorité": "[haute/moyenne/basse]",
      "action": "[action à entreprendre]",
      "ressources": "[ressources nécessaires]",
      "délai": "[délai recommandé]"
    },
    ...
  ]
}
`;
}

/**
 * Génère un prompt pour comparer un prompt utilisateur et la requête SQL générée
 */
export function getPromptSqlComparisonPrompt(
  userPrompt: string,
  sqlQuery: string,
): string {
  return `
Tu es un expert en évaluation de la cohérence entre les questions utilisateurs et les requêtes SQL générées pour une entreprise BTP.

Question utilisateur :
"""
${userPrompt}
"""

Requête SQL générée :
"""
${sqlQuery}
"""

Évalue la correspondance entre cette question et cette requête SQL selon les critères suivants :

1. CORRESPONDANCE FONCTIONNELLE (1-5) : La requête SQL répond-elle à l'intention de la question ?
   - 5: Correspondance parfaite, la requête répond exactement à l'intention
   - 3: Correspondance partielle, la requête répond à une partie de l'intention
   - 1: Pas de correspondance, la requête ne répond pas à l'intention

2. COUVERTURE DES ENTITÉS (1-5) : La requête SQL inclut-elle toutes les entités mentionnées dans la question ?
   - 5: Couverture complète, toutes les entités sont incluses
   - 3: Couverture partielle, certaines entités secondaires manquent
   - 1: Couverture insuffisante, des entités essentielles manquent

3. PRÉCISION DES FILTRES (1-5) : Les filtres/conditions de la requête correspondent-ils aux contraintes de la question ?
   - 5: Filtres parfaitement alignés avec la question
   - 3: Filtres partiellement alignés, certaines conditions manquantes
   - 1: Filtres inadéquats ou manquants

Retourne UNIQUEMENT ta réponse au format JSON :
{
  "correspondance_fonctionnelle": [note de 1-5],
  "couverture_entités": [note de 1-5],
  "précision_filtres": [note de 1-5],
  "score_global": [moyenne des 3 notes],
  "analyse": "[brève analyse de la correspondance]",
  "suggestion": "[suggestion pour améliorer l'alignement]"
}
`;
}
