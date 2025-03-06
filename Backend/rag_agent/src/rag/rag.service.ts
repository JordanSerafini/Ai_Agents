import { Injectable, Logger } from '@nestjs/common';
import { DocumentService } from '../document/document.service';
import { ConfigService } from '@nestjs/config';

interface Document {
  content: string;
  title: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly openaiApiKey: string;

  constructor(
    private readonly documentService: DocumentService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not defined in environment variables');
    }
    this.openaiApiKey = apiKey;
  }

  async query(query: string): Promise<string> {
    try {
      // Rechercher les documents pertinents
      const relevantDocs = await this.documentService.searchDocuments(query);

      // Construire le contexte à partir des documents
      const context = relevantDocs
        .map((doc: Document) => doc.content)
        .join('\n\n');

      // TODO: Intégrer avec OpenAI en utilisant this.openaiApiKey
      // Pour l'instant, on retourne juste le contexte
      return `Contexte trouvé pour la requête "${query}":\n\n${context}`;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing RAG query: ${errorMessage}`);
      throw error;
    }
  }

  async indexAndQuery(document: Document, query: string): Promise<string> {
    try {
      // Indexer le document
      await this.documentService.indexDocument(document);

      // Effectuer la requête
      return this.query(query);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error in indexAndQuery: ${errorMessage}`);
      throw error;
    }
  }
}
