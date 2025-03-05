#!/bin/bash

# Attendre que Elasticsearch soit prêt
echo "Attente du démarrage d'Elasticsearch..."
until curl -s http://localhost:9200 -u elastic:changeme; do
  sleep 5
done

echo "Elasticsearch est prêt. Configuration du compte de service pour Kibana..."

# Créer un compte de service pour Kibana
TOKEN=$(curl -s -X POST "http://localhost:9200/_security/service/elastic/kibana/credential/token/kibana-token" -u elastic:changeme -H "Content-Type: application/json")

echo "Token de service créé : $TOKEN"
echo $TOKEN > /tmp/kibana-token.json

echo "Configuration terminée." 