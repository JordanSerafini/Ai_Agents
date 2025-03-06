#!/bin/bash

# Attendre que le service Ollama soit prêt
echo "Attente du démarrage du service Ollama..."
sleep 10

# Vérifier si le modèle mistral est déjà téléchargé
if ! curl -s http://localhost:11434/api/tags | grep -q "mistral"; then
  echo "Téléchargement du modèle mistral..."
  curl -X POST http://localhost:11434/api/pull -d '{"name": "mistral"}'
  echo "Téléchargement terminé."
else
  echo "Le modèle mistral est déjà présent."
fi 