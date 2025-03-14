export const analysePrompt = (question: string) => `
Analyse cette question en français et fournis une réponse structurée au format JSON.
Question: "${question}"

CONTEXTE:
Tu es un expert en analyse de langage naturel pour une entreprise de bâtiment. Tu dois analyser les questions des utilisateurs pour les diriger vers le bon service et extraire les informations pertinentes.

RÈGLES D'ANALYSE:
1. Questions sur le PERSONNEL et PLANNING:
   - Catégorie: DATABASE
   - Agent: QUERYBUILDER
   - Tables principales: 
     * staff (id, name, role, department)
     * timesheet_entries (staff_id, date, start_time, end_time, status)
     * calendar_events (staff_id, event_date, type, description)
   - Extraire: périodes, dates, noms, rôles, départements

2. Questions sur les PROJETS et CLIENTS:
   - Catégorie: DATABASE
   - Agent: QUERYBUILDER
   - Tables principales:
     * projects (id, name, status, start_date, end_date, client_id, budget)
     * clients (id, name, contact_info)
     * project_staff (project_id, staff_id, role)
   - Extraire: noms, dates, statuts, montants, responsables

3. Questions sur les DOCUMENTS:
   - Catégorie: SEARCH
   - Agent: ELASTICSEARCH
   - Types de documents: devis, factures, plans, contrats
   - Extraire: types de documents, dates, projets associés, mots-clés

4. Questions TECHNIQUES:
   - Catégorie: KNOWLEDGE
   - Agent: RAG
   - Domaines: construction, sécurité, normes, procédures
   - Extraire: termes techniques, références normatives

INSTRUCTIONS DE REFORMULATION:
1. Corriger les fautes d'orthographe et la grammaire
2. Structurer la question pour optimisation SQL
3. Standardiser les références temporelles (aujourd'hui, demain, semaine prochaine)
4. Identifier les relations entre entités
5. Détecter les conditions implicites

EXPRESSIONS TEMPORELLES À STANDARDISER:
- "aujourd'hui" -> CURRENT_DATE
- "demain" -> CURRENT_DATE + 1
- "cette semaine" -> CURRENT_WEEK
- "semaine prochaine" -> NEXT_WEEK
- "ce mois" -> CURRENT_MONTH
- "mois prochain" -> NEXT_MONTH
- "cette année" -> CURRENT_YEAR

Format de réponse JSON attendu:
{
  "demandeId": "timestamp_uuid",
  "categorie": "DATABASE|SEARCH|KNOWLEDGE",
  "agent": "QUERYBUILDER|ELASTICSEARCH|RAG",
  "intentionPrincipale": {
    "nom": "action_precise",
    "confiance": 0.0-1.0,
    "description": "description détaillée",
    "type": "LECTURE|ECRITURE|MODIFICATION|SUPPRESSION"
  },
  "sousIntentions": [{
    "nom": "sous_action",
    "description": "description",
    "confiance": 0.0-1.0,
    "dependances": ["intention1", "intention2"]
  }],
  "entites": {
    "principales": ["entité1", "entité2"],
    "secondaires": ["entité3", "entité4"],
    "relations": ["relation1", "relation2"]
  },
  "niveauUrgence": "URGENT|NORMAL|BASSE",
  "contraintes": {
    "temporelles": ["contrainte1", "contrainte2"],
    "spatiales": ["contrainte3", "contrainte4"],
    "logiques": ["contrainte5", "contrainte6"]
  },
  "contexte": {
    "general": "contexte général",
    "specifique": "contexte spécifique",
    "utilisateur": "contexte utilisateur"
  },
  "questionCorrigee": "question reformulée",
  "metadonnees": {
    "tablesIdentifiees": {
      "principales": ["table1"],
      "jointures": ["table2", "table3"],
      "conditions": ["condition1", "condition2"]
    },
    "champsRequis": {
      "selection": ["champ1", "champ2"],
      "filtres": ["champ3", "champ4"],
      "groupement": ["champ5"]
    },
    "filtres": {
      "temporels": ["filtre1", "filtre2"],
      "logiques": ["filtre3", "filtre4"]
    },
    "periodeTemporelle": {
      "debut": "YYYY-MM-DD",
      "fin": "YYYY-MM-DD",
      "precision": "JOUR|SEMAINE|MOIS"
    },
    "parametresRequete": {
      "tri": ["param1", "param2"],
      "limite": "nombre",
      "offset": "nombre"
    }
  },
  "formatReponse": {
    "type": "PLANNING_HEBDOMADAIRE",
    "groupement": "PAR_JOUR",
    "details": [
      "nom_employe",
      "horaires",
      "status"
    ],
    "style": "LISTE_STRUCTUREE"
  }
}

Exemple pour une question sur le personnel:
{
  "demandeId": "${Date.now()}",
  "categorie": "DATABASE",
  "agent": "QUERYBUILDER",
  "intentionPrincipale": {
    "nom": "consulter_disponibilite_personnel",
    "confiance": 0.95,
    "description": "Recherche du personnel disponible pour travailler la semaine prochaine",
    "type": "LECTURE"
  },
  "sousIntentions": [
    {
      "nom": "filtrer_par_periode",
      "description": "Filtrer les résultats pour la semaine prochaine",
      "confiance": 0.9,
      "dependances": []
    },
    {
      "nom": "verifier_disponibilite",
      "description": "Vérifier les créneaux de disponibilité",
      "confiance": 0.85,
      "dependances": ["filtrer_par_periode"]
    }
  ],
  "entites": {
    "principales": ["personnel", "disponibilite"],
    "secondaires": ["horaires"],
    "relations": ["personnel_disponibilite"]
  },
  "niveauUrgence": "NORMAL",
  "contraintes": {
    "temporelles": ["periode: semaine_prochaine"],
    "spatiales": [],
    "logiques": ["status: CONFIRMED"]
  },
  "contexte": {
    "general": "Planification des ressources humaines",
    "specifique": "Disponibilité hebdomadaire",
    "utilisateur": "Gestionnaire planning"
  },
  "questionCorrigee": "Identifier le personnel disponible et leurs horaires de travail pour la semaine du ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}",
  "metadonnees": {
    "tablesIdentifiees": {
      "principales": ["staff"],
      "jointures": ["timesheet_entries"],
      "conditions": ["staff.id = timesheet_entries.staff_id"]
    },
    "champsRequis": {
      "selection": [
        "staff.id",
        "staff.name",
        "timesheet_entries.date",
        "timesheet_entries.start_time",
        "timesheet_entries.end_time",
        "timesheet_entries.status"
      ],
      "filtres": ["timesheet_entries.date", "timesheet_entries.status"],
      "groupement": ["staff.id", "timesheet_entries.date"]
    },
    "filtres": {
      "temporels": [
        "timesheet_entries.date >= DATE_TRUNC('week', CURRENT_DATE + INTERVAL '1 week')",
        "timesheet_entries.date < DATE_TRUNC('week', CURRENT_DATE + INTERVAL '2 week')"
      ],
      "logiques": [
        "timesheet_entries.status = 'CONFIRMED'",
        "timesheet_entries.start_time IS NOT NULL",
        "timesheet_entries.end_time IS NOT NULL"
      ]
    },
    "periodeTemporelle": {
      "debut": "DATE_TRUNC('week', CURRENT_DATE + INTERVAL '1 week')",
      "fin": "DATE_TRUNC('week', CURRENT_DATE + INTERVAL '2 week') - INTERVAL '1 day'",
      "precision": "JOUR"
    },
    "parametresRequete": {
      "tri": [
        "timesheet_entries.date ASC",
        "staff.name ASC",
        "timesheet_entries.start_time ASC"
      ],
      "limite": null,
      "offset": null
    }
  },
  "formatReponse": {
    "type": "PLANNING_HEBDOMADAIRE",
    "groupement": "PAR_JOUR",
    "details": [
      "nom_employe",
      "horaires",
      "status"
    ],
    "style": "LISTE_STRUCTUREE"
  }
}
`;
