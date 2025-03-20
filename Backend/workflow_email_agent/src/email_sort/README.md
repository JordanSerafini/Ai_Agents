# Service de Tri d'Emails

Ce service est responsable de l'analyse et du tri automatique des emails contenant des factures. Il utilise l'API IMAP pour se connecter à la boîte mail et déplace les factures identifiées vers un dossier dédié.

## Fonctionnalités

- Analyse automatique des emails non lus
- Identification des factures basée sur des critères spécifiques
- Déplacement automatique des factures vers un dossier dédié
- Traitement par lots pour optimiser les performances
- Gestion des pièces jointes PDF

## Routes API

### 1. Vérification des Factures

```http
POST /email-sort/check
```

Démarre le processus de vérification des emails pour identifier les factures.

**Corps de la requête :**

```json
{
  "maxMessages": 50,
  "startIndex": 0
}
```

**Paramètres :**

- `maxMessages` : Nombre maximum d'emails à traiter (par défaut : 50)
- `startIndex` : Index de départ pour le traitement (par défaut : 0)

**Réponse :**

```json
{
  "total": 50,
  "invoicesFound": 5,
  "remaining": 100
}
```

### 2. Chargement des Emails

```http
GET /email-sort/load
```

Charge et affiche la liste des emails non lus pour prévisualisation.

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
POST /email-sort/test-move/:uid
```

Teste le déplacement d'un email spécifique vers le dossier "Factures".

#### Paramètres

- `uid`: Identifiant unique de l'email à déplacer

#### Réponse

```json
{
  "success": true,
  "message": "Email déplacé avec succès vers le dossier Factures"
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

## Critères d'Identification des Factures

Le service identifie une facture en se basant sur les critères suivants :

1. **Mots-clés principaux** (au moins un requis) :

   - "facture"
   - "invoice"
   - "devis"
   - "bon de commande"
   - "reçu"
   - "receipt"

2. **Montant avec devise** (requis) :

   - Format : 123,45€ ou 123.45 EUR

3. **Critères secondaires** (au moins 2 requis) :

   - Numéro de facture
   - Date
   - Numéro de TVA
   - Montants HT et TTC

## Performance et Optimisations

- Traitement par lots de 50 emails
- Analyse optimisée des en-têtes
- Gestion efficace de la mémoire
- Traitement asynchrone des pièces jointes
- Pauses entre les lots pour éviter la surcharge
- Limitation du nombre d'emails traités par exécution

## Gestion des Erreurs

Le service gère les erreurs suivantes :

- Erreurs de connexion IMAP
- Erreurs de lecture d'emails
- Erreurs de déplacement d'emails
- Erreurs de traitement des pièces jointes
- Reconnexion automatique en cas de perte de connexion
- Gestion des timeouts
- Reprise du traitement en cas d'échec

## Sécurité

- Connexion IMAP sécurisée (SSL/TLS)
- Gestion sécurisée des identifiants
- Validation des entrées utilisateur
- Protection contre les injections

## Logs

Le service génère des logs détaillés pour :

- Le début et la fin du traitement
- Le nombre d'emails traités
- Les factures identifiées
- Les erreurs rencontrées
- Les opérations de déplacement réussies 