# Service QueryBuilder

Ce service est responsable de la génération et de l'exécution de requêtes SQL à partir de descriptions en langage naturel, avec une gestion avancée des erreurs et des optimisations.

## Routes API

### 1. Génération de Requête
```http
POST /querybuilder/generate
```

Génère une requête SQL à partir d'une description en langage naturel.

#### Corps de la requête
```json
{
  "description": "Description de la requête souhaitée",
  "tables": ["table1", "table2"],
  "fields": ["champ1", "champ2"],
  "conditions": "WHERE ..."
}
```

#### Réponse
```json
{
  "success": true,
  "query": "SELECT champ1, champ2 FROM table1 JOIN table2 WHERE ...",
  "tables": ["table1", "table2"],
  "fields": ["champ1", "champ2"],
  "conditions": "WHERE ..."
}
```

### 2. Exécution de Requête
```http
POST /querybuilder/execute
```

Exécute une requête SQL et retourne les résultats.

#### Corps de la requête
```json
{
  "query": "SELECT * FROM table WHERE condition",
  "params": ["param1", "param2"]
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

### Génération de Requêtes
- Conversion de descriptions en langage naturel en SQL
- Support des jointures complexes
- Gestion des conditions WHERE
- Validation des tables et champs

### Exécution de Requêtes
- Exécution sécurisée avec paramètres préparés
- Gestion des transactions
- Mesure des performances
- Gestion des erreurs SQL

### Optimisations
- Validation des requêtes avant exécution
- Optimisation des jointures
- Gestion du cache des requêtes fréquentes
- Protection contre les injections SQL

## Configuration

Les variables d'environnement suivantes sont requises :

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
```

## Gestion des Erreurs

Le service gère les erreurs suivantes :
- Erreurs de syntaxe SQL
- Erreurs de connexion à la base de données
- Erreurs de validation des requêtes
- Erreurs d'exécution des requêtes

## Performance

- Exécution asynchrone des requêtes
- Optimisation des requêtes complexes
- Gestion du pool de connexions
- Cache des requêtes fréquentes

## Sécurité

- Protection contre les injections SQL
- Validation des entrées utilisateur
- Nettoyage des paramètres
- Gestion des permissions

## Logs

Le service génère des logs détaillés pour :
- Les requêtes générées
- Les temps d'exécution
- Les erreurs SQL
- Les optimisations effectuées

## Validation des Requêtes

Le système valide les requêtes selon plusieurs critères :
- Syntaxe SQL correcte
- Tables et champs existants
- Permissions d'accès
- Complexité acceptable

## Optimisations

### Optimisations de Requêtes
- Simplification des jointures
- Indexation automatique
- Cache des résultats
- Pagination des résultats

### Gestion des Ressources
- Pool de connexions
- Timeout des requêtes
- Limitation des résultats
- Nettoyage automatique 