# Service RAG (Retrieval Augmented Generation)

Ce service implémente un système de RAG avancé pour la recherche et la récupération d'informations pertinentes à partir d'une base de connaissances vectorielle.

## Routes API

### 1. Recherche de Documents Similaires
```http
POST /rag/search
```

Recherche des documents similaires dans une collection donnée.

#### Corps de la requête
```json
{
  "collection": "nom_collection",
  "query": "texte de recherche",
  "limit": 5,
  "threshold": 0.7
}
```

#### Réponse
```json
{
  "found": true,
  "documents": [
    {
      "id": "doc_id",
      "content": "contenu du document",
      "similarity": 0.85,
      "metadata": {
        "confidenceScore": 0.9,
        "timestamp": "2024-03-20T10:00:00Z"
      }
    }
  ]
}
```

### 2. Gestion des Collections
```http
POST /rag/collection
```

Crée ou met à jour une collection de documents.

#### Corps de la requête
```json
{
  "name": "nom_collection",
  "documents": ["doc1", "doc2"],
  "ids": ["id1", "id2"],
  "metadata": [
    {
      "confidenceScore": 0.9,
      "timestamp": "2024-03-20T10:00:00Z"
    }
  ]
}
```

## Fonctionnalités

### Recherche Sémantique
- Recherche par similarité vectorielle
- Filtrage par seuil de similarité
- Récupération contextuelle
- Métadonnées enrichies

### Gestion des Collections
- Création de collections
- Mise à jour de documents
- Suppression de documents
- Gestion des métadonnées

### Optimisations
- Indexation vectorielle
- Cache des résultats
- Compression des vecteurs
- Recherche approximative

## Configuration

Les variables d'environnement suivantes sont requises :

```env
VECTOR_DB_HOST=localhost
VECTOR_DB_PORT=6333
VECTOR_DB_COLLECTION=default
```

## Gestion des Erreurs

Le service gère les erreurs suivantes :
- Erreurs de connexion à la base vectorielle
- Erreurs d'indexation
- Erreurs de recherche
- Erreurs de validation

## Performance

- Recherche vectorielle optimisée
- Indexation incrémentale
- Cache des résultats fréquents
- Compression des données

## Sécurité

- Validation des entrées
- Protection contre les injections
- Gestion des permissions
- Nettoyage des données

## Logs

Le service génère des logs détaillés pour :
- Les opérations de recherche
- Les mises à jour de collections
- Les performances
- Les erreurs rencontrées

## Métriques

### Performance
- Temps de recherche
- Taux de hit/miss
- Utilisation mémoire
- Latence des requêtes

### Qualité
- Précision des résultats
- Couverture des documents
- Pertinence des réponses
- Score de similarité 