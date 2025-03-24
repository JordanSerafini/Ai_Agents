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

  private formatStaffScheduleResponse(data: any): string {
    if (!data || !Array.isArray(data)) return 'Aucune donnée disponible';

    // Regrouper les personnes par nom
    const groupedPeople = data.reduce((acc: any, person: any) => {
      const key = `${person.firstname}-${person.lastname}`;
      if (!acc[key]) {
        acc[key] = {
          ...person,
          schedules: [],
        };
      }
      acc[key].schedules.push(person.schedule);
      return acc;
    }, {});

    let response = 'Voici le planning du personnel pour le mois en cours :\n\n';

    Object.values(groupedPeople).forEach((person: any) => {
      response += `${person.firstname} ${person.lastname} (${person.role}) :\n`;
      response += `- Heures programmées : ${person.hours_scheduled}h\n`;

      person.schedules.forEach((schedule: any) => {
        if (schedule.special_instructions) {
          response += `- Note : ${schedule.special_instructions}\n`;
        }
      });
      response += '\n';
    });

    return response;
  }

  private formatWorksiteResponse(data: any): string {
    if (!data || !Array.isArray(data)) return 'Aucune donnée disponible';

    let response = 'Voici la liste des chantiers programmés :\n\n';

    data.forEach((worksite: any) => {
      response += `Chantier : ${worksite.name}\n`;
      response += `- Adresse : ${worksite.address}\n`;
      response += `- Date de début : ${new Date(worksite.start_date).toLocaleDateString()}\n`;
      response += `- Date de fin : ${new Date(worksite.end_date).toLocaleDateString()}\n`;
      response += `- Statut : ${worksite.status}\n\n`;
    });

    return response;
  }

  private async generateHumanResponse(
    question: string,
    data: any,
    type: 'list' | 'detail',
  ): Promise<string> {
    const prompt = `Tu es un assistant qui aide à formater les réponses de manière naturelle et claire.
Question posée : "${question}"
Type de réponse : ${type}
Données à formater : ${JSON.stringify(data)}

Formate une réponse en français qui résume ces informations de manière claire et concise.`;

    try {
      const response = await this.hf.textGeneration({
        model: this.modelName,
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.4,
          top_p: 0.95,
        },
      });

      return response.generated_text;
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
      const responseType = this.determineResponseType(
        analysisResult.finalQuery,
      );

      // Générer une réponse humaine avec Mistral
      const humanResponse = await this.generateHumanResponse(
        question,
        analysisResult,
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
