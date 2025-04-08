# Service RAG (Retrieval Augmented Generation)

Ce service implémente le concept de Génération Augmentée par Récupération pour améliorer les réponses du modèle de langage en les enrichissant avec des contextes pertinents issus d'une base de connaissances.

## Fonctionnalités

- Stockage de documents dans la base de connaissances
- Recherche contextuelle de documents pertinents
- Génération de réponses augmentées par contexte
- Gestion intelligente du contexte pour respecter les limites de tokens

## Configuration

Le service écoute par défaut sur le port 3000 et communique avec le service de modèle et d'embedding via des URL configurables.

```bash
# Exemple de variables d'environnement
PORT=3000
MODEL_SERVICE_URL=http://model_service:3001
EMBEDDING_SERVICE_URL=http://embedding_service:3002
```

## Routes API

### Stockage de Documents

**Endpoint:** `POST /rag/store`

Stocke un document dans la base de connaissances pour utilisation future.

**Exemple de requête:**

```json
{
  "document": "Les modèles RAG combinent la récupération d'information et la génération de texte.",
  "metadata": {
    "source": "documentation",
    "category": "architecture",
    "author": "équipe AI"
  },
  "collectionName": "articles" // Optionnel, "default" par défaut
}
```

**Exemple de réponse:**

```json
{
  "id": "doc-uuid-123",
  "document": "Les modèles RAG combinent la récupération d'information et la génération de texte.",
  "metadata": {
    "source": "documentation",
    "category": "architecture",
    "author": "équipe AI",
    "text_length": 76,
    "embedding_dimension": 4096,
    "added_at": "2023-04-08T12:34:56.789Z"
  },
  "embedding": [0.023, -0.012, 0.067, ...] // Vecteur d'embedding généré
}
```

### Requête avec Contexte

**Endpoint:** `POST /rag/query`

Traite une requête utilisateur en enrichissant la réponse avec du contexte pertinent.

**Exemple de requête:**

```json
{
  "query": "Expliquez comment fonctionne RAG",
  "collectionName": "articles", // Optionnel
  "contextCount": 3, // Optionnel, nombre de documents à inclure comme contexte
  "stream": false // Optionnel, pour la réponse en streaming
}
```

**Exemple de réponse:**

```json
{
  "query": "Expliquez comment fonctionne RAG",
  "response": "RAG (Retrieval Augmented Generation) est une architecture qui améliore les réponses des LLM en recherchant d'abord des informations pertinentes dans une base de connaissances, puis en les utilisant comme contexte pour générer une réponse. Dans votre cas, j'ai utilisé des documents qui expliquent que les modèles RAG combinent la récupération d'information et la génération de texte.",
  "context": [
    {
      "document": "Les modèles RAG combinent la récupération d'information et la génération de texte.",
      "metadata": {
        "source": "documentation",
        "category": "architecture"
      },
      "id": "doc-uuid-123",
      "distance": 0.92
    },
    // Autres documents de contexte...
  ]
}
```

### Recherche de Documents

**Endpoint:** `POST /rag/search`

Recherche des documents similaires à une requête sans générer de réponse.

**Exemple de requête:**

```json
{
  "query": "architecture RAG",
  "collectionName": "articles", // Optionnel
  "limit": 5 // Optionnel, nombre max de résultats
}
```

**Exemple de réponse:**

```json
{
  "query": "architecture RAG",
  "results": [
    {
      "document": "Les modèles RAG combinent la récupération d'information et la génération de texte.",
      "metadata": {
        "source": "documentation",
        "category": "architecture"
      },
      "id": "doc-uuid-123",
      "distance": 0.95
    },
    // Autres résultats...
  ]
}
```

## Workflow RAG

1. **Stockage de documents:**
   - Les documents sont envoyés au service via l'API
   - Les embeddings sont générés par le service d'embedding
   - Les documents et leurs embeddings sont stockés dans ChromaDB

2. **Requête utilisateur:**
   - L'utilisateur soumet une question via l'endpoint `/rag/query`

3. **Récupération de documents:**
   - Le service génère un embedding pour la requête utilisateur
   - Des documents similaires sont récupérés par similarité vectorielle

4. **Augmentation du contexte:**
   - Les documents récupérés sont formatés en un contexte cohérent
   - La longueur du contexte est gérée pour respecter les limites de tokens

5. **Génération de réponse:**
   - La requête utilisateur est envoyée au modèle avec le contexte enrichi
   - Le modèle génère une réponse basée sur ses connaissances et le contexte fourni

6. **Livraison de la réponse:**
   - La réponse est retournée à l'utilisateur avec les sources utilisées

## Avantages du RAG

- **Précision accrue:** Utilisation d'informations exactes et à jour
- **Réduction des hallucinations:** Le modèle s'appuie sur des faits vérifiables
- **Connaissance à jour:** Pas de limitation aux données d'entraînement
- **Traçabilité:** Les sources d'information sont identifiables

## Intégration

Ce service s'intègre avec:

- Le Service de Modèle pour la génération de réponses
- Le Service d'Embedding pour la recherche sémantique
- ChromaDB (indirectement) pour le stockage vectoriel des connaissances
