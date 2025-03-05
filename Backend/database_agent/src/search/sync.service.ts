import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { DatabaseService } from '../database/database.service';
import { Cron } from '@nestjs/schedule';
import { SearchService } from './search.service';
import { ConfigService } from '@nestjs/config';

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

  // Taille des lots pour l'indexation en masse
  private readonly BULK_SIZE = 100;
  // Nombre maximum de tentatives en cas d'échec
  private readonly MAX_RETRIES = 3;
  // Délai initial entre les tentatives (en ms)
  private readonly INITIAL_BACKOFF = 1000;

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly databaseService: DatabaseService,
    private readonly searchService: SearchService,
    private readonly configService: ConfigService,
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
  @Cron('0 0 * * *') // Tous les jours à minuit
  async syncAll(): Promise<void> {
    this.logger.log('Démarrage de la synchronisation complète...');

    try {
      // Synchroniser les clients
      await this.syncClients();

      // Synchroniser les projets
      await this.syncProjects();

      // Synchroniser les documents
      await this.syncDocuments();

      // Synchroniser les fournisseurs
      await this.syncSuppliers();

      // Synchroniser les équipements
      await this.syncEquipment();

      // Synchroniser les tâches
      await this.syncTasks();

      this.logger.log('Synchronisation complète terminée avec succès');
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation complète: ${error.message}`,
      );
    }
  }

  /**
   * Synchronise une entité spécifique
   * @param entity Type d'entité
   * @param id ID de l'entité
   */
  async syncEntity(entity: string, id: number): Promise<void> {
    try {
      this.logger.log(
        `Synchronisation de l'entité ${entity} avec l'ID ${id}...`,
      );

      switch (entity) {
        case 'projects':
          await this.syncProject(id);
          break;
        case 'clients':
          await this.syncClient(id);
          break;
        case 'documents':
          await this.syncDocument(id);
          break;
        case 'suppliers':
          await this.syncSupplier(id);
          break;
        case 'equipment':
          await this.syncEquipmentItem(id);
          break;
        case 'tasks':
          await this.syncTask(id);
          break;
        default:
          throw new Error(`Type d'entité non pris en charge: ${entity}`);
      }

      this.logger.log(
        `Synchronisation de l'entité ${entity} avec l'ID ${id} terminée`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation de l'entité ${entity} avec l'ID ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Supprime une entité de l'index
   * @param entity Type d'entité
   * @param id ID de l'entité
   */
  async deleteEntity(entity: string, id: number): Promise<void> {
    try {
      this.logger.log(`Suppression de l'entité ${entity} avec l'ID ${id}...`);

      const index = this.indices[entity];
      if (!index) {
        throw new Error(`Type d'entité non pris en charge: ${entity}`);
      }

      await this.elasticsearchService.delete({
        index,
        id: id.toString(),
      });

      this.logger.log(`Entité ${entity} avec l'ID ${id} supprimée avec succès`);
    } catch (error) {
      // Si l'entité n'existe pas, on ignore l'erreur
      if (error.meta && error.meta.statusCode === 404) {
        this.logger.warn(
          `L'entité ${entity} avec l'ID ${id} n'existe pas dans l'index`,
        );
        return;
      }

      this.logger.error(
        `Erreur lors de la suppression de l'entité ${entity} avec l'ID ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Synchronise les projets
   */
  private async syncProjects(): Promise<void> {
    try {
      this.logger.log('Synchronisation des projets...');

      // Récupérer tous les projets avec leur date de dernière mise à jour
      const projects = await this.databaseService.executeQuery(`
        SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name,
               (SELECT STRING_AGG(tag_name, ',') FROM project_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.project_id = p.id) as tags,
               (SELECT category_name FROM project_categories pc JOIN categories c ON pc.category_id = c.id WHERE pc.project_id = p.id LIMIT 1) as category
        FROM projects p
        JOIN clients c ON p.client_id = c.id
        ORDER BY p.id
      `);

      if (!projects || projects.length === 0) {
        this.logger.log('Aucun projet à synchroniser');
        return;
      }

      // Synchroniser par lots
      await this.bulkIndex(this.indices.projects, projects, this.formatProject);

      this.logger.log(`${projects.length} projets synchronisés avec succès`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation des projets: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Synchronise un projet spécifique
   * @param id ID du projet
   */
  private async syncProject(id: number): Promise<void> {
    try {
      // Récupérer le projet avec les informations du client
      const projects = await this.databaseService.executeQuery(
        `
        SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name,
               (SELECT STRING_AGG(tag_name, ',') FROM project_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.project_id = p.id) as tags,
               (SELECT category_name FROM project_categories pc JOIN categories c ON pc.category_id = c.id WHERE pc.project_id = p.id LIMIT 1) as category
        FROM projects p
        JOIN clients c ON p.client_id = c.id
        WHERE p.id = $1
      `,
        [id],
      );

      if (!projects || projects.length === 0) {
        throw new Error(`Projet avec l'ID ${id} non trouvé`);
      }

      const project = projects[0];

      // Indexer le projet
      await this.indexWithRetry(
        this.indices.projects,
        project.id.toString(),
        this.formatProject(project),
      );

      this.logger.log(`Projet avec l'ID ${id} synchronisé avec succès`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation du projet avec l'ID ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Synchronise les clients
   */
  private async syncClients(): Promise<void> {
    try {
      this.logger.log('Synchronisation des clients...');

      // Récupérer tous les clients
      const clients = await this.databaseService.executeQuery(`
        SELECT c.*, 
               (SELECT company_name FROM client_companies WHERE client_id = c.id LIMIT 1) as company,
               (SELECT client_type FROM client_types WHERE client_id = c.id LIMIT 1) as type
        FROM clients c
        ORDER BY c.id
      `);

      if (!clients || clients.length === 0) {
        this.logger.log('Aucun client à synchroniser');
        return;
      }

      // Synchroniser par lots
      await this.bulkIndex(this.indices.clients, clients, this.formatClient);

      this.logger.log(`${clients.length} clients synchronisés avec succès`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation des clients: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Synchronise un client spécifique
   * @param id ID du client
   */
  private async syncClient(id: number): Promise<void> {
    try {
      // Récupérer le client
      const clients = await this.databaseService.executeQuery(
        `
        SELECT c.*, 
               (SELECT company_name FROM client_companies WHERE client_id = c.id LIMIT 1) as company,
               (SELECT client_type FROM client_types WHERE client_id = c.id LIMIT 1) as type
        FROM clients c
        WHERE c.id = $1
      `,
        [id],
      );

      if (!clients || clients.length === 0) {
        throw new Error(`Client avec l'ID ${id} non trouvé`);
      }

      const client = clients[0];

      // Indexer le client
      await this.indexWithRetry(
        this.indices.clients,
        client.id.toString(),
        this.formatClient(client),
      );

      this.logger.log(`Client avec l'ID ${id} synchronisé avec succès`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la synchronisation du client avec l'ID ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Synchronise les documents
   */
  private async syncDocuments(): Promise<void> {
    // Implémentation similaire à syncProjects
    // ...
  }

  /**
   * Synchronise un document spécifique
   * @param id ID du document
   */
  private async syncDocument(id: number): Promise<void> {
    // Implémentation similaire à syncProject
    // ...
  }

  /**
   * Synchronise les fournisseurs
   */
  private async syncSuppliers(): Promise<void> {
    // Implémentation similaire à syncProjects
    // ...
  }

  /**
   * Synchronise un fournisseur spécifique
   * @param id ID du fournisseur
   */
  private async syncSupplier(id: number): Promise<void> {
    // Implémentation similaire à syncProject
    // ...
  }

  /**
   * Synchronise les équipements
   */
  private async syncEquipment(): Promise<void> {
    // Implémentation similaire à syncProjects
    // ...
  }

  /**
   * Synchronise un équipement spécifique
   * @param id ID de l'équipement
   */
  private async syncEquipmentItem(id: number): Promise<void> {
    // Implémentation similaire à syncProject
    // ...
  }

  /**
   * Synchronise les tâches
   */
  private async syncTasks(): Promise<void> {
    // Implémentation similaire à syncProjects
    // ...
  }

  /**
   * Synchronise une tâche spécifique
   * @param id ID de la tâche
   */
  private async syncTask(id: number): Promise<void> {
    // Implémentation similaire à syncProject
    // ...
  }

  /**
   * Indexe un document avec mécanisme de retry
   * @param index Nom de l'index
   * @param id ID du document
   * @param document Document à indexer
   * @param retryCount Nombre de tentatives actuelles
   */
  private async indexWithRetry(
    index: string,
    id: string,
    document: any,
    retryCount = 0,
  ): Promise<void> {
    try {
      await this.elasticsearchService.index({
        index,
        id,
        document,
        refresh: true,
      });
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        // Backoff exponentiel
        const delay = this.INITIAL_BACKOFF * Math.pow(2, retryCount);
        this.logger.warn(
          `Erreur lors de l'indexation, nouvelle tentative dans ${delay}ms: ${error.message}`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));

        return this.indexWithRetry(index, id, document, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Indexe des documents par lots
   * @param index Nom de l'index
   * @param items Documents à indexer
   * @param formatter Fonction de formatage des documents
   */
  private async bulkIndex<T>(
    index: string,
    items: T[],
    formatter: (item: T) => any,
  ): Promise<void> {
    if (!items || items.length === 0) return;

    // Diviser les éléments en lots
    for (let i = 0; i < items.length; i += this.BULK_SIZE) {
      const batch = items.slice(i, i + this.BULK_SIZE);

      try {
        const operations = batch.flatMap((item) => {
          const formattedItem = formatter(item);
          return [
            { index: { _index: index, _id: formattedItem.id.toString() } },
            formattedItem,
          ];
        });

        const { errors, items: responseItems } =
          await this.elasticsearchService.bulk({
            refresh: true,
            operations,
          });

        if (errors) {
          // Traiter les erreurs individuelles
          const failedItems = responseItems
            .filter((item) => item.index && item.index.error)
            .map((item) => ({
              id: item.index._id,
              error: item.index.error,
            }));

          this.logger.warn(
            `Erreurs lors de l'indexation par lots: ${JSON.stringify(failedItems)}`,
          );
        }

        this.logger.log(`Lot de ${batch.length} éléments indexé avec succès`);
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'indexation par lots: ${error.message}`,
        );
        throw error;
      }
    }
  }

  /**
   * Formate un projet pour l'indexation
   * @param project Projet à formater
   */
  private formatProject(project: any): any {
    const tags = project.tags ? project.tags.split(',') : [];

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      client_id: project.client_id,
      client_name: project.client_name,
      start_date: project.start_date,
      end_date: project.end_date,
      city: project.city,
      zip_code: project.zip_code,
      street_name: project.street_name,
      created_at: project.created_at,
      updated_at: project.updated_at || project.created_at,
      budget: project.budget || 0,
      category: project.category || 'Non catégorisé',
      tags: tags,
    };
  }

  /**
   * Formate un client pour l'indexation
   * @param client Client à formater
   */
  private formatClient(client: any): any {
    return {
      id: client.id,
      firstname: client.firstname,
      lastname: client.lastname,
      email: client.email,
      phone: client.phone,
      city: client.city,
      zip_code: client.zip_code,
      created_at: client.created_at,
      updated_at: client.updated_at || client.created_at,
      company: client.company || '',
      type: client.type || 'Particulier',
    };
  }

  // Autres méthodes de formatage...
}
