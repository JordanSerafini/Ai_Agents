FROM node:20-slim

WORKDIR /app

COPY package*.json ./

# Installer les dépendances nécessaires pour onnxruntime-node
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install

COPY . .

COPY .env .env

EXPOSE 3001

CMD ["npm", "run", "start:dev"]
