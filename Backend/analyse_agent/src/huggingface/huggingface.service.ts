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

      // Utiliser une approche différente - chercher les lignes correspondantes
      const lines = result.split('\n');
      let extractedQuestion = question;
      let extractedReformulation = question;
      let extractedAgent = 'querybuilder';

      // Pour le débogage
      this.logger.debug('Lignes de la réponse:');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim()) {
          this.logger.debug(`[${i}] ${lines[i]}`);
        }
      }

      // Parcourir les lignes pour trouver les informations
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Gérer les formats de réponse possibles
        if (line.startsWith('Question originale:')) {
          extractedQuestion = line
            .substring('Question originale:'.length)
            .trim();
          this.logger.debug(`Trouvé question: "${extractedQuestion}"`);
        } else if (line.includes('Question originale:')) {
          // Format alternatif avec liste numérotée (1. Question originale:)
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            extractedQuestion = line.substring(colonIndex + 1).trim();
            this.logger.debug(
              `Trouvé question (format alternatif): "${extractedQuestion}"`,
            );
          }
        } else if (line.match(/^I+\.\s+Question originale:/i)) {
          // Format avec numérotation romaine (I. Question originale:)
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            extractedQuestion = line.substring(colonIndex + 1).trim();
            this.logger.debug(
              `Trouvé question (format romain): "${extractedQuestion}"`,
            );
          }
        } else if (line.startsWith('Question reformulée:')) {
          extractedReformulation = line
            .substring('Question reformulée:'.length)
            .trim();
          this.logger.debug(
            `Trouvé reformulation: "${extractedReformulation}"`,
          );
        } else if (line.includes('Question reformulée:')) {
          // Format alternatif avec liste numérotée
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            extractedReformulation = line.substring(colonIndex + 1).trim();
            this.logger.debug(
              `Trouvé reformulation (format alternatif): "${extractedReformulation}"`,
            );
          }
        } else if (line.match(/^II+\.\s+Question reformulée:/i)) {
          // Format avec numérotation romaine (II. Question reformulée:)
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            extractedReformulation = line.substring(colonIndex + 1).trim();
            this.logger.debug(
              `Trouvé reformulation (format romain): "${extractedReformulation}"`,
            );
          }
        } else if (line.startsWith('Agent:')) {
          const agentValue = line.substring('Agent:'.length).trim();
          this.logger.debug(`Trouvé agent: "${agentValue}"`);

          if (this.isValidService(agentValue.toLowerCase())) {
            extractedAgent = agentValue.toLowerCase();
          } else {
            this.logger.warn(
              `Agent invalide: ${agentValue}, utilisation par défaut`,
            );
          }
        } else if (line.includes('Agent:')) {
          // Format alternatif avec liste numérotée
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const agentValue = line.substring(colonIndex + 1).trim();
            this.logger.debug(
              `Trouvé agent (format alternatif): "${agentValue}"`,
            );

            if (this.isValidService(agentValue.toLowerCase())) {
              extractedAgent = agentValue.toLowerCase();
            }
          }
        } else if (line.match(/^III+\.\s+Agent:/i)) {
          // Format avec numérotation romaine (III. Agent:)
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const agentValue = line.substring(colonIndex + 1).trim();
            this.logger.debug(`Trouvé agent (format romain): "${agentValue}"`);

            if (this.isValidService(agentValue.toLowerCase())) {
              extractedAgent = agentValue.toLowerCase();
            }
          }
        }
      }

      this.logger.debug(`Extraction finale - Question: "${extractedQuestion}"`);
      this.logger.debug(
        `Extraction finale - Reformulation: "${extractedReformulation}"`,
      );
      this.logger.debug(`Extraction finale - Agent: "${extractedAgent}"`);

      // Nettoyer les guillemets qui pourraient être présents dans les valeurs extraites
      extractedQuestion = this.cleanQuotes(extractedQuestion);
      extractedReformulation = this.cleanQuotes(extractedReformulation);

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

  /**
   * Nettoie les guillemets au début et à la fin d'une chaîne
   * @param value Chaîne à nettoyer
   * @returns Chaîne sans guillemets externes
   */
  private cleanQuotes(value: string): string {
    if (!value) return value;

    // Supprimer les guillemets au début et à la fin
    let cleaned = value;

    // Vérifier si la chaîne commence et se termine par des guillemets
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.substring(1, cleaned.length - 1);
    }

    // Cas où il y aurait des guillemets doubles imbriqués
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.substring(1, cleaned.length - 1);
    }

    return cleaned;
  }
}
