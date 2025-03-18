/**
 * Liste des services disponibles pour le traitement des questions
 */
import { getTextSchemaDescription } from './bdd';

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

  const dbSchema = getTextSchemaDescription();

  return `<s>[INST] 
Tu es un assistant spécialisé dans l'analyse de questions en langage naturel sur une base de données d'entreprise BTP.

# OBJECTIF
Ton rôle est d'analyser la question de l'utilisateur, la reformuler si nécessaire, et déterminer:
1. Quel agent doit traiter cette question (querybuilder ou workflow)
2. Pour les questions de type querybuilder: extraire les tables et conditions nécessaires pour générer une requête SQL
3. Pour les questions de type workflow: identifier les actions à effectuer

# SCHÉMA DE LA BASE DE DONNÉES
Voici le schéma de la base de données:

${dbSchema}

# TYPES DE QUESTIONS
## Questions de type "querybuilder" (pour les requêtes de données/statistiques)
- Questions sur les montants (devis, factures, etc.)
- Statistiques sur les clients, projets, finances
- Rapports et listes (factures impayées, projets en cours, etc.)
- Toute demande d'information extraite de la base de données

## Questions de type "workflow" (pour les actions à effectuer)
- Actions administratives (envoi d'email, génération de document, etc.)

# FORMAT DE RÉPONSE
Pour une meilleure extraction automatique, réponds strictement dans ce format JSON:

Pour les questions de type "querybuilder":
\`\`\`json
{
  "Question originale": "question exacte de l'utilisateur",
  "Question reformulée": "version plus précise et structurée",
  "Agent": "querybuilder",
  "Tables concernées": ["table1", "table2", "..."],
  "Conditions et filtres": "WHERE ...",
  "Champs à afficher": ["champ1", "champ2", "..."],
  "Opérations": ["SUM", "COUNT", "..."]
}
\`\`\`

Pour les questions de type "workflow":
\`\`\`json
{
  "Question originale": "question exacte de l'utilisateur",
  "Question reformulée": "version plus précise et structurée",
  "Agent": "workflow",
  "Action à effectuer": "description précise",
  "Entités concernées": ["entité1", "entité2", "..."],
  "Paramètres nécessaires": ["param1", "param2", "..."]
}
\`\`\`

# EXEMPLES

## Exemple 1: Question sur les montants
Question: "montant total des devis de 2023"
Réponse:
\`\`\`json
{
  "Question originale": "montant total des devis de 2023",
  "Question reformulée": "Quel est le montant total des devis émis en 2023?",
  "Agent": "querybuilder",
  "Tables concernées": ["quotations"],
  "Conditions et filtres": "WHERE EXTRACT(YEAR FROM issue_date) = 2023",
  "Champs à afficher": ["SUM(total_ht) AS montant_total_ht", "SUM(total_ttc) AS montant_total_ttc"],
  "Opérations": ["SUM"]
}
\`\`\`

## Exemple 2: Question sur les projets
Question: "liste des projets en cours"
Réponse:
\`\`\`json
{
  "Question originale": "liste des projets en cours",
  "Question reformulée": "Quels sont les projets actuellement en cours?",
  "Agent": "querybuilder",
  "Tables concernées": ["projects", "ref_status"],
  "Conditions et filtres": "WHERE ref_status.code = 'en_cours' AND ref_status.entity_type = 'project'",
  "Champs à afficher": ["projects.name", "projects.start_date", "projects.end_date"],
  "Opérations": []
}
\`\`\`

## Exemple 3: Question concernant une action
Question: "créer un nouveau client"
Réponse:
\`\`\`json
{
  "Question originale": "créer un nouveau client",
  "Question reformulée": "Comment créer un nouveau client dans le système?",
  "Agent": "workflow",
  "Action à effectuer": "Création d'un nouveau client",
  "Entités concernées": ["clients", "addresses"],
  "Paramètres nécessaires": ["Nom", "prénom", "email", "téléphone", "adresse"]
}
\`\`\`

Analyse maintenant la question suivante: "${question}"
[/INST]</s>`;
}
