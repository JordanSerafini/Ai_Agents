# Service Workflow Email Agent

Ce service gère le traitement automatique des emails, avec un focus particulier sur la détection et le tri des factures.

## Structure du Projet

```
workflow_email_agent/
├── src/                    # Code source
├── persistence/           # Données persistantes
├── test/                  # Tests unitaires et d'intégration
├── node_modules/         # Dépendances
└── Dockerfile           # Configuration Docker
```

## Configuration

### Variables d'Environnement
```env
# Configuration IMAP
IMAP_HOST=imap.example.com
IMAP_PORT=993
IMAP_USER=user@example.com
IMAP_PASSWORD=your_password

# Configuration de l'Agent
AGENT_NAME=workflow_email_agent
AGENT_TYPE=email_workflow
AGENT_DESCRIPTION="Agent de traitement des emails"

# Configuration de l'API
API_PORT=3000
API_PREFIX=/email-workflow
```

## Fonctionnalités

### Traitement des Emails
- Connexion IMAP sécurisée
- Lecture des emails non lus
- Traitement par lots
- Gestion de la mémoire optimisée

### Détection des Factures
- Analyse du contenu des emails
- Détection des pièces jointes
- Identification des factures
- Classification des documents

### Gestion des Dossiers
- Création automatique des dossiers
- Déplacement des emails
- Organisation par type
- Marquage des emails traités

## API Routes

### 1. Vérification des Factures
```http
POST /email-workflow/check-invoices
```

Démarre le processus de vérification des factures.

#### Corps de la requête
```json
{
  "maxMessages": 500,
  "startIndex": 0
}
```

#### Réponse
```json
{
  "message": "Vérification des factures terminée",
  "invoicesFound": 6,
  "totalProcessed": 500,
  "nextIndex": 500,
  "remaining": 69500
}
```

### 2. Chargement des Emails
```http
GET /email-workflow/load
```

Charge la liste des emails pour prévisualisation.

#### Réponse
```json
{
  "message": "Emails chargés avec succès",
  "totalEmails": 100,
  "emails": [
    {
      "uid": 123,
      "subject": "Facture #123",
      "from": "fournisseur@example.com",
      "date": "2024-03-20T10:00:00Z"
    }
  ]
}
```

### 3. Test de Déplacement
```http
POST /email-workflow/test-move/:uid
```

Teste le déplacement d'un email spécifique.

#### Paramètres
- `uid`: Identifiant de l'email

#### Réponse
```json
{
  "success": true,
  "message": "Email déplacé avec succès"
}
```

## Gestion des Données

### Persistance
- Suivi des emails traités
- Historique des opérations
- Métriques de performance
- Configuration des règles

### Validation
- Vérification des emails
- Validation des pièces jointes
- Contrôle des formats
- Nettoyage des données

## Performance

### Optimisations
- Traitement par lots
- Gestion de la mémoire
- Pauses entre les lots
- Limitation des emails traités

### Monitoring
- Suivi des performances
- Métriques de traitement
- Détection des anomalies
- Alertes de dégradation

## Sécurité

- Connexion IMAP sécurisée
- Protection des identifiants
- Validation des entrées
- Journalisation des actions

## Logs

Le service génère des logs détaillés pour :
- Les opérations de traitement
- Les factures identifiées
- Les déplacements d'emails
- Les erreurs rencontrées

## Tests

### Tests Unitaires
- Validation des fonctions
- Tests des règles de tri
- Vérification des formats
- Tests de performance

### Tests d'Intégration
- Tests end-to-end
- Validation des API
- Tests de charge
- Tests de régression

## Docker

### Construction
```bash
docker build -t workflow_email_agent .
```

### Exécution
```bash
docker run -d \
  --name workflow_email_agent \
  -p 3000:3000 \
  --env-file .env \
  workflow_email_agent
```

### Configuration Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "start:prod"]
```
