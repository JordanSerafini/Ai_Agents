# Workflow Email Agent - Traitement et Analyse de Factures

Ce service permet de récupérer automatiquement les factures depuis une boîte mail, d'extraire leur contenu et de les organiser intelligemment par fournisseur.

## Fonctionnalités

- Récupération automatique des factures depuis un dossier IMAP
- Extraction du texte des PDF via deux méthodes complémentaires :
  - Extraction directe avec pdf-parse
  - Reconnaissance optique de caractères (OCR) avec Tesseract
- Extraction intelligente des informations clés :
  - Numéro de facture
  - Montant
  - Date
  - Fournisseur
- Organisation automatique des factures par fournisseur
- API REST pour accéder aux factures traitées

## Installation

1. Installez les dépendances :

```bash
cd Backend/workflow_email_agent
npm install
```

2. Configuration IMAP - modifiez le fichier `.env` :

```
EMAIL_USER=votre.email@domaine.com
EMAIL_PASSWORD=motdepasse
IMAP_HOST=imap.domaine.com
IMAP_PORT=993
```

3. Installez Tesseract OCR pour l'extraction de texte des PDF :
   - Windows : [Télécharger Tesseract](https://github.com/UB-Mannheim/tesseract/wiki)
   - MacOS : `brew install tesseract`
   - Linux : `apt-get install tesseract-ocr`

## Utilisation

### Démarrer le service

```bash
npm run start:dev
```

### Endpoints API

#### Traitement des factures

- **POST** `/invoice-parser/process`
  - Déclenche le processus de traitement des factures depuis la boîte mail
  - Retourne le nombre de factures traitées

#### Liste des factures

- **GET** `/invoice-parser/invoices`
  - Récupère la liste de toutes les factures traitées
  - Classées par fournisseur
  - Inclut un échantillon du texte extrait et les métadonnées

#### Détails d'une facture

- **GET** `/invoice-parser/invoice/:invoiceNumber`
  - Récupère les détails d'une facture en recherchant dans tous les dossiers fournisseurs
  - Paramètres :
    - `invoiceNumber` : Numéro de la facture à consulter

- **GET** `/invoice-parser/invoice/:invoiceNumber/:supplier`
  - Récupère les détails d'une facture d'un fournisseur spécifique
  - Paramètres :
    - `invoiceNumber` : Numéro de la facture à consulter
    - `supplier` : Nom du fournisseur

## Structure des données

Les factures sont organisées sur le disque selon cette structure :
```
extractPdf/
  ├── NOM_FOURNISSEUR/
  │   └── FACTURE-123/
  │       ├── FACTURE-123.pdf
  │       ├── FACTURE-123.txt
  │       └── FACTURE-123_metadata.json
  ├── AUTRE_FOURNISSEUR/
  │   └── ...
  └── non-classifie/
      └── ...
```

## Exemple d'utilisation avec cURL

```bash
# Lancer le traitement des factures
curl -X POST http://localhost:3000/invoice-parser/process

# Récupérer la liste des factures
curl -X GET http://localhost:3000/invoice-parser/invoices

# Récupérer les détails d'une facture (recherche dans tous les fournisseurs)
curl -X GET http://localhost:3000/invoice-parser/invoice/FACTURE-123

# Récupérer les détails d'une facture d'un fournisseur spécifique
curl -X GET http://localhost:3000/invoice-parser/invoice/FACTURE-123/NOM_FOURNISSEUR
```

## Notes techniques

Le service utilise à la fois l'extraction directe de texte et l'OCR pour maximiser les chances d'extraire correctement les informations des factures. Cette approche hybride est particulièrement utile pour les factures contenant à la fois du texte et des éléments graphiques.
