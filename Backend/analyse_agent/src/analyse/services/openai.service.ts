import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface OpenAIOptions {
  temperature?: number;
  max_tokens?: number;
  timeout?: number;
  retries?: number;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly defaultModel: string;
  private readonly promptCache: Map<string, string> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    this.apiUrl = this.configService.get<string>(
      'OPENAI_API_URL',
      'https://api.openai.com/v1/chat/completions',
    );
    this.defaultModel = this.configService.get<string>(
      'OPENAI_DEFAULT_MODEL',
      'gpt-4',
    );

    if (!this.apiKey) {
      this.logger.warn(
        'Clé API OpenAI non définie. Les appels à OpenAI échoueront.',
      );
    }
  }

  /**
   * Initialise le service en chargeant les prompts depuis les fichiers
   */
  async onModuleInit() {
    try {
      // Charger les prompts depuis le répertoire des prompts
      const promptsDir = path.join(process.cwd(), 'src/analyse/prompts');

      try {
        await fs.access(promptsDir);
        const files = await fs.readdir(promptsDir);

        for (const file of files) {
          if (file.endsWith('.prompt.txt') || file.endsWith('.prompt.md')) {
            const name = file.split('.')[0];
            const content = await fs.readFile(
              path.join(promptsDir, file),
              'utf-8',
            );
            this.promptCache.set(name, content);
            this.logger.log(`Prompt '${name}' chargé depuis ${file}`);
          }
        }

        this.logger.log(
          `${this.promptCache.size} prompts chargés depuis le répertoire.`,
        );
      } catch (error) {
        this.logger.warn(`Répertoire de prompts non trouvé: ${promptsDir}`);
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation des prompts: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
    }
  }

  /**
   * Récupère un prompt par son nom (et remplace les variables si fournies)
   */
  getPrompt(name: string, variables?: Record<string, string>): string {
    let prompt = this.promptCache.get(name);

    if (!prompt) {
      this.logger.warn(`Prompt '${name}' non trouvé dans le cache.`);
      return '';
    }

    // Remplacer les variables si fournies
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }

    return prompt;
  }

  /**
   * Stocke un prompt dans le cache
   */
  setPrompt(name: string, content: string): void {
    this.promptCache.set(name, content);
  }

  /**
   * Envoie un message à l'API OpenAI et récupère la réponse
   */
  async sendMessage(
    content: string,
    options: OpenAIOptions = {},
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Clé API OpenAI non définie');
    }

    const {
      temperature = 0.1,
      max_tokens = 4000,
      timeout = 60000,
      retries = 3,
    } = options;

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < retries) {
      try {
        const startTime = Date.now();

        const response = await axios.post(
          this.apiUrl,
          {
            model: this.defaultModel,
            messages: [
              {
                role: 'system',
                content:
                  "Tu es un assistant IA spécialisé dans l'analyse de requêtes.",
              },
              { role: 'user', content },
            ],
            temperature,
            max_tokens,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            timeout,
          },
        );

        const executionTime = Date.now() - startTime;
        this.logger.debug(`Réponse OpenAI reçue en ${executionTime}ms`);

        const responseText = response.data.choices[0]?.message?.content || '';

        // Logger les statistiques de la requête (tokens, coût estimé, etc.)
        if (response.data.usage) {
          this.logger.debug(
            `Usage OpenAI - Prompt tokens: ${response.data.usage.prompt_tokens}, ` +
              `Completion tokens: ${response.data.usage.completion_tokens}, ` +
              `Total tokens: ${response.data.usage.total_tokens}`,
          );
        }

        return responseText;
      } catch (error) {
        attempt++;
        lastError = error as Error;

        // Informations détaillées sur l'erreur
        if (axios.isAxiosError(error) && error.response) {
          this.logger.error(
            `Erreur OpenAI (tentative ${attempt}/${retries}): ${error.message}`,
            error.response.data,
          );
        } else {
          this.logger.error(
            `Erreur lors de la communication avec OpenAI (tentative ${attempt}/${retries}): ${
              error instanceof Error ? error.message : 'Erreur inconnue'
            }`,
          );
        }

        // Attendre un délai exponentiel entre les tentatives
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.debug(
            `Attente de ${delay}ms avant la prochaine tentative...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Échec après ${retries} tentatives: ${
        lastError ? lastError.message : 'Erreur inconnue'
      }`,
    );
  }

  /**
   * Analyse une question en utilisant un prompt spécifique
   */
  async analyseQuestion(question: string, promptName: string): Promise<any> {
    // Récupérer le prompt avec la question comme variable
    const prompt = this.getPrompt(promptName, { question });

    if (!prompt) {
      throw new Error(`Prompt '${promptName}' non trouvé`);
    }

    try {
      const response = await this.sendMessage(prompt, {
        temperature: 0.2,
        max_tokens: 4000,
      });

      // Tenter de parser la réponse comme du JSON
      try {
        return JSON.parse(response);
      } catch (parseError) {
        this.logger.error(
          `Erreur lors du parsing de la réponse OpenAI: ${
            parseError instanceof Error ? parseError.message : 'Erreur inconnue'
          }`,
        );
        throw new Error('Format de réponse invalide');
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la question: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
      throw error;
    }
  }
}
