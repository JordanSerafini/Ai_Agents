PHONY: build up down clean restart upd

build:
	docker compose build && docker compose up 

up:
	docker compose up 

upd:
	docker compose up -d
down:
	docker compose down

clean:
	docker compose down -v --rmi all --remove-orphans

restart:
	make down && make up
