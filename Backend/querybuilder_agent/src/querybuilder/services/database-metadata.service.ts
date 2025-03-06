import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

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
  private pool: Pool;
  private isConnected = false;
  private readonly useStaticData: boolean;

  constructor(private readonly configService: ConfigService) {
    // Déterminer si on utilise des données statiques ou une connexion à la base de données
    this.useStaticData =
      this.configService.get<string>('USE_STATIC_METADATA') === 'true';

    if (!this.useStaticData) {
      this.pool = new Pool({
        host: this.configService.get<string>('PG_HOST', 'localhost'),
        port: parseInt(this.configService.get<string>('PG_PORT', '5432')),
        user: this.configService.get<string>('PG_USERNAME', 'postgres'),
        password: this.configService.get<string>('PG_PASSWORD', 'postgres'),
        database: this.configService.get<string>('PG_DATABASE', 'postgres'),
      });
    }
  }

  async onModuleInit() {
    this.logger.log('Initialisation des métadonnées de la base de données...');

    if (this.useStaticData) {
      this.initializeStaticMetadata();
      this.logger.log(
        `Métadonnées statiques initialisées: ${this.tables.length} tables, ${this.enums.length} types énumérés`,
      );
    } else {
      try {
        await this.testConnection();
        await this.extractMetadataFromDatabase();
        this.logger.log(
          `Métadonnées extraites de la base de données: ${this.tables.length} tables, ${this.enums.length} types énumérés`,
        );
      } catch (error) {
        this.logger.error(
          `Erreur lors de la connexion à la base de données: ${error.message}`,
        );
        this.logger.warn(
          'Utilisation des métadonnées statiques comme fallback',
        );
        this.initializeStaticMetadata();
      }
    }
  }

  private async testConnection() {
    try {
      const client = await this.pool.connect();
      this.logger.log('Connexion à la base de données établie avec succès');
      client.release();
      this.isConnected = true;
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  private async extractMetadataFromDatabase() {
    if (!this.isConnected) {
      throw new Error('Non connecté à la base de données');
    }

    try {
      // Extraire les tables
      await this.extractTables();

      // Extraire les colonnes pour chaque table
      await this.extractColumns();

      // Extraire les relations entre tables
      await this.extractRelationships();

      // Extraire les types énumérés
      await this.extractEnumTypes();
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'extraction des métadonnées: ${error.message}`,
      );
      throw error;
    }
  }

  private async extractTables() {
    const query = `
      SELECT 
        table_name,
        obj_description(('"' || table_schema || '"."' || table_name || '"')::regclass, 'pg_class') as description
      FROM 
        information_schema.tables
      WHERE 
        table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY 
        table_name;
    `;

    const result = await this.pool.query(query);

    this.tables = result.rows.map((row) => ({
      name: row.table_name,
      description: row.description || `Table ${row.table_name}`,
      columns: [],
      relationships: [],
    }));
  }

  private async extractColumns() {
    for (const table of this.tables) {
      const query = `
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          pg_catalog.col_description(format('%s.%s', c.table_schema, c.table_name)::regclass::oid, c.ordinal_position) as description,
          tc.constraint_type
        FROM 
          information_schema.columns c
        LEFT JOIN 
          information_schema.constraint_column_usage ccu ON c.column_name = ccu.column_name AND c.table_name = ccu.table_name
        LEFT JOIN 
          information_schema.table_constraints tc ON ccu.constraint_name = tc.constraint_name
        WHERE 
          c.table_name = $1
          AND c.table_schema = 'public'
        ORDER BY 
          c.ordinal_position;
      `;

      const result = await this.pool.query(query, [table.name]);

      table.columns = result.rows.map((row) => ({
        name: row.column_name,
        type: row.data_type,
        description: row.description || `Colonne ${row.column_name}`,
        isPrimary: row.constraint_type === 'PRIMARY KEY',
        isForeign: row.constraint_type === 'FOREIGN KEY',
        isRequired: row.is_nullable === 'NO',
      }));
    }
  }

  private async extractRelationships() {
    const query = `
      SELECT
        tc.table_name as source_table,
        kcu.column_name as source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column
      FROM 
        information_schema.table_constraints AS tc 
      JOIN 
        information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN 
        information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE 
        tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
    `;

    const result = await this.pool.query(query);

    for (const row of result.rows) {
      const sourceTable = this.tables.find((t) => t.name === row.source_table);
      const targetTable = this.tables.find((t) => t.name === row.target_table);

      if (sourceTable && targetTable) {
        // Mettre à jour la colonne avec la référence
        const column = sourceTable.columns.find(
          (c) => c.name === row.source_column,
        );
        if (column) {
          column.isForeign = true;
          column.references = {
            table: row.target_table,
            column: row.target_column,
          };
        }

        // Déterminer le type de relation
        const targetColumn = targetTable.columns.find(
          (c) => c.name === row.target_column,
        );
        const relationType =
          targetColumn && targetColumn.isPrimary ? 'many-to-one' : 'one-to-one';

        // Ajouter la relation
        sourceTable.relationships.push({
          type: relationType,
          targetTable: row.target_table,
          sourceColumn: row.source_column,
          targetColumn: row.target_column,
          description: `Relation de ${row.source_table}.${row.source_column} vers ${row.target_table}.${row.target_column}`,
        });

        // Ajouter la relation inverse
        const inverseType =
          relationType === 'many-to-one' ? 'one-to-many' : 'one-to-one';
        targetTable.relationships.push({
          type: inverseType,
          targetTable: row.source_table,
          sourceColumn: row.target_column,
          targetColumn: row.source_column,
          description: `Relation de ${row.target_table}.${row.target_column} vers ${row.source_table}.${row.source_column}`,
        });
      }
    }
  }

  private async extractEnumTypes() {
    const query = `
      SELECT 
        t.typname as enum_name,
        array_agg(e.enumlabel) as enum_values
      FROM 
        pg_type t
      JOIN 
        pg_enum e ON t.oid = e.enumtypid
      JOIN 
        pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE 
        n.nspname = 'public'
      GROUP BY 
        t.typname;
    `;

    const result = await this.pool.query(query);

    this.enums = result.rows.map((row) => ({
      name: row.enum_name,
      values: row.enum_values,
      description: `Type énuméré ${row.enum_name}`,
    }));
  }

  private initializeStaticMetadata() {
    this.initializeStaticEnumTypes();
    this.initializeStaticTables();
    this.initializeStaticRelationships();
  }

  private initializeStaticEnumTypes() {
    this.enums = [
      {
        name: 'status',
        values: ['active', 'inactive', 'pending', 'archived'],
        description: 'Statut général utilisé dans plusieurs tables',
      },
      {
        name: 'priority',
        values: ['low', 'medium', 'high', 'critical'],
        description: 'Niveaux de priorité pour les tâches et projets',
      },
      {
        name: 'payment_method',
        values: ['credit_card', 'bank_transfer', 'paypal', 'cash', 'check'],
        description: 'Méthodes de paiement acceptées',
      },
      {
        name: 'project_status',
        values: ['planning', 'in_progress', 'review', 'completed', 'cancelled'],
        description: 'Statuts spécifiques aux projets',
      },
      {
        name: 'invoice_status',
        values: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
        description: 'Statuts spécifiques aux factures',
      },
    ];
  }

  private initializeStaticTables() {
    this.tables = [
      {
        name: 'clients',
        description: "Informations sur les clients de l'entreprise",
        columns: [
          {
            name: 'id',
            type: 'integer',
            description: 'Identifiant unique du client',
            isPrimary: true,
            isForeign: false,
            isRequired: true,
          },
          {
            name: 'name',
            type: 'varchar(100)',
            description: 'Nom du client',
            isPrimary: false,
            isForeign: false,
            isRequired: true,
          },
          {
            name: 'email',
            type: 'varchar(100)',
            description: 'Adresse email du client',
            isPrimary: false,
            isForeign: false,
            isRequired: true,
          },
          {
            name: 'phone',
            type: 'varchar(20)',
            description: 'Numéro de téléphone du client',
            isPrimary: false,
            isForeign: false,
            isRequired: false,
          },
          {
            name: 'address',
            type: 'text',
            description: 'Adresse postale du client',
            isPrimary: false,
            isForeign: false,
            isRequired: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            description: 'Date de création du client',
            isPrimary: false,
            isForeign: false,
            isRequired: true,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            description: 'Date de dernière mise à jour du client',
            isPrimary: false,
            isForeign: false,
            isRequired: true,
          },
          {
            name: 'status',
            type: 'enum',
            description: 'Statut du client (actif, inactif, etc.)',
            isPrimary: false,
            isForeign: false,
            isRequired: true,
          },
        ],
        relationships: [],
      },
      {
        name: 'projects',
        description: 'Projets associés aux clients',
        columns: [
          {
            name: 'id',
            type: 'integer',
            description: 'Identifiant unique du projet',
            isPrimary: true,
            isForeign: false,
            isRequired: true,
          },
          {
            name: 'client_id',
            type: 'integer',
            description: 'Identifiant du client associé au projet',
            isPrimary: false,
            isForeign: true,
            isRequired: true,
            references: {
              table: 'clients',
              column: 'id',
            },
          },
          {
            name: 'name',
            type: 'varchar(100)',
            description: 'Nom du projet',
            isPrimary: false,
            isForeign: false,
            isRequired: true,
          },
          {
            name: 'description',
            type: 'text',
            description: 'Description détaillée du projet',
            isPrimary: false,
            isForeign: false,
            isRequired: false,
          },
          {
            name: 'start_date',
            type: 'date',
            description: 'Date de début du projet',
            isPrimary: false,
            isForeign: false,
            isRequired: true,
          },
          {
            name: 'end_date',
            type: 'date',
            description: 'Date de fin prévue du projet',
            isPrimary: false,
            isForeign: false,
            isRequired: false,
          },
          {
            name: 'budget',
            type: 'decimal(10,2)',
            description: 'Budget alloué au projet',
            isPrimary: false,
            isForeign: false,
            isRequired: false,
          },
          {
            name: 'status',
            type: 'enum',
            description: 'Statut du projet',
            isPrimary: false,
            isForeign: false,
            isRequired: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            description: 'Date de création du projet',
            isPrimary: false,
            isForeign: false,
            isRequired: true,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            description: 'Date de dernière mise à jour du projet',
            isPrimary: false,
            isForeign: false,
            isRequired: true,
          },
        ],
        relationships: [],
      },
    ];
  }

  private initializeStaticRelationships() {
    // Relation clients -> projects (one-to-many)
    this.tables
      .find((t) => t.name === 'clients')
      ?.relationships.push({
        type: 'one-to-many',
        targetTable: 'projects',
        sourceColumn: 'id',
        targetColumn: 'client_id',
        description: 'Un client peut avoir plusieurs projets',
      });

    // Relation projects -> clients (many-to-one)
    this.tables
      .find((t) => t.name === 'projects')
      ?.relationships.push({
        type: 'many-to-one',
        targetTable: 'clients',
        sourceColumn: 'client_id',
        targetColumn: 'id',
        description: 'Un projet appartient à un seul client',
      });
  }

  getAllTables(): TableMetadata[] {
    return this.tables;
  }

  getTable(tableName: string): TableMetadata | undefined {
    return this.tables.find((table) => table.name === tableName);
  }

  getAllEnums(): EnumType[] {
    return this.enums;
  }

  getEnum(enumName: string): EnumType | undefined {
    return this.enums.find((e) => e.name === enumName);
  }

  getDatabaseDescription(): string {
    let description = 'Base de données contenant les tables suivantes:\n\n';

    this.tables.forEach((table) => {
      description += `- ${table.name}: ${table.description}\n`;
      description += `  Colonnes principales: ${table.columns
        .filter(
          (col) =>
            col.isPrimary ||
            col.isForeign ||
            col.name === 'name' ||
            col.name === 'title',
        )
        .map((col) => col.name)
        .join(', ')}\n`;

      if (table.relationships.length > 0) {
        description += `  Relations: ${table.relationships
          .map(
            (rel) =>
              `${this.getRelationshipSymbol(rel.type)} ${rel.targetTable} (${rel.description})`,
          )
          .join(', ')}\n`;
      }

      description += '\n';
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
        return '?:?';
    }
  }
}
