import { Injectable, Logger } from '@nestjs/common';
import { HfInference } from '@huggingface/inference';
import { ConfigService } from '@nestjs/config';
import { getAnalysisPrompt, Service } from './prompt';

@Injectable()
export class HuggingFaceService {
  private model: HfInference;
  private readonly logger = new Logger(HuggingFaceService.name);
  private readonly modelName = 'mistralai/Mistral-7B-Instruct-v0.2';

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('HUGGIN_FACE_TOKEN');
    this.logger.log(
      `Initialisation HuggingFace avec token: ${token ? 'présent' : 'manquant'}`,
    );

    if (!token) {
      throw new Error('HUGGIN_FACE_TOKEN non défini');
    }

    this.model = new HfInference(token);
  }

  /**
   * Analyse une question pour déterminer l'agent approprié et reformuler si nécessaire
   * @param question La question à analyser
   * @returns Un objet contenant la question originale, la question reformulée et l'agent choisi
   */
  async analyseQuestion(question: string): Promise<{
    question: string;
    questionReformulated: string;
    agent: Service;
  }> {
    try {
      const prompt = getAnalysisPrompt(question);

      const response = await this.model.textGeneration({
        model: this.modelName,
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.1,
          top_p: 0.95,
        },
      });

      const result = response.generated_text || '';
      this.logger.debug(`Réponse brute: ${result}`);

      // Extraction des informations depuis la réponse
      const questionMatch = result.match(/Question: (.*)/);
      const questionReformulatedMatch = result.match(
        /Question reformulée: (.*)/,
      );
      const agentMatch = result.match(/Agent: (.*)/);

      if (!questionMatch || !questionReformulatedMatch || !agentMatch) {
        throw new Error('Format de réponse invalide');
      }

      const extractedAgent = agentMatch[1].trim();

      // Vérification que l'agent extrait est valide
      if (!this.isValidService(extractedAgent)) {
        throw new Error(`Agent invalide: ${extractedAgent}`);
      }

      return {
        question: questionMatch[1].trim(),
        questionReformulated: questionReformulatedMatch[1].trim(),
        agent: extractedAgent,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la question: ${error.message}`,
        error.stack,
      );
      throw new Error(`Échec de l'analyse de la question: ${error.message}`);
    }
  }

  /**
   * Vérifie si un service est valide
   * @param service Le service à vérifier
   * @returns true si le service est valide, false sinon
   */
  private isValidService(service: string): service is Service {
    return (['querybuilder', 'workflow'] as string[]).includes(service);
  }
}
