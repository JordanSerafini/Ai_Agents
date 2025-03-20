# Service d'Analyse avec HuggingFace

Ce service utilise des modèles HuggingFace pour analyser et traiter les questions en langage naturel, avec une intégration avancée de RAG (Retrieval Augmented Generation) et de cache SQL.

## Routes API

### 1. Analyse de Question
```http
POST /analyse/question
```

Analyse une question en langage naturel et retourne une réponse structurée.

#### Corps de la requête
```json
{
  "question": "Votre question ici"
}
```

#### Réponse
```json
{
  "source": "model",
  "result": {
    "question": "Question originale",
    "questionReformulated": "Question reformulée",
    "agent": "querybuilder",
    "finalQuery": "Requête SQL générée",
    "tables": ["table1", "table2"],
    "fields": ["champ1", "champ2"],
    "conditions": "WHERE ..."
  },
  "data": [...],  // Résultats de la requête SQL si applicable
  "rowCount": 10,
  "duration": 0.5,
  "confidence": 0.85,
  "similarity": 0.92
}
```

## Fonctionnalités

### Analyse Intelligente
- Reformulation automatique des questions
- Détection de l'intention de la question
- Génération de requêtes SQL
- Validation de la confiance des réponses

### Système de Cache
- Cache des requêtes SQL fréquentes
- Cache des questions similaires
- Système de similarité sémantique
- Validation des requêtes en cache

### Sources de Réponse
1. Requêtes prédéfinies
2. Questions reformulées
3. Cache SQL
4. Questions similaires
5. Modèle HuggingFace

## Configuration

Les variables d'environnement suivantes sont requises :

```env
HUGGINGFACE_API_KEY=your_api_key
SIMILARITY_THRESHOLD=0.65
```

## Gestion des Erreurs

Le service gère les erreurs suivantes :
- Erreurs de validation des entrées
- Erreurs d'exécution SQL
- Erreurs de cache
- Erreurs de modèle HuggingFace

## Performance

- Traitement asynchrone
- Cache multi-niveaux
- Optimisation des requêtes SQL
- Gestion de la mémoire optimisée

## Sécurité

- Validation des entrées utilisateur
- Protection contre les injections SQL
- Nettoyage des caractères spéciaux
- Limitation de la longueur des questions

## Logs

Le service génère des logs détaillés pour :
- Les questions reçues
- Les reformulations effectuées
- Les hits/misses du cache
- Les performances des requêtes
- Les erreurs rencontrées

## Validation des Réponses

Le système valide les réponses selon plusieurs critères :
- Score de confiance minimum (0.7)
- Qualité de la reformulation
- Présence des champs requis
- Validité des requêtes SQL
- Similarité sémantique

## Cache et Optimisation

### Système de Cache
- Cache des requêtes SQL fréquentes
- Cache des questions similaires
- Validation des requêtes en cache
- Nettoyage automatique du cache

### Optimisations
- Traitement parallèle des opérations
- Réduction des appels API
- Gestion efficace de la mémoire
- Validation des requêtes SQL 