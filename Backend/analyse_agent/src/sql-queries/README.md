# Service SQL-Queries

Ce service gère les requêtes SQL prédéfinies et leur exécution, avec un système de cache et d'optimisation avancé.

## Routes API

### 1. Recherche de Requête Prédéfinie
```http
POST /sql-queries/find
```

Recherche une requête prédéfinie correspondant à une question.

#### Corps de la requête
```json
{
  "question": "Question en langage naturel",
  "threshold": 0.7
}
```

#### Réponse
```json
{
  "found": true,
  "id": "query_id",
  "description": "Description de la requête",
  "query": "SELECT ...",
  "similarity": 0.85,
  "parameters": {
    "questions": ["Question associée 1", "Question associée 2"]
  }
}
```

### 2. Exécution de Requête Prédéfinie
```http
POST /sql-queries/execute/:id
```

Exécute une requête prédéfinie par son ID.

#### Paramètres
- `id`: Identifiant de la requête prédéfinie

#### Corps de la requête
```json
{
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

#### Réponse
```json
{
  "success": true,
  "rows": [...],
  "rowCount": 10,
  "duration": 0.5
}
```

## Fonctionnalités

### Gestion des Requêtes Prédéfinies
- Stockage des requêtes fréquentes
- Association avec des questions similaires
- Paramétrage dynamique
- Versioning des requêtes

### Système de Cache
- Cache des résultats fréquents
- Invalidation intelligente
- Gestion de la mémoire
- Optimisation des performances

### Optimisations
- Validation des requêtes
- Optimisation des jointures
- Gestion des index
- Pagination des résultats

## Configuration

Les variables d'environnement suivantes sont requises :

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
CACHE_TTL=3600
```

## Gestion des Erreurs

Le service gère les erreurs suivantes :
- Erreurs de syntaxe SQL
- Erreurs de paramètres
- Erreurs de cache
- Erreurs d'exécution

## Performance

- Cache multi-niveaux
- Exécution asynchrone
- Optimisation des requêtes
- Gestion du pool de connexions

## Sécurité

- Validation des paramètres
- Protection contre les injections SQL
- Gestion des permissions
- Nettoyage des entrées

## Logs

Le service génère des logs détaillés pour :
- Les recherches de requêtes
- Les exécutions
- Les hits/misses du cache
- Les erreurs rencontrées

## Validation

### Validation des Requêtes
- Syntaxe SQL correcte
- Tables et champs existants
- Paramètres valides
- Complexité acceptable

### Validation des Paramètres
- Types de données
- Valeurs autorisées
- Ranges valides
- Formats spécifiques

## Optimisations

### Optimisations de Requêtes
- Simplification des jointures
- Utilisation d'index
- Cache des résultats
- Pagination

### Gestion du Cache
- Stratégie d'invalidation
- Compression des données
- Nettoyage automatique
- Statistiques d'utilisation 