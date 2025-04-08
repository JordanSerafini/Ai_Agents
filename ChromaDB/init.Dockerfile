FROM python:3.9-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY init-collections.py /app/
RUN pip install --no-cache-dir numpy==1.23.5 requests==2.31.0 urllib3==1.26.15 && \
    pip install --no-cache-dir pydantic==1.10.8 && \
    pip install --no-cache-dir chromadb==0.3.21

ENV CHROMA_HOST=ChromaDB
ENV CHROMA_PORT=8000
ENV EMBEDDING_SERVICE_URL=http://embedding_service:3002
ENV QUERIES_FOLDER=/app/queries
ENV INITIAL_WAIT_TIME=15

CMD ["python", "init-collections.py"] 