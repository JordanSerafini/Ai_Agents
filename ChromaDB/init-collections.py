#!/usr/bin/env python3
"""
Script d'initialisation pour ChromaDB
Ce script crée les collections nécessaires pour stocker les requêtes métier
"""

import os
import json
import time
import logging
import sys
import glob
from chromadb import Client
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Configuration
CHROMA_HOST = os.environ.get("CHROMA_HOST", "ChromaDB")
CHROMA_PORT = os.environ.get("CHROMA_PORT", "8000")
CHROMA_URL = f"http://{CHROMA_HOST}:{CHROMA_PORT}"
QUERIES_FOLDER = os.environ.get("QUERIES_FOLDER", "/app/queries")
EMBEDDING_SERVICE_URL = os.environ.get("EMBEDDING_SERVICE_URL", "http://embedding_service:3002")
COLLECTION_NAMES = [
    "business_queries",  # Pour les requêtes métier
    "documents",         # Pour les documents généraux
    "faqs"               # Pour les FAQs
]

# Configuration des sessions avec retry
def create_session_with_retry():
    session = requests.Session()
    retry_strategy = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS", "POST"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

def wait_for_chroma():
    """Attendre que ChromaDB soit prêt"""
    max_retries = 60  # Augmenté de 30 à 60
    retry_interval = 5  # Augmenté de 2 à 5
    
    logger.info(f"En attente de ChromaDB à l'adresse {CHROMA_URL}...")
    
    session = create_session_with_retry()
    
    for i in range(max_retries):
        try:
            response = session.get(f"{CHROMA_URL}/api/v1/heartbeat", timeout=10)
            if response.status_code == 200:
                logger.info("✓ ChromaDB est opérationnel!")
                return True
        except Exception as e:
            logger.info(f"ChromaDB n'est pas encore prêt: {str(e)}")
        
        logger.info(f"ChromaDB n'est pas encore prêt (tentative {i+1}/{max_retries})...")
        time.sleep(retry_interval)
    
    logger.error("❌ ChromaDB n'est pas disponible après plusieurs tentatives!")
    return False

def wait_for_embedding_service():
    """Attendre que le service d'embedding soit prêt"""
    max_retries = 60  # Augmenté de 30 à 60
    retry_interval = 5  # Augmenté de 2 à 5
    
    logger.info(f"En attente du service d'embedding à l'adresse {EMBEDDING_SERVICE_URL}...")
    
    session = create_session_with_retry()
    
    # Essayer d'abord l'endpoint /health
    for i in range(max_retries):
        try:
            # Essayer plusieurs endpoints possibles
            endpoints = ["/health", "/", "/api"]
            
            for endpoint in endpoints:
                try:
                    response = session.get(f"{EMBEDDING_SERVICE_URL}{endpoint}", timeout=10)
                    if response.status_code < 500:  # Accepter tous les codes 2xx, 3xx, 4xx
                        logger.info(f"✓ Service d'embedding est opérationnel (endpoint {endpoint})!")
                        return True
                except Exception:
                    continue
        except Exception as e:
            logger.info(f"Service d'embedding n'est pas encore prêt: {str(e)}")
        
        logger.info(f"Service d'embedding n'est pas encore prêt (tentative {i+1}/{max_retries})...")
        time.sleep(retry_interval)
    
    logger.error("❌ Service d'embedding n'est pas disponible après plusieurs tentatives!")
    # Continuer quand même pour créer les collections dans ChromaDB
    return True

def init_chroma_client():
    """Initialiser le client ChromaDB"""
    try:
        # Dans les versions plus anciennes, les settings sont passés directement
        client = Client(chroma_server_host=CHROMA_HOST, 
                       chroma_server_http_port=CHROMA_PORT)
        return client
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'initialisation du client ChromaDB: {e}")
        return None

def create_collections(client):
    """Créer les collections nécessaires"""
    try:
        existing_collections = [col.name for col in client.list_collections()]
        logger.info(f"Collections existantes: {existing_collections}")
        
        for name in COLLECTION_NAMES:
            if name in existing_collections:
                logger.info(f"La collection '{name}' existe déjà")
            else:
                try:
                    metadata = {
                        "description": f"Collection pour {name}",
                        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    }
                    
                    client.create_collection(
                        name=name,
                        metadata=metadata
                    )
                    logger.info(f"✓ Collection '{name}' créée avec succès!")
                except Exception as e:
                    logger.error(f"❌ Erreur lors de la création de la collection '{name}': {e}")
    except Exception as e:
        logger.error(f"❌ Erreur lors de la récupération des collections: {e}")

def create_collection_via_service(name):
    """Créer une collection via le service d'embedding"""
    try:
        session = create_session_with_retry()
        url = f"{EMBEDDING_SERVICE_URL}/embedding/collection/{name}"
        response = session.post(url, timeout=10)
        if response.status_code == 201 or response.status_code == 200:
            logger.info(f"✓ Collection '{name}' créée via le service d'embedding!")
            return True
        else:
            logger.error(f"❌ Erreur lors de la création de la collection '{name}' via le service: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Exception lors de la création de la collection '{name}' via le service: {e}")
        return False

def load_business_queries():
    """Charger les requêtes métier depuis les fichiers JSON"""
    logger.info(f"Chargement des requêtes métier depuis le dossier: {QUERIES_FOLDER}")
    
    # Vérifier si le dossier existe
    if not os.path.exists(QUERIES_FOLDER):
        logger.error(f"❌ Le dossier des requêtes {QUERIES_FOLDER} n'existe pas!")
        return False
    
    # Récupérer tous les fichiers de requêtes
    query_files = glob.glob(os.path.join(QUERIES_FOLDER, "*.query.json"))
    
    if not query_files:
        logger.error(f"❌ Aucun fichier de requête trouvé dans {QUERIES_FOLDER}")
        return False
    
    logger.info(f"Fichiers de requêtes trouvés: {len(query_files)}")
    
    total_queries = 0
    indexed_queries = 0
    
    # Traiter chaque fichier de requêtes
    for query_file in query_files:
        file_name = os.path.basename(query_file)
        logger.info(f"Traitement du fichier: {file_name}")
        
        try:
            with open(query_file, 'r', encoding='utf-8') as f:
                query_data = json.load(f)
                
            if "queries" not in query_data:
                logger.warning(f"❌ Format invalide dans {file_name} (clé 'queries' manquante)")
                continue
                
            queries = query_data["queries"]
            total_queries += len(queries)
            
            # Traiter chaque requête
            for query in queries:
                if "id" not in query or "questions" not in query or "sql" not in query:
                    logger.warning(f"❌ Requête invalide dans {file_name} (champs requis manquants)")
                    continue
                
                # Construire le document à indexer
                doc_id = query["id"]
                questions = query["questions"]
                primary_question = questions[0] if questions else ""
                
                # Consolider toutes les informations sur la requête
                content = {
                    "id": doc_id,
                    "questions": questions,
                    "primary_question": primary_question,
                    "sql": query["sql"],
                    "description": query.get("description", ""),
                    "parameters": query.get("parameters", []),
                    "source_file": file_name,
                    "type": "business_query"
                }
                
                # Indexer via le service d'embedding
                indexed = index_query_via_service(content)
                if indexed:
                    indexed_queries += 1
                    
        except Exception as e:
            logger.error(f"❌ Erreur lors du traitement du fichier {file_name}: {e}")
    
    logger.info(f"✓ Traitement terminé: {indexed_queries}/{total_queries} requêtes indexées")
    return indexed_queries > 0

def index_query_via_service(query_content):
    """Indexer une requête métier via le service d'embedding"""
    try:
        session = create_session_with_retry()
        url = f"{EMBEDDING_SERVICE_URL}/embedding/document"
        # Créer un document pour le service d'embedding
        document = {
            "id": query_content["id"],
            "content": query_content["description"] if query_content["description"] else query_content["primary_question"],
            "metadata": query_content,
            "collection_name": "business_queries"
        }
        
        response = session.post(url, json=document, timeout=30)  # Augmenté le timeout
        
        if response.status_code == 201 or response.status_code == 200:
            logger.info(f"✓ Requête '{query_content['id']}' indexée avec succès!")
            return True
        else:
            logger.error(f"❌ Erreur lors de l'indexation de la requête '{query_content['id']}': {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Exception lors de l'indexation de la requête '{query_content['id']}': {e}")
        return False

def main():
    """Fonction principale"""
    logger.info("Démarrage du script d'initialisation pour ChromaDB...")
    
    # D'abord attendre que les services soient prêts
    wait_time = int(os.environ.get("INITIAL_WAIT_TIME", "30"))
    logger.info(f"Attente initiale de {wait_time} secondes...")
    time.sleep(wait_time)
    
    # Attendre que ChromaDB soit prêt
    if not wait_for_chroma():
        logger.error("❌ ChromaDB n'est pas disponible, mais on continue avec les autres tâches...")
    
    # Attendre que le service d'embedding soit prêt
    if not wait_for_embedding_service():
        logger.error("❌ Service d'embedding n'est pas disponible, mais on continue avec les autres tâches...")
    
    # Initialiser le client ChromaDB
    client = init_chroma_client()
    if client:
        # Créer les collections
        create_collections(client)
        
        # Essayer également de créer les collections via le service d'embedding
        logger.info("Tentative de création des collections via le service d'embedding...")
        for name in COLLECTION_NAMES:
            create_collection_via_service(name)
        
        # Charger et indexer les requêtes métier
        logger.info("Chargement et indexation des requêtes métier...")
        load_business_queries()
    else:
        logger.error("❌ Impossible d'initialiser le client ChromaDB")
    
    logger.info("Initialisation terminée!")
    return True

if __name__ == "__main__":
    main() 