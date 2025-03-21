FROM node:20-alpine

# Installer Tesseract OCR et ses dépendances
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-fra \
    tesseract-ocr-data-eng \
    poppler-utils \
    imagemagick

WORKDIR /app

# Créer les dossiers requis
RUN mkdir -p /app/extractPdf /app/persistence/Factures /app/temp

COPY package.json .

RUN npm install

COPY . .

EXPOSE 3011

CMD ["npm", "run", "start:dev"]
