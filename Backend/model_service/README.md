# Service de Modèle Mistral

Ce service est responsable de l'interface avec le modèle Mistral 7B Instruct pour la génération de texte et la création d'embeddings vectoriels.

## Fonctionnalités

- Génération de texte (chat completions) via Mistral 7B Instruct
- Création d'embeddings vectoriels pour la recherche sémantique
- Gestion robuste des erreurs et des réponses du modèle

## Configuration

Le service écoute par défaut sur le port 3001 et se connecte au modèle Mistral via l'URL définie dans la variable d'environnement `MODEL_URL`.

```bash
# Exemple de variables d'environnement
PORT=3001
MODEL_URL=http://mistral:8080
```

## Routes API

### Génération de Texte

**Endpoint:** `POST /v1/chat/completions`

Génère une réponse textuelle à partir d'un prompt utilisateur en utilisant le modèle Mistral 7B Instruct.

**Exemple de requête:**

```json
{
  "messages": [
    { "role": "user", "content": "Explique-moi comment fonctionne la recherche sémantique." }
  ],
  "max_tokens": -1,
  "temperature": 0.2
}
```

**Exemple de réponse:**

```json
{
  "choices": [
    {
      "message": {
        "content": "La recherche sémantique est une méthode qui va au-delà de la simple correspondance de mots-clés..."
      }
    }
  ]
}
```

**Paramètres:**

- `messages`: Tableau des messages de conversation, chacun avec un rôle et un contenu
- `max_tokens`: Nombre maximum de tokens à générer (-1 pour la génération sans limite)
- `temperature`: Contrôle la créativité/randomisation des réponses (0-1, où 0 est le plus déterministe)

### Création d'Embeddings

**Endpoint:** `POST /embedding`

Transforme un texte en représentation vectorielle (embedding) pour la recherche sémantique.

**Exemple de requête:**

```json
{
  "text": "La recherche sémantique permet de trouver des documents similaires conceptuellement."
}
```

**Exemple de réponse:**

```json
{
  "embedding": [0.023, -0.041, 0.017, ...] // Vecteur de dimension 4096
}
```

**Détails techniques:**

- La dimension par défaut des embeddings est de 4096 (optimisée pour Mistral 7B)
- Le service gère les cas où Mistral génère un embedding de taille différente via redimensionnement
- Un système de fallback est intégré pour garantir une réponse même en cas d'erreur

## Implémentation

Le service utilise une approche robuste pour extraire des embeddings de qualité:

1. Nettoyage et préparation du texte d'entrée
2. Construction d'un prompt spécialisé pour demander un embedding
3. Extraction du tableau JSON depuis la réponse du modèle
4. Validation et redimensionnement si nécessaire
5. Génération d'embedding de secours (fallback) si l'extraction échoue

## Intégration

Ce service est conçu pour fonctionner avec:

- Le service d'embedding pour la génération de vecteurs
- Le service RAG pour l'augmentation des requêtes avec contexte pertinent
