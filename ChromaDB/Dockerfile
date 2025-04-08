FROM ghcr.io/chroma-core/chroma:0.4.22

USER root
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
USER chroma 