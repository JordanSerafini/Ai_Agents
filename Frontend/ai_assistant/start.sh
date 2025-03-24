#!/bin/bash

# Démarrer Xvfb
Xvfb :99 -screen 0 1280x1024x24 > /dev/null 2>&1 &

# Attendre que Xvfb soit prêt
sleep 1

# Démarrer l'application
npm run start 