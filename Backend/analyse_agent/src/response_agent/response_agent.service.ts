import {
  Injectable,
  Logger,
  OnModuleInit,
  HttpException,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { HfInference } from '@huggingface/inference';
import { ConfigService } from '@nestjs/config';
import { AnalyseAgentService } from '../analyse_agent/analyse_agent.service';
import { AnalysisResult } from '../huggingface/huggingface.service';

interface FormattedResponse {
  data: any;
  type: 'list' | 'detail';
  humanResponse: string;
}

@Injectable()
export class ResponseAgentService implements OnModuleInit {
  private readonly logger = new Logger(ResponseAgentService.name);
  private readonly hf: HfInference;
  private readonly modelName = 'mistralai/Mistral-7B-Instruct-v0.2';

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AnalyseAgentService))
    private readonly analyseAgentService: AnalyseAgentService,
  ) {
    const apiKey = this.configService.get<string>('HUGGING_FACE_TOKEN');
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY is not defined');
    }
    this.hf = new HfInference(apiKey);
  }

  async onModuleInit() {
    // Initialisation si nécessaire
  }

  private determineResponseType(data: any): 'list' | 'detail' {
    if (Array.isArray(data)) {
      if (data.length === 1) return 'detail';
      return 'list';
    }
    return 'detail';
  }

  private async generateHumanResponse(
    question: string,
    data: any,
    type: 'list' | 'detail',
  ): Promise<string> {
    const prompt = `Tu es un assistant qui aide à formater les réponses de manière naturelle et claire en français.

Voici les informations à formater :
Question : "${question}"
Type de réponse : ${type}
Données : ${JSON.stringify(data)}

IMPORTANT : Ne répète pas ces informations dans ta réponse. Commence directement par formater la réponse de manière naturelle.`;

    try {
      const response = await this.hf.textGeneration({
        model: this.modelName,
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.4,
          top_p: 0.95,
          stop: ['Question :', 'Type de réponse :', 'Données :', 'IMPORTANT :'],
        },
      });

      // Nettoyer la réponse pour enlever tout ce qui pourrait ressembler au prompt
      const cleanResponse = response.generated_text
        .replace(/^Tu es un assistant.*?français\./s, '')
        .replace(/^Voici les informations.*?naturelle\./s, '')
        .replace(/^Question :.*?naturelle\./s, '')
        .replace(/^Type de réponse :.*?naturelle\./s, '')
        .replace(/^Données :.*?naturelle\./s, '')
        .replace(/^IMPORTANT :.*?naturelle\./s, '')
        .replace(/^Instructions :.*?naturelle\./s, '')
        .replace(/^Réponse :.*?naturelle\./s, '')
        .trim();

      return cleanResponse;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la génération de la réponse avec Mistral:',
        error,
      );
      return 'Je ne peux pas formater la réponse pour le moment.';
    }
  }

  async formatResponse(
    question: string,
    analysisResult: AnalysisResult,
  ): Promise<FormattedResponse> {
    try {
      const responseType = this.determineResponseType(analysisResult.data);
      const humanResponse = await this.generateHumanResponse(
        question,
        analysisResult.data || analysisResult,
        responseType,
      );

      return {
        data: analysisResult,
        type: responseType,
        humanResponse: humanResponse,
      };
    } catch (error) {
      this.logger.error('Erreur lors du formatage de la réponse:', error);
      throw new HttpException(
        'Erreur lors du formatage de la réponse',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
