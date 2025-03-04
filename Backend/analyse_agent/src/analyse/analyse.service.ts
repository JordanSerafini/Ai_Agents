import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HumanMessage, SystemMessage } from 'langchain/schema';

@Injectable()
export class AnalyseService {
  private readonly chatModel: ChatOpenAI;

  constructor(private configService: ConfigService) {
    this.chatModel = new ChatOpenAI({
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.7,
    });
  }

  async analyserRequete(requete: string): Promise<{
    type: 'DIRECT' | 'ROUTEUR' | 'WORKFLOW';
    explication: string;
    details?: any;
  }> {
    const systemPrompt = `Tu es un agent d'analyse spécialisé dans la compréhension des requêtes d'une entreprise.
    Ta tâche est d'analyser la requête et de déterminer si elle doit être :
    1. Répondue directement (DIRECT) - Si la réponse est simple et ne nécessite pas d'appels API ou de workflow
    2. Redirigée vers un agent routeur (ROUTEUR) - Si la requête nécessite des appels API
    3. Redirigée vers un agent workflow (WORKFLOW) - Si la requête nécessite une séquence d'actions complexes

    Réponds avec un objet JSON contenant :
    - type: 'DIRECT', 'ROUTEUR', ou 'WORKFLOW'
    - explication: ta justification
    - details: informations supplémentaires si nécessaire`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(requete),
    ];

    const response = await this.chatModel.invoke(messages);
    return JSON.parse(response.content);
  }
} 