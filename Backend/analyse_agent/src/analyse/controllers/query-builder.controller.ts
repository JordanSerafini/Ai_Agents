import { Controller, Post, Body, Logger, Query } from '@nestjs/common';
import { QueryBuilderService } from '../services/query-builder.service';
import { AnalyseResponseDto } from '../dto/analyse-response.dto';
import { QueryBuilderOptions } from '../interfaces/query-builder.interface';

@Controller('query-builder')
export class QueryBuilderController {
  private readonly logger = new Logger(QueryBuilderController.name);

  constructor(private readonly queryBuilderService: QueryBuilderService) {}

  @Post('build')
  async buildQuery(
    @Body() analyseResponse: AnalyseResponseDto,
    @Query('maxResults') maxResults?: number,
    @Query('includeMetadata') includeMetadata?: boolean,
    @Query('formatResult') formatResult?: 'json' | 'table' | 'csv'
  ) {
    this.logger.log(`Requête de construction de requête SQL reçue pour l'analyse: ${analyseResponse.demandeId}`);
    
    const options: QueryBuilderOptions = {
      maxResults: maxResults ? parseInt(maxResults.toString(), 10) : undefined,
      includeMetadata,
      formatResult: formatResult as 'json' | 'table' | 'csv'
    };
    
    return this.queryBuilderService.buildQuery(analyseResponse, options);
  }

  @Post('test')
  async testQueryBuilder(
    @Query('maxResults') maxResults?: number,
    @Query('includeMetadata') includeMetadata?: boolean
  ) {
    this.logger.log('Test du query builder avec des données fictives');
    
    // Créer une réponse d'analyse fictive pour tester le query builder
    const mockAnalyseResponse: AnalyseResponseDto = {
      demandeId: 'test-123',
      intentionPrincipale: {
        nom: 'recherche',
        confiance: 0.9,
        description: 'Recherche de données'
      },
      sousIntentions: [
        {
          nom: 'filtrer',
          description: 'Filtrer les résultats',
          confiance: 0.8
        }
      ],
      entites: ['projects', 'name', 'status'],
      niveauUrgence: 'MEDIUM',
      contraintes: ['status = en_cours', 'start_date > 2023-01-01'],
      contexte: 'Recherche de projets en cours',
      timestamp: new Date(),
      questionCorrigee: 'Quels sont les projets en cours?'
    };
    
    const options: QueryBuilderOptions = {
      maxResults: maxResults ? parseInt(maxResults.toString(), 10) : 10,
      includeMetadata
    };
    
    return this.queryBuilderService.buildQuery(mockAnalyseResponse, options);
  }
  
  @Post('advanced-test')
  async testAdvancedQueryBuilder() {
    this.logger.log('Test avancé du query builder avec des jointures et des tris');
    
    // Créer une réponse d'analyse fictive pour tester le query builder
    const mockAnalyseResponse: AnalyseResponseDto = {
      demandeId: 'test-advanced-123',
      intentionPrincipale: {
        nom: 'recherche',
        confiance: 0.95,
        description: 'Recherche de données avec jointures'
      },
      sousIntentions: [
        {
          nom: 'joindre',
          description: 'Joindre des tables',
          confiance: 0.9
        },
        {
          nom: 'trier',
          description: 'Trier les résultats',
          confiance: 0.85
        }
      ],
      entites: ['projects', 'clients', 'name', 'status', 'client_id'],
      niveauUrgence: 'MEDIUM',
      contraintes: ['status = en_cours', 'start_date > 2023-01-01'],
      contexte: 'Recherche de projets en cours avec informations client',
      timestamp: new Date(),
      questionCorrigee: 'Quels sont les projets en cours avec les informations des clients?'
    };
    
    // Construire une requête de base
    const baseResult = this.queryBuilderService.buildQuery(mockAnalyseResponse);
    
    // Ajouter des jointures
    const jointures = [
      {
        type: 'INNER' as const,
        leftTable: 'projects',
        leftColumn: 'client_id',
        rightTable: 'clients',
        rightColumn: 'id'
      }
    ];
    
    // Construire une requête avec jointures
    const joinQuery = this.queryBuilderService.construireRequeteAvecJointures(
      baseResult.tables,
      ['projects.id', 'projects.name', 'projects.status', 'clients.firstname', 'clients.lastname', 'clients.email'],
      baseResult.conditions,
      jointures
    );
    
    // Ajouter un tri
    const orderBy = [
      { column: 'projects.start_date', direction: 'DESC' as const },
      { column: 'clients.lastname', direction: 'ASC' as const }
    ];
    
    const finalQuery = this.queryBuilderService.construireRequeteAvecTri(joinQuery, orderBy);
    
    return {
      baseQuery: baseResult.sql,
      joinQuery,
      finalQuery,
      params: baseResult.params,
      explanation: 'Requête avancée avec jointures et tri'
    };
  }
} 