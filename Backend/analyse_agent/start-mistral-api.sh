#!/bin/bash

# Script pour lancer l'API Mistral pour l'agent d'analyse

# Chemin vers le dossier Mistral_Fine_Tuning
MISTRAL_DIR="../../Mistral_Fine_Tuning/python"
MODEL_PATH="jordanS/analyse_agent"
PORT=8000

# Fonction d'aide
show_help() {
    echo "Usage: ./start-mistral-api.sh [option]"
    echo ""
    echo "Options:"
    echo "  --model PATH      Chemin vers le modèle fine-tuné (par défaut: jordanS/analyse_agent)"
    echo "  --port PORT       Port sur lequel lancer l'API (par défaut: 8000)"
    echo "  --help            Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  ./start-mistral-api.sh                      # Lancer l'API avec le modèle par défaut"
    echo "  ./start-mistral-api.sh --model mon_modele   # Utiliser un modèle spécifique"
    echo "  ./start-mistral-api.sh --port 8080          # Lancer l'API sur le port 8080"
}

# Traiter les arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --model)
            MODEL_PATH="$2"
            echo "Modèle: $MODEL_PATH"
            shift
            ;;
        --port)
            PORT="$2"
            echo "Port: $PORT"
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Option non reconnue: $1"
            show_help
            exit 1
            ;;
    esac
    shift
done

# Vérifier si le dossier Mistral_Fine_Tuning existe
if [ ! -d "$MISTRAL_DIR" ]; then
    echo "Erreur: Le dossier $MISTRAL_DIR n'existe pas."
    echo "Veuillez vous assurer que le dossier Mistral_Fine_Tuning est présent au bon emplacement."
    exit 1
fi

# Aller dans le dossier Mistral_Fine_Tuning
cd "$MISTRAL_DIR" || exit 1

# Créer un nouvel environnement virtuel spécifique pour l'API
VENV_DIR="mistral_api_venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "Création d'un nouvel environnement virtuel..."
    python3 -m venv "$VENV_DIR"
fi

# Activer l'environnement virtuel
source "$VENV_DIR/bin/activate"

# Installer les dépendances nécessaires avec --break-system-packages pour contourner la restriction de Kali Linux
echo "Installation des dépendances..."
pip install --break-system-packages torch transformers peft fastapi uvicorn pydantic bitsandbytes accelerate

# Modifier le fichier model_api.py pour utiliser une configuration sans quantification 4-bit
if grep -q "load_in_4bit=True" model_api.py; then
    echo "Modification du fichier model_api.py pour désactiver la quantification 4-bit..."
    sed -i 's/load_in_4bit=True/load_in_4bit=False/g' model_api.py
    sed -i 's/bnb_4bit_use_double_quant=True/# bnb_4bit_use_double_quant=True/g' model_api.py
    sed -i 's/bnb_4bit_quant_type="nf4"/# bnb_4bit_quant_type="nf4"/g' model_api.py
    sed -i 's/bnb_4bit_compute_dtype=torch.float16/# bnb_4bit_compute_dtype=torch.float16/g' model_api.py
fi

# Lancer l'API Mistral
echo "Lancement de l'API Mistral..."
echo "Modèle: $MODEL_PATH"
echo "Port: $PORT"

# Lancer l'API avec uvicorn directement
python -m uvicorn model_api:app --host 0.0.0.0 --port $PORT

# Désactiver l'environnement virtuel (ne sera jamais exécuté tant que l'API est en cours d'exécution)
# deactivate 