FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Créer le dossier de persistence s'il n'existe pas
RUN mkdir -p /app/data/persistence

EXPOSE 3002

CMD ["node", "dist/main"] 