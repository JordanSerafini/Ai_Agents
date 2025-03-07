FROM node:18-alpine

WORKDIR /app

# Installation des dépendances nécessaires
COPY package*.json ./
RUN npm install

# Copie des fichiers du projet
COPY . .

# Commande par défaut
CMD ["node", "index.js"] 