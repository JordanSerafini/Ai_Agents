<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Analyse Agent

## Description
Un agent NestJS qui analyse et reformule les questions des utilisateurs pour améliorer leur interprétation et les rediriger vers les bonnes ressources ou agents.

## Fonctionnalités principales

- **Analyse sémantique** des questions utilisateurs pour en extraire l'intention et le contexte
- **Reformulation intelligente** des questions pour clarifier l'intention
- **Classification** des questions par catégorie et priorité
- **Routage intelligent** vers les agents spécialisés les plus appropriés
- **Détection d'entités** importantes dans les questions
- **Réorientation de questions** avec analyse approfondie et reformulation

## Nouveautés (Juin 2024)

- Refonte complète du prompt d'analyse pour une détection plus précise de l'intention
- Ajout d'un service de réorientation spécialisé pour retraiter les questions
- Amélioration de la reformulation des questions avec une analyse contextuelle
- Détection des informations manquantes dans les questions
- Suggestion de questions complémentaires pour clarifier la demande
- Analyse approfondie du contexte implicite des questions

## Endpoints

- `POST /analyse` - Analyse une question et fournit une réponse
- `POST /analyse/reorienter` - Analyse en profondeur, reformule et réoriente une question
- `GET /analyse/health` - Vérification de l'état de l'agent
- `GET /analyse/database-metadata` - Récupère les métadonnées de la base de données

## Installation

```bash
npm install
```

## Exécution en développement

```bash
npm run start:dev
```

## Construction pour la production

```bash
npm run build
```

## Démarrage en production

```bash
npm run start:prod
```

## Variables d'environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes:

```
PORT=4001
OPENAI_API_KEY=your_openai_api_key
```

## Docker

Un Dockerfile est inclus pour faciliter le déploiement:

```bash
docker build -t analyse-agent .
docker run -p 4001:4001 -d analyse-agent
```

## API de réorientation

L'API de réorientation permet de:
1. Analyser en profondeur une question utilisateur
2. Extraire l'intention réelle derrière la formulation
3. Reformuler la question pour plus de clarté
4. Identifier les informations manquantes
5. Suggérer des questions complémentaires

### Exemple de requête

```json
{
  "question": "Quand est prévu la livraison du chantier?",
  "userId": "user123",
  "contexteOriginal": "Discussion concernant le projet de rénovation à Paris"
}
```

### Exemple de réponse

```json
{
  "reponse": "Analyse et réorientation de la question:\n{
    \"questionOriginale\": \"Quand est prévu la livraison du chantier?\",
    \"questionReformulée\": \"Quelle est la date prévue pour la livraison du chantier de rénovation à Paris?\",
    \"intention\": \"Obtenir la date de fin des travaux du projet de rénovation\",
    \"catégorie\": \"API\",
    \"agentCible\": \"agent_api\",
    \"priorité\": \"MEDIUM\",
    \"entités\": [\"chantier\", \"livraison\", \"Paris\", \"rénovation\"],
    \"contexte\": \"Phase de suivi de projet, information sur planning\",
    \"informationsManquantes\": [\"Identifiant spécifique du chantier\"],
    \"questionsComplémentaires\": [\"De quel chantier spécifique parlez-vous?\", \"Avez-vous besoin d'informations sur des étapes intermédiaires avant la livraison finale?\" ]
  }"
}
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Jordan Serafini](https://github.com/JordanSerafini))
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
