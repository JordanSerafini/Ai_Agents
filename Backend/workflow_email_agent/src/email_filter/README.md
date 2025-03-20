# Service de Filtrage d'Emails

Ce service est responsable de la suppression automatique des emails indésirables dans la boîte de réception. Il utilise des critères spécifiques pour identifier et supprimer les emails non pertinents.

## Fonctionnalités

- Suppression automatique des emails indésirables
- Traitement par lots pour optimiser les performances
- Gestion des erreurs et des timeouts
- Logs détaillés des opérations

## Routes API

### 1. Démarrage du Filtrage
```http
POST /email-filter/start
```

Démarre le processus de filtrage des emails.

**Corps de la requête :**
```json
{
  "maxMessages": 500,
  "startIndex": 0
}
```

**Paramètres :**
- `maxMessages` : Nombre maximum d'emails à traiter (par défaut : 500)
- `startIndex` : Index de départ pour le traitement (par défaut : 0)

**Réponse :**
```json
{
  "message": "Filtrage des emails terminé",
  "deletedEmails": 10,
  "totalProcessed": 500,
  "nextIndex": 500,
  "remaining": 69500
}
```

### 2. Chargement des Emails
```http
GET /email-filter/load
```

Charge la liste des emails pour prévisualisation.

**Réponse :**
```json
{
  "total": 100,
  "emails": [
    {
      "uid": 123,
      "subject": "Example Subject",
      "from": "sender@example.com",
      "date": "2024-03-20T10:00:00Z"
    }
  ]
}
```

### 3. Test de Suppression
```http
POST /email-filter/test-delete/:uid
```

Teste la suppression d'un email spécifique.

**Paramètres :**
- `uid` : Identifiant unique de l'email à supprimer

**Réponse :**
```json
{
  "success": true,
  "message": "Email supprimé avec succès"
}
```

## Configuration

Le service nécessite les variables d'environnement suivantes :

```env
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_password
IMAP_HOST=imap.example.com
IMAP_PORT=993
```

## Critères de Filtrage

Le service identifie les emails à supprimer en se basant sur les critères suivants :

1. **Mots-clés dans le sujet** :
   - "newsletter"
   - "promotion"
   - "offre spéciale"
   - "marketing"

2. **Expéditeurs connus** :
   - Listes de diffusion
   - Services marketing
   - Spam

3. **Contenu suspect** :
   - Liens malveillants
   - Pièces jointes dangereuses
   - Contenu marketing agressif

## Performance

- Traitement par lots de 500 emails
- Suppression en masse optimisée
- Gestion efficace de la mémoire
- Traitement asynchrone

## Gestion des Erreurs

- Reconnexion automatique en cas de perte de connexion
- Gestion des timeouts
- Logs détaillés des erreurs
- Reprise du traitement en cas d'échec

## Sécurité

- Connexion IMAP sécurisée (TLS)
- Gestion sécurisée des identifiants
- Validation des entrées
- Protection contre les injections

## Logs

Le service génère des logs pour :
- Le début et la fin du traitement
- Le nombre d'emails analysés
- Les emails supprimés
- Les erreurs rencontrées

## Optimisations

- Traitement par lots
- Suppression en masse
- Nettoyage automatique des buffers
- Gestion optimisée de la mémoire 