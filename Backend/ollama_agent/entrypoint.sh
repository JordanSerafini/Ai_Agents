#!/bin/sh

# Démarrer Ollama en arrière-plan
ollama serve &

# Attendre que le serveur soit prêt
sleep 5

# Télécharger le modèle Mistral
ollama pull mistral

# Attendre que le téléchargement soit terminé
wait 