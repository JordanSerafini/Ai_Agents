FROM postgres:17

# Installation des dépendances nécessaires pour compiler pgvector
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        postgresql-server-dev-17 \
        git \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Cloner et installer pgvector et pg_cron
RUN git clone --branch v0.6.0 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install \
    && cd .. \
    && rm -rf pgvector \
    && git clone https://github.com/citusdata/pg_cron.git \
    && cd pg_cron \
    && make \
    && make install \
    && cd .. \
    && rm -rf pg_cron

# Nettoyer les paquets de build qui ne sont plus nécessaires
RUN apt-get update \
    && apt-get remove -y \
        build-essential \
        postgresql-server-dev-17 \
        git \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configurer pg_cron
RUN echo "shared_preload_libraries = 'pg_cron'" >> /usr/share/postgresql/postgresql.conf.sample \
    && echo "cron.database_name = 'postgres'" >> /usr/share/postgresql/postgresql.conf.sample 