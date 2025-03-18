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

      // Extraction simple des champs clés
      const questionPattern = /Question:\s*(.*?)(?=\n|$)/s;
      const reformulationPattern = /Question reformulée:\s*(.*?)(?=\n|$)/s;
      const agentPattern = /Agent:\s*(querybuilder|workflow)(?=\n|$)/is;

      const questionMatch = result.match(questionPattern);
      const reformulationMatch = result.match(reformulationPattern);
      const agentMatch = result.match(agentPattern);

      // Utiliser les valeurs extraites ou des valeurs par défaut
      const extractedQuestion = questionMatch?.[1]?.trim() || question;
      const extractedReformulation =
        reformulationMatch?.[1]?.trim() || question;

      let extractedAgent: string;
      if (agentMatch && this.isValidService(agentMatch[1].toLowerCase())) {
        extractedAgent = agentMatch[1].toLowerCase();
      } else {
        extractedAgent = 'querybuilder'; // Agent par défaut
        this.logger.warn(
          `Agent non trouvé ou invalide, utilisation de l'agent par défaut: ${extractedAgent}`,
        );
      }

      this.logger.debug(
        `Extraction réussie - Question: "${extractedQuestion}"`,
      );
      this.logger.debug(
        `Extraction réussie - Question reformulée: "${extractedReformulation}"`,
      );
      this.logger.debug(`Extraction réussie - Agent: "${extractedAgent}"`);

      return {
        question: extractedQuestion,
        questionReformulated: extractedReformulation,
        agent: extractedAgent as Service,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la question: ${error.message}`,
        error.stack,
      );

      // Retourner une réponse par défaut en cas d'erreur
      return {
        question: question,
        questionReformulated: question,
        agent: 'querybuilder',
      };
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
