import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TableMetadata {
  name: string;
  description: string;
  columns: ColumnMetadata[];
  relationships: RelationshipMetadata[];
}

export interface ColumnMetadata {
  name: string;
  type: string;
  description: string;
  isPrimary: boolean;
  isForeign: boolean;
  isRequired: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface RelationshipMetadata {
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  targetTable: string;
  sourceColumn: string;
  targetColumn: string;
  description: string;
}

export interface EnumType {
  name: string;
  values: string[];
  description: string;
}

@Injectable()
export class DatabaseMetadataService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMetadataService.name);
  private tables: TableMetadata[] = [];
  private enums: EnumType[] = [];

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.logger.log('Initialisation des métadonnées de la base de données...');
    this.initializeMetadata();
    this.logger.log(
      `Métadonnées initialisées: ${this.tables.length} tables, ${this.enums.length} types énumérés`,
    );
  }

  private initializeMetadata() {
    // Initialisation des types énumérés
    this.initializeEnumTypes();

    // Initialisation des tables
    this.initializeTables();

    // Initialisation des relations
    this.initializeRelationships();
  }

  private initializeEnumTypes() {
    this.enums = [
      {
        name: 'quotation_status',
        values: ['en_attente', 'accepté', 'refusé'],
        description: "Statut d'un devis",
      },
      {
        name: 'product_category',
        values: ['matériaux', 'main_doeuvre', 'transport', 'autres'],
        description: "Catégorie d'un produit dans un devis",
      },
      {
        name: 'event_type',
        values: [
          'appel_telephonique',
          'reunion_chantier',
          'visite_technique',
          'rendez_vous_client',
          'reunion_interne',
          'formation',
          'livraison_materiaux',
          'intervention_urgente',
          'maintenance',
          'autre',
        ],
        description: "Type d'événement dans le calendrier",
      },
      {
        name: 'project_status',
        values: ['prospect', 'en_cours', 'termine', 'en_pause', 'annule'],
        description: "Statut d'un projet",
      },
    ];
  }

  private initializeTables() {
    // Table roles
    this.tables.push({
      name: 'roles',
      description: 'Rôles des utilisateurs dans le système',
      columns: [
        {
          name: 'id',
          type: 'SERIAL',
          description: 'Identifiant unique du rôle',
          isPrimary: true,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'name',
          type: 'VARCHAR(50)',
          description: 'Nom du rôle',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'created_at',
          type: 'TIMESTAMP',
          description: 'Date de création',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'updated_at',
          type: 'TIMESTAMP',
          description: 'Date de dernière mise à jour',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
      ],
      relationships: [],
    });

    // Table staff
    this.tables.push({
      name: 'staff',
      description: "Personnel de l'entreprise",
      columns: [
        {
          name: 'id',
          type: 'SERIAL',
          description: 'Identifiant unique du membre du personnel',
          isPrimary: true,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'firstname',
          type: 'VARCHAR(100)',
          description: 'Prénom',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'lastname',
          type: 'VARCHAR(100)',
          description: 'Nom de famille',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'email',
          type: 'VARCHAR(255)',
          description: 'Adresse email',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'role',
          type: 'VARCHAR(50)',
          description: "Rôle dans l'entreprise",
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'phone',
          type: 'VARCHAR(20)',
          description: 'Numéro de téléphone',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'is_available',
          type: 'BOOLEAN',
          description: 'Disponibilité',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'created_at',
          type: 'TIMESTAMP',
          description: 'Date de création',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'updated_at',
          type: 'TIMESTAMP',
          description: 'Date de dernière mise à jour',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
      ],
      relationships: [],
    });

    // Table clients
    this.tables.push({
      name: 'clients',
      description: "Clients de l'entreprise",
      columns: [
        {
          name: 'id',
          type: 'SERIAL',
          description: 'Identifiant unique du client',
          isPrimary: true,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'firstname',
          type: 'VARCHAR(100)',
          description: 'Prénom',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'lastname',
          type: 'VARCHAR(100)',
          description: 'Nom de famille',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'street_number',
          type: 'VARCHAR(10)',
          description: 'Numéro de rue',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'street_name',
          type: 'VARCHAR(255)',
          description: 'Nom de rue',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'zip_code',
          type: 'VARCHAR(10)',
          description: 'Code postal',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'city',
          type: 'VARCHAR(100)',
          description: 'Ville',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'email',
          type: 'VARCHAR(255)',
          description: 'Adresse email',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'phone',
          type: 'VARCHAR(20)',
          description: 'Numéro de téléphone',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'created_at',
          type: 'TIMESTAMP',
          description: 'Date de création',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'updated_at',
          type: 'TIMESTAMP',
          description: 'Date de dernière mise à jour',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
      ],
      relationships: [],
    });

    // Table projects
    this.tables.push({
      name: 'projects',
      description: 'Projets de construction',
      columns: [
        {
          name: 'id',
          type: 'SERIAL',
          description: 'Identifiant unique du projet',
          isPrimary: true,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'client_id',
          type: 'INTEGER',
          description: 'Identifiant du client',
          isPrimary: false,
          isForeign: true,
          isRequired: true,
          references: { table: 'clients', column: 'id' },
        },
        {
          name: 'name',
          type: 'VARCHAR(255)',
          description: 'Nom du projet',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'description',
          type: 'TEXT',
          description: 'Description du projet',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'street_number',
          type: 'VARCHAR(10)',
          description: 'Numéro de rue du chantier',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'street_name',
          type: 'VARCHAR(255)',
          description: 'Nom de rue du chantier',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'zip_code',
          type: 'VARCHAR(10)',
          description: 'Code postal du chantier',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'city',
          type: 'VARCHAR(100)',
          description: 'Ville du chantier',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'start_date',
          type: 'DATE',
          description: 'Date de début du projet',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'end_date',
          type: 'DATE',
          description: 'Date de fin prévue du projet',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'status',
          type: 'project_status',
          description: 'Statut du projet',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'created_at',
          type: 'TIMESTAMP',
          description: 'Date de création',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'updated_at',
          type: 'TIMESTAMP',
          description: 'Date de dernière mise à jour',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
      ],
      relationships: [],
    });

    // Table materials
    this.tables.push({
      name: 'materials',
      description: 'Matériaux de construction',
      columns: [
        {
          name: 'id',
          type: 'SERIAL',
          description: 'Identifiant unique du matériau',
          isPrimary: true,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'name',
          type: 'VARCHAR(255)',
          description: 'Nom du matériau',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'description',
          type: 'TEXT',
          description: 'Description du matériau',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'unit',
          type: 'VARCHAR(50)',
          description: 'Unité de mesure',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'price',
          type: 'DECIMAL(10,2)',
          description: 'Prix unitaire',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'quantity',
          type: 'INT',
          description: 'Quantité en stock',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'created_at',
          type: 'TIMESTAMP',
          description: 'Date de création',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
        {
          name: 'updated_at',
          type: 'TIMESTAMP',
          description: 'Date de dernière mise à jour',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
      ],
      relationships: [],
    });

    // Table quotations
    this.tables.push({
      name: 'quotations',
      description:
        'Table des devis contenant les offres commerciales proposées aux clients, incluant les statuts (accepté, en attente, etc.) et les montants totaux. Utilisée pour les questions sur les devis, les offres et les propositions commerciales.',
      columns: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique du devis',
          isPrimary: true,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'client_id',
          type: 'uuid',
          description: 'Identifiant du client lié au devis',
          isPrimary: false,
          isForeign: true,
          isRequired: true,
          references: {
            table: 'clients',
            column: 'id',
          },
        },
        {
          name: 'total_amount',
          type: 'decimal',
          description: 'Montant total du devis',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'status',
          type: 'enum',
          description: 'Statut du devis (en attente, accepté, refusé, expiré)',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'created_at',
          type: 'timestamp',
          description: 'Date de création du devis',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'updated_at',
          type: 'timestamp',
          description: 'Date de dernière modification du devis',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'valid_until',
          type: 'timestamp',
          description: 'Date de validité du devis',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
      ],
      relationships: [],
    });

    // Table invoices
    this.tables.push({
      name: 'invoices',
      description:
        "Table des factures contenant les montants facturés aux clients, les dates d'échéance et les statuts de paiement. Utilisée pour les questions sur les factures, les paiements et les montants dus.",
      columns: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique de la facture',
          isPrimary: true,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'client_id',
          type: 'uuid',
          description: 'Identifiant du client lié à la facture',
          isPrimary: false,
          isForeign: true,
          isRequired: true,
          references: {
            table: 'clients',
            column: 'id',
          },
        },
        {
          name: 'total_amount',
          type: 'decimal',
          description: 'Montant total de la facture',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'status',
          type: 'enum',
          description:
            'Statut de la facture (émise, payée, en retard, annulée)',
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'issue_date',
          type: 'timestamp',
          description: "Date d'émission de la facture",
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'due_date',
          type: 'timestamp',
          description: "Date d'échéance de la facture",
          isPrimary: false,
          isForeign: false,
          isRequired: true,
        },
        {
          name: 'payment_date',
          type: 'timestamp',
          description: 'Date de paiement de la facture',
          isPrimary: false,
          isForeign: false,
          isRequired: false,
        },
      ],
      relationships: [],
    });

    // Ajout des autres tables...
    // Pour garder le code concis, j'ai inclus seulement quelques tables principales
    // Dans une implémentation complète, toutes les tables seraient définies ici
  }

  private initializeRelationships() {
    // Définition des relations entre les tables

    // Relations pour projects
    const projectsTable = this.tables.find((t) => t.name === 'projects');
    if (projectsTable) {
      projectsTable.relationships.push({
        type: 'many-to-one',
        targetTable: 'clients',
        sourceColumn: 'client_id',
        targetColumn: 'id',
        description: 'Chaque projet appartient à un client',
      });
    }

    // Relations pour quotations
    const quotationsTable = this.tables.find((t) => t.name === 'quotations');
    if (quotationsTable) {
      quotationsTable.relationships.push({
        type: 'many-to-one',
        targetTable: 'projects',
        sourceColumn: 'project_id',
        targetColumn: 'id',
        description: 'Chaque devis est associé à un projet',
      });
    }

    // Ajout d'autres relations...
    // Dans une implémentation complète, toutes les relations seraient définies ici
  }

  /**
   * Récupère toutes les métadonnées des tables
   */
  getAllTables(): TableMetadata[] {
    return this.tables;
  }

  /**
   * Récupère les métadonnées d'une table spécifique
   */
  getTable(tableName: string): TableMetadata | undefined {
    return this.tables.find((t) => t.name === tableName);
  }

  /**
   * Récupère tous les types énumérés
   */
  getAllEnums(): EnumType[] {
    return this.enums;
  }

  /**
   * Récupère un type énuméré spécifique
   */
  getEnum(enumName: string): EnumType | undefined {
    return this.enums.find((e) => e.name === enumName);
  }

  /**
   * Génère une description textuelle de la structure de la base de données
   */
  getDatabaseDescription(): string {
    let description = 'Structure de la base de données Technidalle:\n\n';

    // Description des tables
    description += 'Tables principales:\n';
    this.tables.forEach((table) => {
      description += `- ${table.name}: ${table.description}\n`;
      description += `  Colonnes principales: ${table.columns
        .filter((c) => c.isPrimary || c.isRequired)
        .map((c) => c.name)
        .join(', ')}\n`;
    });

    // Description des relations
    description += '\nRelations principales:\n';
    this.tables.forEach((table) => {
      if (table.relationships.length > 0) {
        table.relationships.forEach((rel) => {
          description += `- ${table.name} ${this.getRelationshipSymbol(rel.type)} ${rel.targetTable}: ${rel.description}\n`;
        });
      }
    });

    return description;
  }

  private getRelationshipSymbol(type: string): string {
    switch (type) {
      case 'one-to-one':
        return '1:1';
      case 'one-to-many':
        return '1:N';
      case 'many-to-one':
        return 'N:1';
      case 'many-to-many':
        return 'N:M';
      default:
        return '?';
    }
  }
}
