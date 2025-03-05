import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { DatabaseService } from '../database/database.service';
import { Cron } from '@nestjs/schedule';
import { SearchService } from './search.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly indices = {
    projects: 'projects',
    clients: 'clients',
    tasks: 'tasks',
    documents: 'documents',
    suppliers: 'suppliers',
    equipment: 'equipment',
  };

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly databaseService: DatabaseService,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Initialise les indices et synchronise les données
   */
  async initializeIndices(): Promise<void> {
    try {
      this.logger.log('Initialisation des indices Elasticsearch...');

      // Vérifier et créer les indices si nécessaire
      for (const index of Object.values(this.indices)) {
        await this.searchService.checkIndex(index);
      }

      // Synchroniser les données
      await this.syncAll();

      this.logger.log('Initialisation des indices terminée avec succès');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation des indices: ${error.message}`,
      );
    }
  }

  /**
   * Synchronise toutes les entités
   */
  async syncAll(): Promise<void> {
    try {
      this.logger.log('Démarrage de la synchronisation complète...');

      await this.syncProjects();
      await this.syncClients();
      await this.syncDocuments();
      await this.syncSuppliers();

      this.logger.log('Synchronisation complète terminée avec succès');
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation complète: ${error.message}`,
      );
    }
  }

  /**
   * Synchronise les projets
   */
  async syncProjects(): Promise<void> {
    try {
      this.logger.log('Synchronisation des projets...');

      // Récupérer tous les projets de PostgreSQL
      const projects = await this.databaseService.executeQuery(`
        SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
        FROM projects p
        JOIN clients c ON p.client_id = c.id
      `);

      if (projects.length === 0) {
        this.logger.log('Aucun projet à synchroniser');
        return;
      }

      // Indexer les projets dans Elasticsearch
      const operations = projects.flatMap((project) => [
        {
          index: { _index: this.indices.projects, _id: project.id.toString() },
        },
        project,
      ]);

      const { body } = await this.elasticsearchService.bulk({
        refresh: true,
        body: operations,
      });

      if (body.errors) {
        const errorItems = body.items.filter((item) => item.index.error);
        this.logger.error(
          `Erreurs lors de l'indexation des projets: ${JSON.stringify(errorItems)}`,
        );
      }

      this.logger.log(
        `Synchronisation des projets terminée: ${projects.length} projets indexés`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation des projets: ${error.message}`,
      );
    }
  }

  /**
   * Synchronise les clients
   */
  async syncClients(): Promise<void> {
    try {
      this.logger.log('Synchronisation des clients...');

      // Récupérer tous les clients de PostgreSQL
      const clients = await this.databaseService.executeQuery(`
        SELECT * FROM clients
      `);

      if (clients.length === 0) {
        this.logger.log('Aucun client à synchroniser');
        return;
      }

      // Indexer les clients dans Elasticsearch
      const operations = clients.flatMap((client) => [
        { index: { _index: this.indices.clients, _id: client.id.toString() } },
        client,
      ]);

      const { body } = await this.elasticsearchService.bulk({
        refresh: true,
        body: operations,
      });

      if (body.errors) {
        const errorItems = body.items.filter((item) => item.index.error);
        this.logger.error(
          `Erreurs lors de l'indexation des clients: ${JSON.stringify(errorItems)}`,
        );
      }

      this.logger.log(
        `Synchronisation des clients terminée: ${clients.length} clients indexés`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation des clients: ${error.message}`,
      );
    }
  }

  /**
   * Synchronise les documents
   */
  async syncDocuments(): Promise<void> {
    try {
      this.logger.log('Synchronisation des documents...');

      // Récupérer tous les documents de PostgreSQL
      const documents = await this.databaseService.executeQuery(`
        SELECT * FROM documents
      `);

      if (documents.length === 0) {
        this.logger.log('Aucun document à synchroniser');
        return;
      }

      // Indexer les documents dans Elasticsearch
      const operations = documents.flatMap((document) => [
        {
          index: {
            _index: this.indices.documents,
            _id: document.id.toString(),
          },
        },
        document,
      ]);

      const { body } = await this.elasticsearchService.bulk({
        refresh: true,
        body: operations,
      });

      if (body.errors) {
        const errorItems = body.items.filter((item) => item.index.error);
        this.logger.error(
          `Erreurs lors de l'indexation des documents: ${JSON.stringify(errorItems)}`,
        );
      }

      this.logger.log(
        `Synchronisation des documents terminée: ${documents.length} documents indexés`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation des documents: ${error.message}`,
      );
    }
  }

  /**
   * Synchronise les fournisseurs
   */
  async syncSuppliers(): Promise<void> {
    try {
      this.logger.log('Synchronisation des fournisseurs...');

      // Récupérer tous les fournisseurs de PostgreSQL
      const suppliers = await this.databaseService.executeQuery(`
        SELECT * FROM suppliers
      `);

      if (suppliers.length === 0) {
        this.logger.log('Aucun fournisseur à synchroniser');
        return;
      }

      // Indexer les fournisseurs dans Elasticsearch
      const operations = suppliers.flatMap((supplier) => [
        {
          index: {
            _index: this.indices.suppliers,
            _id: supplier.id.toString(),
          },
        },
        supplier,
      ]);

      const { body } = await this.elasticsearchService.bulk({
        refresh: true,
        body: operations,
      });

      if (body.errors) {
        const errorItems = body.items.filter((item) => item.index.error);
        this.logger.error(
          `Erreurs lors de l'indexation des fournisseurs: ${JSON.stringify(errorItems)}`,
        );
      }

      this.logger.log(
        `Synchronisation des fournisseurs terminée: ${suppliers.length} fournisseurs indexés`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation des fournisseurs: ${error.message}`,
      );
    }
  }

  /**
   * Synchronisation périodique (toutes les heures)
   */
  @Cron('0 * * * *')
  async handleCronSync() {
    this.logger.log('Exécution de la synchronisation périodique');
    await this.syncAll();
  }

  /**
   * Synchronisation à la demande pour une entité spécifique
   * @param entityType Type d'entité
   * @param entityId ID de l'entité
   */
  async syncEntity(entityType: string, entityId: number): Promise<void> {
    try {
      this.logger.log(
        `Synchronisation de l'entité ${entityType} avec l'ID ${entityId}`,
      );

      let entity;
      let indexName;

      switch (entityType) {
        case 'project':
          entity = await this.databaseService.executeQuery(
            `SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
             FROM projects p
             JOIN clients c ON p.client_id = c.id
             WHERE p.id = $1`,
            [entityId],
          );
          indexName = this.indices.projects;
          break;
        case 'client':
          entity = await this.databaseService.executeQuery(
            'SELECT * FROM clients WHERE id = $1',
            [entityId],
          );
          indexName = this.indices.clients;
          break;
        case 'document':
          entity = await this.databaseService.executeQuery(
            'SELECT * FROM documents WHERE id = $1',
            [entityId],
          );
          indexName = this.indices.documents;
          break;
        case 'supplier':
          entity = await this.databaseService.executeQuery(
            'SELECT * FROM suppliers WHERE id = $1',
            [entityId],
          );
          indexName = this.indices.suppliers;
          break;
        default:
          throw new Error(`Type d'entité non pris en charge: ${entityType}`);
      }

      if (!entity || entity.length === 0) {
        this.logger.warn(
          `Entité ${entityType} avec l'ID ${entityId} non trouvée`,
        );
        return;
      }

      // Indexer l'entité dans Elasticsearch
      await this.elasticsearchService.index({
        index: indexName,
        id: entityId.toString(),
        body: entity[0],
        refresh: true,
      });

      this.logger.log(
        `Synchronisation de l'entité ${entityType} avec l'ID ${entityId} terminée`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation de l'entité: ${error.message}`,
      );
    }
  }

  /**
   * Supprime une entité de l'index Elasticsearch
   * @param entityType Type d'entité
   * @param entityId ID de l'entité
   */
  async deleteEntity(entityType: string, entityId: number): Promise<void> {
    try {
      let indexName;

      switch (entityType) {
        case 'project':
          indexName = this.indices.projects;
          break;
        case 'client':
          indexName = this.indices.clients;
          break;
        case 'document':
          indexName = this.indices.documents;
          break;
        case 'supplier':
          indexName = this.indices.suppliers;
          break;
        default:
          throw new Error(`Type d'entité non pris en charge: ${entityType}`);
      }

      await this.elasticsearchService.delete({
        index: indexName,
        id: entityId.toString(),
        refresh: true,
      });

      this.logger.log(
        `Suppression de l'entité ${entityType} avec l'ID ${entityId} terminée`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression de l'entité: ${error.message}`,
      );
    }
  }
}
