# Architecture RAG avec Mistral 7B et ChromaDB

Ce projet est une architecture de Retrieval Augmented Generation (RAG) complète qui utilise Mistral 7B Instruct pour générer des embeddings vectoriels et des réponses enrichies par du contexte pertinent.

## Vue d'Ensemble de l'Architecture

![Architecture RAG](https://mermaid.ink/img/pako:eNp1kc9OwzAMxl8l8gk0qYdbD0iIAweQEBJnLl7rtaZpEuWPxjT13XFLKwhY5ST7-_zFtuZGG4mcynpvu7Zr_EBsb4G7FuDx1Mwv-uHANVOJGvgw9H42s9PvOhjuXN3qANm9aBuS-cvdT-pPpbVNxG6Cjnx22Pu-HQLyNFogLV0dHFqfzNnwYjk3kDtGqOqEHQHk_iLkf4Q82Y_owCsNt0JEZLPFhGuiUmWZCTKWGMu5JCnW66Q8RZC_pRCzgSwxoVqtVossjVkZyShDIaQsIJH5Qkq-XrJEvH6JxaLETEq-FoVMF7GNZIl5yWMZDZJFJiZkuQaSW1MfQVuoaEpfONTpuN-Mz93Wt7TI-LFz9jxnx2_TdsO7jA6hcU1_oePE9d0Qa_-l3LPLGd3z2XdMxXMXrGnpltWBkp_27R2V?type=png)

L'architecture est composée de trois microservices principaux:

1. **Model Service** - Interface avec le modèle Mistral 7B
2. **Embedding Service** - Gestion des embeddings et de ChromaDB
3. **RAG Service** - Orchestration du processus RAG

Ces services sont complétés par deux composants de stockage:

- **ChromaDB** - Base de données vectorielle pour les embeddings
- **PostgreSQL** - Base de données relationnelle avec extension pgvector

## Flux de Données

1. Les documents sont stockés via le RAG Service
2. Le RAG Service transmet les documents à l'Embedding Service
3. L'Embedding Service demande au Model Service de générer des embeddings
4. Les embeddings et documents sont stockés dans ChromaDB
5. Lors d'une requête utilisateur:
   - Le RAG Service recherche des documents pertinents via l'Embedding Service
   - Il enrichit la requête avec ce contexte
   - Il envoie la requête enrichie au Model Service
   - Il renvoie la réponse générée à l'utilisateur

## Services

### [Model Service](./model_service/README.md)

**Port:** 3001

Service responsable de l'interaction avec le modèle Mistral 7B Instruct pour:

- La génération de texte via l'API de chat completions
- La création d'embeddings vectoriels

[Voir documentation détaillée](./model_service/README.md)

### [Embedding Service](./embedding_service/README.md)

**Port:** 3002

Service qui gère:

- La génération d'embeddings via le Model Service
- Le stockage et la récupération de documents dans ChromaDB
- La recherche sémantique par similarité vectorielle

[Voir documentation détaillée](./embedding_service/README.md)

### [RAG Service](./rag_service/README.md)

**Port:** 3003

Service qui implémente le pattern RAG:

- Stockage de documents dans la base de connaissances
- Recherche contextuelle pour les requêtes utilisateur
- Génération de réponses enrichies par du contexte pertinent

[Voir documentation détaillée](./rag_service/README.md)

## Démarrage Rapide

### Prérequis

- Docker et Docker Compose installés
- Au moins 16 Go de RAM disponibles pour exécuter Mistral 7B

### Installation et Lancement

1. Cloner le dépôt:

```bash
git clone <repository-url>
cd <repository-directory>
```

1. Configurer les variables d'environnement:

```bash
cp .env.example .env
# Modifier les variables selon vos besoins
```

1. Lancer les services:

```bash
docker-compose up -d
```

1. Vérifier que tous les services sont en cours d'exécution:

```bash
docker-compose ps
```

## Interfaces Utilisateur

- **PgAdmin**: Interface Web pour PostgreSQL - <http://localhost:5050>
- **Zipkin**: Interface de traçage - <http://localhost:9411>

## Routes API Principales

- `POST http://localhost:3003/rag/store` - Stocker un document
- `POST http://localhost:3003/rag/query` - Poser une question avec contexte
- `POST http://localhost:3003/rag/search` - Rechercher des documents pertinents

Voir la documentation détaillée de chaque service pour plus d'informations.

## Monitoring et Observabilité

L'architecture intègre:

- **OpenTelemetry** pour la collecte de métriques et traces
- **Zipkin** pour la visualisation des traces
- **Journalisation détaillée** dans chaque service

## Développement

Pour travailler sur un service spécifique en mode développement:

```bash
cd Backend/<service_name>
npm install
npm run start:dev
```

N'oubliez pas de configurer les variables d'environnement pour pointer vers les autres services en cours d'exécution.
