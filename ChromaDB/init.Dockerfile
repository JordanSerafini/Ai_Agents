FROM python:3.10-slim

WORKDIR /app

# Installation des dépendances
COPY init-collections.py /app/
RUN pip install --no-cache-dir chromadb requests

# Variables d'environnement
ENV CHROMA_HOST=ChromaDB
ENV CHROMA_PORT=8000
ENV EMBEDDING_SERVICE_URL=http://embedding_service:3002
ENV QUERIES_FOLDER=/app/queries

# Commande par défaut
CMD ["python", "init-collections.py"] 