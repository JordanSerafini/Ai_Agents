.PHONY: help build up down restart logs ps clean prune pull-mistral

# Variables
DOCKER_COMPOSE = docker-compose
OLLAMA_CONTAINER = ollama

# Couleurs pour les messages (compatible avec Windows)
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m

help:
	@echo "$(GREEN)Commandes disponibles:$(NC)"
	@echo "  $(YELLOW)make build$(NC)        - Construit les images Docker"
	@echo "  $(YELLOW)make up$(NC)           - Démarre tous les conteneurs en arrière-plan"
	@echo "  $(YELLOW)make up-fg$(NC)        - Démarre tous les conteneurs en premier plan (avec logs)"
	@echo "  $(YELLOW)make down$(NC)         - Arrête tous les conteneurs"
	@echo "  $(YELLOW)make restart$(NC)      - Redémarre tous les conteneurs"
	@echo "  $(YELLOW)make logs$(NC)         - Affiche les logs de tous les conteneurs"
	@echo "  $(YELLOW)make ps$(NC)           - Liste tous les conteneurs"
	@echo "  $(YELLOW)make clean$(NC)        - Arrête et supprime tous les conteneurs"
	@echo "  $(YELLOW)make prune$(NC)        - Nettoie les ressources Docker non utilisées"
	@echo "  $(YELLOW)make pull-mistral$(NC) - Télécharge le modèle Mistral dans Ollama"
	@echo "  $(YELLOW)make setup$(NC)        - Configuration complète (build, up, pull-mistral)"

build:
	@echo "$(GREEN)Construction des images Docker...$(NC)"
	$(DOCKER_COMPOSE) build

up:
	@echo "$(GREEN)Démarrage des conteneurs en arrière-plan...$(NC)"
	$(DOCKER_COMPOSE) up 

up-d:
	@echo "$(GREEN)Démarrage des conteneurs en premier plan...$(NC)"
	$(DOCKER_COMPOSE) up -d

down:
	@echo "$(GREEN)Arrêt des conteneurs...$(NC)"
	$(DOCKER_COMPOSE) down	

restart:
	@echo "$(GREEN)Redémarrage des conteneurs...$(NC)"
	$(DOCKER_COMPOSE) restart

logs:
	@echo "$(GREEN)Affichage des logs...$(NC)"
	$(DOCKER_COMPOSE) logs -f

ps:
	@echo "$(GREEN)Liste des conteneurs...$(NC)"
	$(DOCKER_COMPOSE) ps

clean:
	@echo "$(GREEN)Nettoyage des conteneurs...$(NC)"
	$(DOCKER_COMPOSE) down -v --remove-orphans

prune:
	@echo "$(GREEN)Nettoyage des ressources Docker non utilisées...$(NC)"
	docker system prune -af --volumes

pull-mistral:
	@echo "$(GREEN)Téléchargement du modèle Mistral...$(NC)"
	@echo "$(YELLOW)Attente du démarrage d'Ollama...$(NC)"
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		if docker exec -i $(OLLAMA_CONTAINER) ollama list > /dev/null 2>&1; then \
			echo "$(GREEN)Ollama est prêt. Téléchargement du modèle Mistral...$(NC)"; \
			docker exec -i $(OLLAMA_CONTAINER) ollama pull mistral; \
			exit 0; \
		fi; \
		echo "$(YELLOW)Ollama n'est pas encore prêt, nouvelle tentative dans 5 secondes...$(NC)"; \
		sleep 5; \
	done; \
	echo "$(RED)Impossible de se connecter à Ollama après plusieurs tentatives.$(NC)"; \
	exit 1

setup: build up pull-mistral
	@echo "$(GREEN)Configuration terminée avec succès!$(NC)"
	@echo "$(GREEN)Services disponibles :$(NC)"
	@echo "$(GREEN)- Analyse Agent: http://localhost:3001$(NC)"
	@echo "$(GREEN)- Ollama API: http://localhost:11434$(NC)"
	@echo "$(GREEN)- MongoDB: mongodb://localhost:27017$(NC)" 