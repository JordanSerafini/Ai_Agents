.PHONY: up down build restart restart++ down++

build:
	docker-compose build && docker-compose up 

up:
	docker-compose up

down:
	docker-compose down

down++:
	docker-compose down -v --remove-orphans

restart:
		docker-compose down
		docker-compose up 

restart++:
	docker-compose down -v --remove-orphans && make build

