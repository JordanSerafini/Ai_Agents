FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Installation standard des dépendances
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3002

CMD ["node", "dist/main"] 