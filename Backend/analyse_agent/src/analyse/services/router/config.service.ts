import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RouterConfigService {
  private readonly logger = new Logger(RouterConfigService.name);

  // URLs des différents agents
  public readonly queryBuilderAgentUrl: string;
  public readonly elasticsearchAgentUrl: string;
  public readonly ragAgentUrl: string;
  public readonly workflowAgentUrl: string;
  public readonly apiAgentUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Récupérer les URLs des agents depuis la configuration
    this.queryBuilderAgentUrl = this.configService.get<string>(
      'QUERYBUILDER_AGENT_URL',
      'http://querybuilder_agent:3002',
    );
    this.elasticsearchAgentUrl = this.configService.get<string>(
      'ELASTICSEARCH_AGENT_URL',
      'http://elasticsearch_agent:3003',
    );
    this.ragAgentUrl = this.configService.get<string>(
      'RAG_AGENT_URL',
      'http://rag_agent:3004',
    );
    this.workflowAgentUrl = this.configService.get<string>(
      'WORKFLOW_AGENT_URL',
      'http://workflow_agent:3005',
    );
    this.apiAgentUrl = this.configService.get<string>(
      'API_AGENT_URL',
      'http://api_agent:3006',
    );

    this.logConfiguration();
  }

  private logConfiguration(): void {
    this.logger.log(`Service de routage initialisé avec les URLs suivantes:`);
    this.logger.log(`- QueryBuilder Agent: ${this.queryBuilderAgentUrl}`);
    this.logger.log(`- Elasticsearch Agent: ${this.elasticsearchAgentUrl}`);
    this.logger.log(`- RAG Agent: ${this.ragAgentUrl}`);
    this.logger.log(`- Workflow Agent: ${this.workflowAgentUrl}`);
    this.logger.log(`- API Agent: ${this.apiAgentUrl}`);
  }
}
