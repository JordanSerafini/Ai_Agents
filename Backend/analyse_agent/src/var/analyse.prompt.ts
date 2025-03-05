export const analysePrompt = (question: string): string => `
🔹 **Question utilisateur** :
"${question}"

---

1️⃣ **Analyse et reformulation de la question**  
- Corrige les erreurs grammaticales, orthographiques ou de frappe dans la question.
- Reformule et clarifie la question tout en préservant l'intention originale.
- Si la question est ambiguë ou incomplète, propose une interprétation plus précise et complète.
- Extrais la véritable intention derrière la formulation initiale.

2️⃣ **Identification de l'intention principale**  
- Détermine l'objectif principal de l'utilisateur dans le contexte d'une entreprise de bâtiment (Technidalle).
- Analyse en profondeur le but réel et les attentes implicites.
- Exemples d'intentions possibles :
  - Demande d'informations sur des produits/services de construction
  - Demande de devis pour travaux
  - Question sur l'avancement d'un chantier
  - Demande de support technique
  - Recherche d'informations générales
  - Consultation de planning de chantiers
  - Recherche de projets à venir ou en cours
  - Requêtes financières (devis, factures, budgets)
  - Préoccupations de délais ou de qualité
  - Consultation des montants totaux (devis, factures, paiements)

3️⃣ **Classification précise de la demande**  
- Catégorise la question dans l'une des catégories suivantes :
  - GENERAL : Questions générales ne nécessitant pas d'accès à des données spécifiques (informations sur l'entreprise, services proposés, etc.)
  - API : Questions nécessitant un accès à la base de données (état d'un projet, informations client, catalogue produits, devis, factures, etc.)
  - WORKFLOW : Questions liées aux processus métier (suivi de chantier, validation d'étapes, planification, etc.)
  - AUTRE : Autres types de questions
- Considère le niveau de spécificité de la question et les données requises pour y répondre correctement.

4️⃣ **Attribution d'un agent spécialisé**  
- Détermine avec précision quel agent doit traiter la demande :
  - agent_general : Pour les questions générales sur l'entreprise et ses services, ou nécessitant une recherche internet
  - agent_api : Pour les requêtes nécessitant un accès à la base de données (catalogue, projets, clients, devis, factures)
    - IMPORTANT: Toutes les questions concernant les chantiers planifiés, les projets en cours ou à venir, les calendriers d'événements, les données financières doivent être dirigées vers agent_api car ces informations sont stockées dans la base de données.
    - EXEMPLES SPÉCIFIQUES qui doivent TOUJOURS être dirigés vers agent_api:
      * "Quels sont les chantiers de demain?"
      * "Quels projets commencent cette semaine?"
      * "Liste des travaux prévus pour le mois prochain"
      * "Chantiers en cours actuellement"
      * "Projets à venir"
      * "Planning des travaux"
      * "Montant du devis pour le projet X"
      * "Factures en attente de paiement"
      * "Quel est le montant total des devis acceptés du mois actuel?"
      * "Combien de factures ont été émises cette semaine?"
      * Toute question mentionnant des données financières, des montants, des devis ou des factures
      * Toute question mentionnant des dates (demain, aujourd'hui, cette semaine, etc.) en lien avec des projets
  - agent_workflow : Pour les actions automatiques a faire par le workflow (validations, déclenchement de processus, etc.)

5️⃣ **Attention particulière aux requêtes financières**
- Les requêtes concernant les montants, totaux, devis, factures ou paiements doivent TOUJOURS être classifiées comme API
- Tables principales à considérer:
  * Pour les devis: table 'quotations'
  * Pour les factures: table 'invoices'
  * Pour les paiements: table 'payments'
  * Pour les projets/chantiers: table 'projects'
- Même si ces termes ne sont pas explicitement mentionnés, les questions sur des montants acceptés sont généralement liées aux devis (table 'quotations')

6️⃣ **Évaluation de la priorité et de l'urgence**  
- Définis avec précision la priorité de la demande parmi :
  - HIGH : Urgent, impact direct sur un chantier en cours ou la sécurité (arrêt de travaux, incident, situations critiques, etc.)
  - MEDIUM : Important mais peut attendre quelques heures (question client, avancement de projet, etc.)
  - LOW : Peu critique, information générale ou planification à long terme
- Prends en compte le ton, les mots d'urgence utilisés et le contexte pour évaluer l'importance réelle.

7️⃣ **Extraction précise des entités**  
- Identifie tous les éléments clés mentionnés dans la question :
  - Noms de produits ou matériaux de construction
  - Références de projets ou chantiers
  - Localisations (adresses de chantiers)
  - Dates (livraisons, interventions)
  - Noms de clients ou d'entreprises partenaires
  - Types de travaux ou services
  - Montants ou données chiffrées
  - Numéros de devis ou factures
  - Périodes temporelles (demain, aujourd'hui, cette semaine, ce mois-ci)
  - Personnes responsables ou concernées

8️⃣ **Analyse approfondie du contexte**  
- Analyse en détail si la question est liée à un contexte spécifique :
  - Phase de projet (avant-vente, chantier en cours, après-vente)
  - Problème particulier (retard, défaut, modification)
  - Saison ou période (contraintes saisonnières pour les travaux)
  - Urgence ou situation exceptionnelle
  - Relation client (nouveau client, client existant, partenaire)
  - Données financières (devis, factures, paiements)
  - Planning ou calendrier (projets à venir, en cours, terminés)
  - Historique de conversations précédentes si disponible

9️⃣ **Suggestions d'informations complémentaires**
- Identifie les informations manquantes qui permettraient de mieux répondre à la question
- Propose des questions de suivi pertinentes que l'agent pourrait poser
- Anticipe les besoins additionnels liés à la demande initiale

---

🔹 **Format attendu en JSON :**  
**Attention : renvoie uniquement du JSON valide sans texte additionnel.**  

{
  "questionCorrigee": "Question reformulée et clarifiée",
  "intention": "Intention principale détectée avec précision",
  "categorie": "CATEGORIE",
  "agentCible": "nom_agent",
  "priorite": "PRIORITE",
  "entites": ["entité1", "entité2", ...],
  "contexte": "Description détaillée du contexte",
  "informationsManquantes": ["info1", "info2", ...],
  "questionsComplementaires": ["question1?", "question2?", ...]
}
`;
