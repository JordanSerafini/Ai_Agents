export const analysePrompt = (question: string): string => `
🔹 **Question utilisateur** :
"${question}"

---

1️⃣ **Correction de la question**  
- Corrige les erreurs grammaticales, orthographiques ou de frappe dans la question.
- Reformule si nécessaire tout en préservant l'intention originale.

2️⃣ **Identification de l'intention**  
- Détermine l'objectif principal de l'utilisateur dans le contexte d'une entreprise de bâtiment (Technidalle).
- Exemples d'intentions possibles :
  - Demande d'informations sur des produits/services de construction
  - Demande de devis pour travaux
  - Question sur l'avancement d'un chantier
  - Demande de support technique
  - Recherche d'informations générales

3️⃣ **Classification de la demande**  
- Catégorise la question dans l'une des catégories suivantes :
  - GENERAL : Questions générales ne nécessitant pas d'accès à des données spécifiques (informations sur l'entreprise, services proposés, etc.)
  - API : Questions nécessitant un accès à la base de données (état d'un projet, informations client, catalogue produits, devis, factures, etc.)
  - WORKFLOW : Questions liées aux processus métier (suivi de chantier, validation d'étapes, planification, etc.)
  - AUTRE : Autres types de questions

4️⃣ **Attribution d'un agent**  
- Détermine quel agent doit traiter la demande :
  - agent_general : Pour les questions générales sur l'entreprise et ses services, ou nécessitant une recherche internet
  - agent_api : Pour les requêtes nécessitant un accès à la base de données (catalogue, projets, clients, devis, factures)
    - IMPORTANT: Toutes les questions concernant les chantiers planifiés, les projets en cours ou à venir, les calendriers d'événements doivent être dirigées vers agent_api car ces informations sont stockées dans la base de données.
  - agent_workflow : Pour les actions automatiques a faire par le workflow

5️⃣ **Évaluation de la priorité**  
- Définis la priorité de la demande parmi :
  - HIGH : Urgent, impact direct sur un chantier en cours ou la sécurité (arrêt de travaux, incident, etc.)
  - MEDIUM : Important mais peut attendre quelques heures (question client, avancement de projet, etc.)
  - LOW : Peu critique, information générale ou planification à long terme

6️⃣ **Extraction des entités**  
- Identifie les éléments clés mentionnés dans la question :
  - Noms de produits ou matériaux de construction
  - Références de projets ou chantiers
  - Localisations (adresses de chantiers)
  - Dates (livraisons, interventions)
  - Noms de clients ou d'entreprises partenaires
  - Types de travaux ou services
  - Montants ou données chiffrées
  - Numéros de devis ou factures

7️⃣ **Détermination du contexte**  
- Analyse si la question est liée à un contexte spécifique :
  - Phase de projet (avant-vente, chantier en cours, après-vente)
  - Problème particulier (retard, défaut, modification)
  - Saison ou période (contraintes saisonnières pour les travaux)
  - Urgence ou situation exceptionnelle
  - Relation client (nouveau client, client existant, partenaire)
  - Données financières (devis, factures, paiements)

---

🔹 **Format attendu en JSON :**  
**Attention : renvoie uniquement du JSON valide sans texte additionnel.**  

{
  "questionCorrigee": "Question corrigée",
  "intention": "Intention principale détectée",
  "categorie": "CATEGORIE",
  "agentCible": "nom_agent",
  "priorite": "PRIORITE",
  "entites": ["entité1", "entité2"],
  "contexte": "Description du contexte"
}
`;
