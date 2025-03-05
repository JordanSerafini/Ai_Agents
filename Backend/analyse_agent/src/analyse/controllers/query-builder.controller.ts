import { Controller, Post, Body, Logger, Query, Get } from '@nestjs/common';
import { QueryBuilderService } from '../services/query-builder.service';
import { AnalyseResponseDto } from '../dto/analyse-response.dto';
import { QueryBuilderOptions } from '../interfaces/query-builder.interface';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { RagService } from '../services/rag.service';
import { AgentType } from '../services/analyse.service';

@Controller('query-builder')
export class QueryBuilderController {
  private readonly logger = new Logger(QueryBuilderController.name);

  constructor(
    private readonly queryBuilderService: QueryBuilderService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly ragService: RagService,
  ) {}

  @Post('build')
  async buildQuery(
    @Body() analyseResponse: AnalyseResponseDto,
    @Query('maxResults') maxResults?: number,
    @Query('includeMetadata') includeMetadata?: boolean,
    @Query('formatResult') formatResult?: 'json' | 'table' | 'csv',
    @Query('useElasticsearch') useElasticsearch?: boolean,
    @Query('useRag') useRag?: boolean,
  ) {
    this.logger.log(`Requête de construction reçue pour l'analyse: ${analyseResponse.demandeId}`);
    
    const options: QueryBuilderOptions = {
      maxResults: maxResults ? parseInt(maxResults.toString(), 10) : undefined,
      includeMetadata,
      formatResult: formatResult as 'json' | 'table' | 'csv',
      useElasticsearch: useElasticsearch || false,
      useRag: useRag || false
    };
    
    if (options.useRag) {
      return this.enhanceWithRag(analyseResponse, options);
    }
    
    if (options.useElasticsearch) {
      return this.handleElasticsearchQuery(analyseResponse, options);
    }
    
    return this.queryBuilderService.buildQuery(analyseResponse, options);
  }

  private async enhanceWithRag(
    analyseResponse: AnalyseResponseDto, 
    options: QueryBuilderOptions
  ) {
    try {
      // Rechercher des documents similaires dans la base de connaissances
      const similarDocuments = await this.ragService.searchSimilarDocuments(
        analyseResponse.questionCorrigee || analyseResponse.contexte,
        AgentType.DATABASE,
        3
      );
      
      // Si des documents similaires sont trouvés, enrichir la construction de requête
      if (similarDocuments && similarDocuments.length > 0) {
        this.logger.log(`Documents RAG similaires trouvés: ${similarDocuments.length}`);
        
        // Construire la requête avec l'aide des connaissances récupérées
        const result = await this.queryBuilderService.buildQueryWithRagKnowledge(
          analyseResponse, 
          similarDocuments,
          options
        );
        
        // Stocker cette nouvelle requête dans la base de connaissances pour le futur
        await this.storeQueryInRag(analyseResponse, result);
        
        return result;
      }
      
      // Si aucun document similaire n'est trouvé, utiliser la construction normale
      return this.queryBuilderService.buildQuery(analyseResponse, options);
    } catch (error) {
      this.logger.error(`Erreur lors de l'enrichissement RAG: ${error.message}`);
      // Fallback à la construction régulière
      return this.queryBuilderService.buildQuery(analyseResponse, options);
    }
  }

  private async storeQueryInRag(analyseResponse: AnalyseResponseDto, result: any) {
    if (result && result.success && result.sql) {
      try {
        await this.ragService.addDocument(
          analyseResponse.questionCorrigee || analyseResponse.contexte,
          JSON.stringify({
            sql: result.sql,
            params: result.params,
            tables: result.tables,
            explanation: result.explanation
          }),
          AgentType.DATABASE,
          'database_queries',
          [...(analyseResponse.entites || []), 'sql_query']
        );
        this.logger.log('Requête stockée dans RAG pour utilisation future');
      } catch (error) {
        this.logger.error(`Erreur lors du stockage dans RAG: ${error.message}`);
      }
    }
  }

  private async handleElasticsearchQuery(
    analyseResponse: AnalyseResponseDto,
    options: QueryBuilderOptions
  ) {
    const searchQuery = this.queryBuilderService.buildElasticsearchQuery(analyseResponse);
    
    try {
      const result = await this.elasticsearchService.search({
        index: this.getElasticsearchIndex(analyseResponse.entites),
        body: {
          query: searchQuery,
          size: options.maxResults || 10,
          sort: this.getDefaultSort(analyseResponse)
        }
      });

      return this.formatElasticsearchResponse(result, options);
    } catch (error) {
      this.logger.error(`Erreur Elasticsearch: ${error.message}`);
      throw error;
    }
  }

  private getElasticsearchIndex(entities: string[]): string {
    // Logique pour déterminer l'index Elasticsearch approprié
    return entities[0] || 'default_index';
  }

  private getDefaultSort(analyseResponse: AnalyseResponseDto): any[] {
    // Logique pour déterminer le tri par défaut
    return [
      { created_at: 'desc' }
    ];
  }

  private formatElasticsearchResponse(result: any, options: QueryBuilderOptions) {
    if (options.formatResult === 'csv') {
      return this.formatToCSV(result.hits.hits);
    }
    return result.hits.hits;
  }

  private formatToCSV(hits: any[]): string {
    if (!hits.length) return '';
    
    const headers = Object.keys(hits[0]._source);
    const rows = hits.map(hit => headers.map(header => hit._source[header]));
    
    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }

  @Post('build-with-joins')
  async buildQueryWithJoins(
    @Body() analyseResponse: AnalyseResponseDto,
    @Query('joinType') joinType: 'inner' | 'left' | 'right' = 'inner',
    @Query('maxResults') maxResults?: number,
  ) {
    this.logger.log(`Construction de requête avec jointures pour: ${analyseResponse.demandeId}`);
    
    const joinConfig = {
      type: joinType,
      tables: analyseResponse.entites,
      conditions: this.extractJoinConditions(analyseResponse)
    };

    return this.queryBuilderService.buildQueryWithJoins(analyseResponse, joinConfig, maxResults);
  }

  private extractJoinConditions(analyseResponse: AnalyseResponseDto): any[] {
    // Logique pour extraire les conditions de jointure
    return analyseResponse.contraintes
      .filter(constraint => constraint.includes('='))
      .map(constraint => {
        const [left, right] = constraint.split('=').map(s => s.trim());
        return { left, right };
      });
  }

  @Get('available-joins')
  async getAvailableJoins() {
    return this.queryBuilderService.getAvailableJoinConfigurations();
  }

  @Post('advanced-search')
  async advancedSearch(
    @Body() searchConfig: {
      query: string;
      filters?: Record<string, any>;
      sort?: Record<string, 'asc' | 'desc'>;
      aggregations?: string[];
    },
    @Query('useElasticsearch') useElasticsearch?: boolean,
  ) {
    if (useElasticsearch) {
      return this.handleElasticsearchAdvancedSearch(searchConfig);
    }
    
    return this.queryBuilderService.buildAdvancedSearch(searchConfig);
  }

  private async handleElasticsearchAdvancedSearch(searchConfig: any) {
    const elasticsearchQuery = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: searchConfig.query,
                fields: ['*']
              }
            }
          ],
          filter: this.transformFilters(searchConfig.filters)
        }
      },
      sort: this.transformSort(searchConfig.sort),
      aggs: this.transformAggregations(searchConfig.aggregations)
    };

    try {
      const result = await this.elasticsearchService.search({
        index: '*',
        body: elasticsearchQuery
      });

      return result;
    } catch (error) {
      this.logger.error(`Erreur recherche avancée Elasticsearch: ${error.message}`);
      throw error;
    }
  }

  private transformFilters(filters?: Record<string, any>) {
    if (!filters) return [];
    
    return Object.entries(filters).map(([field, value]) => ({
      term: { [field]: value }
    }));
  }

  private transformSort(sort?: Record<string, 'asc' | 'desc'>) {
    if (!sort) return [{ created_at: 'desc' }];
    
    return Object.entries(sort).map(([field, direction]) => ({
      [field]: direction
    }));
  }

  private transformAggregations(aggregations?: string[]) {
    if (!aggregations) return {};
    
    return aggregations.reduce((acc, field) => ({
      ...acc,
      [field]: {
        terms: { field }
      }
    }), {});
  }

  @Post('semantic-search')
  async semanticSearch(
    @Body() body: { question: string; limit?: number },
  ) {
    try {
      const results = await this.ragService.searchSimilarDocuments(
        body.question,
        AgentType.DATABASE,
        body.limit || 5
      );
      
      return {
        success: true,
        results: results.map(result => ({
          question: result.document.question,
          answer: JSON.parse(result.document.answer),
          score: result.score,
          metadata: result.document.metadata
        }))
      };
    } catch (error) {
      this.logger.error(`Erreur recherche sémantique: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
} 