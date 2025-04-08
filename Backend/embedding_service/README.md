# Service d'Embedding

Ce service est responsable de la génération et du stockage des embeddings vectoriels, servant de pont entre le service de modèle et la base de données vectorielle ChromaDB.

## Fonctionnalités

- Génération d'embeddings via le Service de Modèle Mistral
- Gestion des collections dans ChromaDB
- Stockage et récupération de documents avec leurs embeddings
- Recherche sémantique par similarité de vecteurs

## Configuration

Le service écoute par défaut sur le port 3002 et se connecte au service de modèle et à ChromaDB via des URL configurables.

```bash
# Exemple de variables d'environnement
PORT=3002
MODEL_SERVICE_URL=http://model_service:3001
CHROMA_URL=http://ChromaDB:8000
```

## Routes API

### Gestion des Embeddings

#### Création d'Embedding

**Endpoint:** `POST /embedding`

Génère un embedding vectoriel pour un texte donné sans le stocker.

**Exemple de requête:**

```json
{
  "text": "Les vecteurs d'embedding permettent de représenter le sens d'un texte."
}
```

**Exemple de réponse:**

```json
{
  "embedding": [0.018, -0.032, 0.045, ...] // Vecteur d'embedding
}
```

### Gestion des Documents

#### Ajout de Document

**Endpoint:** `POST /embedding/document`

Ajoute un document avec son embedding à une collection ChromaDB.

**Exemple de requête:**

```json
{
  "text": "Les modèles de langage peuvent être utilisés pour générer des embeddings.",
  "metadata": {
    "source": "documentation",
    "category": "IA"
  },
  "id": "doc-123", // Optionnel, un UUID sera généré si non fourni
  "collectionName": "articles" // Optionnel, "default" par défaut
}
```

**Exemple de réponse:**

```json
{
  "id": "doc-123",
  "embedding": [0.012, -0.036, 0.024, ...], // Vecteur d'embedding
  "metadata": {
    "source": "documentation",
    "category": "IA",
    "text_length": 71,
    "embedding_dimension": 4096,
    "added_at": "2023-04-08T12:34:56.789Z"
  },
  "document": "Les modèles de langage peuvent être utilisés pour générer des embeddings."
}
```

#### Recherche par Similarité

**Endpoint:** `POST /embedding/query`

Recherche des documents similaires à un texte de requête.

**Exemple de requête:**

```json
{
  "text": "Comment générer des embeddings?",
  "collectionName": "articles", // Optionnel
  "limit": 3 // Optionnel, nombre max de résultats
}
```

**Exemple de réponse:**

```json
{
  "query": "Comment générer des embeddings?",
  "collection": "articles",
  "count": 2,
  "results": [
    {
      "document": "Les modèles de langage peuvent être utilisés pour générer des embeddings.",
      "distance": 0.89, // Plus proche de 1 = plus similaire
      "id": "doc-123",
      "metadata": {
        "source": "documentation",
        "category": "IA",
        "text_length": 71,
        "embedding_dimension": 4096,
        "added_at": "2023-04-08T12:34:56.789Z"
      }
    },
    {
      "document": "Un autre document moins similaire...",
      "distance": 0.65,
      "id": "doc-456",
      "metadata": { ... }
    }
  ]
}
```

### Gestion des Collections

#### Récupération d'une Collection

**Endpoint:** `GET /embedding/collection/:name`

Récupère les informations d'une collection ChromaDB.

**Exemple de réponse:**

```json
{
  "id": "collection-uuid",
  "name": "articles",
  "metadata": {
    "description": "Collection pour articles",
    "created_at": "2023-04-08T10:30:45.123Z"
  }
}
```

#### Création d'une Collection

**Endpoint:** `POST /embedding/collection/:name`

Crée une nouvelle collection dans ChromaDB.

**Exemple de réponse:**

```json
{
  "id": "nouveau-uuid",
  "name": "nouvelle-collection",
  "metadata": {
    "description": "Collection pour nouvelle-collection",
    "created_at": "2023-04-08T14:25:12.456Z"
  }
}
```

## Détails d'Implémentation

- Le service enrichit automatiquement les métadonnées des documents avec:
  - La longueur du texte
  - La dimension de l'embedding
  - L'horodatage d'ajout
- Les résultats de recherche sont reformatés pour plus de lisibilité et d'utilisabilité
- Une journalisation détaillée est implémentée pour faciliter le débogage

## Intégration

Ce service s'intègre avec:

- Le Service de Modèle pour la génération d'embeddings
- ChromaDB pour le stockage et la recherche vectorielle
- Le Service RAG qui utilise ce service pour enrichir les requêtes avec du contexte pertinent
