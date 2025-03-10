import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface MistralOptions {
  temperature?: number;
  max_tokens?: number;
  timeout?: number;
  retries?: number;
}

@Injectable()
export class MistralService implements OnModuleInit {
  private readonly logger = new Logger(MistralService.name);
  private readonly apiUrl: string;
  private readonly promptCache: Map<string, string> = new Map();
  private readonly systemPrompt: string;
  private readonly huggingFaceToken: string;
  private readonly huggingFaceModel: string;

  constructor(private readonly configService: ConfigService) {
    // Configuration pour l'API locale
    this.apiUrl = this.configService.get<string>(
      'MISTRAL_API_URL',
      'http://localhost:8000/generate',
    );
    
    // Configuration pour Hugging Face
    this.huggingFaceToken = this.configService.get<string>('HUGGINGFACE_TOKEN', '');
    this.huggingFaceModel = this.configService.get<string>(
      'HUGGINGFACE_MODEL',
      'Jordans74/analyse_agent',
    );
    
    this.systemPrompt = this.configService.get<string>(
      'MISTRAL_SYSTEM_PROMPT',
      'Tu es un assistant IA expert en analyse de documents pour une entreprise de construction.',
    );

    this.logger.log(`Service Mistral initialisé avec le modèle: ${this.huggingFaceModel}`);
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
          if (file.endsWith('.txt') || file.endsWith('.md')) {
            const promptName = path.basename(file, path.extname(file));
            const content = await fs.readFile(path.join(promptsDir, file), 'utf8');
            this.setPrompt(promptName, content);
            this.logger.log(`Prompt chargé: ${promptName}`);
          }
        }
      } catch (error) {
        this.logger.warn(`Répertoire de prompts non trouvé: ${promptsDir}`);
      }
    } catch (error) {
      this.logger.error(`Erreur lors de l'initialisation des prompts: ${error.message}`);
    }
  }

  /**
   * Récupère un prompt par son nom et remplace les variables
   */
  getPrompt(name: string, variables?: Record<string, string>): string {
    const prompt = this.promptCache.get(name);
    if (!prompt) {
      this.logger.warn(`Prompt non trouvé: ${name}`);
      return '';
    }

    if (!variables) {
      return prompt;
    }

    // Remplacer les variables dans le prompt
    let result = prompt;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return result;
  }

  /**
   * Définit un prompt dans le cache
   */
  setPrompt(name: string, content: string): void {
    this.promptCache.set(name, content);
  }

  /**
   * Envoie un message au modèle Mistral et retourne la réponse
   * Utilise soit l'API locale, soit l'API Hugging Face selon la configuration
   */
  async sendMessage(
    content: string,
    options: MistralOptions = {},
  ): Promise<string> {
    const maxRetries = options.retries || 3;
    const timeout = options.timeout || 60000; // 60 secondes par défaut

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Envoi de message à Mistral (tentative ${attempt}/${maxRetries})`);

        // Si un token Hugging Face est configuré, utiliser l'API Hugging Face
        if (this.huggingFaceToken) {
          return await this.sendMessageToHuggingFace(content, options);
        } 
        // Sinon, utiliser l'API locale
        else {
          return await this.sendMessageToLocalApi(content, options);
        }
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const errorMessage = error.response?.data?.error || error.message;

        this.logger.error(
          `Erreur lors de l'appel à Mistral (${attempt}/${maxRetries}): ${errorMessage}`,
        );

        if (isLastAttempt) {
          throw new Error(`Échec de l'appel à Mistral après ${maxRetries} tentatives: ${errorMessage}`);
        }

        // Attendre avant de réessayer (backoff exponentiel)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Échec inattendu de l\'appel à Mistral');
  }

  /**
   * Envoie un message à l'API locale Mistral
   */
  private async sendMessageToLocalApi(
    content: string,
    options: MistralOptions,
  ): Promise<string> {
    const response = await axios.post(
      this.apiUrl,
      {
        prompt: content,
        system_prompt: this.systemPrompt,
        max_length: options.max_tokens || 1024,
        temperature: options.temperature || 0.7,
      },
      {
        timeout: options.timeout || 60000,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.data && response.data.response) {
      return response.data.response;
    } else {
      throw new Error('Format de réponse Mistral invalide');
    }
  }

  /**
   * Envoie un message à l'API Hugging Face
   */
  private async sendMessageToHuggingFace(
    content: string,
    options: MistralOptions,
  ): Promise<string> {
    // Formater le prompt pour Mistral
    const formattedPrompt = `<s>[INST] ${this.systemPrompt}\n\n${content} [/INST]`;

    try {
      // Utiliser l'endpoint spécifique pour la génération de texte avec pipeline
      const response = await axios.post(
        `https://api-inference.huggingface.co/pipeline/text-generation/${this.huggingFaceModel}`,
        {
          inputs: formattedPrompt,
          parameters: {
            max_new_tokens: options.max_tokens || 1024,
            temperature: options.temperature || 0.7,
            do_sample: true,
            return_full_text: false
          }
        },
        {
          timeout: options.timeout || 120000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.huggingFaceToken}`,
          },
        },
      );

      this.logger.debug(`Réponse brute de Hugging Face: ${JSON.stringify(response.data)}`);

      // Gérer différents formats de réponse possibles
      if (response.data) {
        // Format 1: Tableau d'objets avec generated_text
        if (Array.isArray(response.data) && response.data.length > 0) {
          if (response.data[0].generated_text) {
            return response.data[0].generated_text;
          }
        }
        
        // Format 2: Tableau de chaînes
        if (Array.isArray(response.data) && typeof response.data[0] === 'string') {
          return response.data[0];
        }
        
        // Format 3: Objet avec generated_text
        if (response.data.generated_text) {
          return response.data.generated_text;
        }
        
        // Format 4: Chaîne simple
        if (typeof response.data === 'string') {
          return response.data;
        }
      }

      throw new Error('Format de réponse inattendu');
    } catch (error) {
      if (error.response?.data?.error?.includes('currently loading')) {
        this.logger.log('Le modèle est en cours de chargement, attente...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        return this.sendMessageToHuggingFace(content, options);
      }

      // Si l'erreur est "Task not found", essayons avec l'endpoint standard
      if (error.response?.data?.error?.includes('Task not found')) {
        this.logger.log("Erreur 'Task not found', tentative avec l'endpoint standard...");
        
        const standardResponse = await axios.post(
          `https://api-inference.huggingface.co/models/${this.huggingFaceModel}`,
          {
            inputs: formattedPrompt
          },
          {
            timeout: options.timeout || 120000,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.huggingFaceToken}`,
            },
          }
        );

        if (standardResponse.data && Array.isArray(standardResponse.data)) {
          return standardResponse.data[0].generated_text || standardResponse.data[0];
        }
      }

      throw error;
    }
  }

  /**
   * Analyse une question en utilisant un prompt spécifique
   */
  async analyseQuestion(question: string, promptName: string): Promise<any> {
    try {
      const prompt = this.getPrompt(promptName, { question });
      if (!prompt) {
        throw new Error(`Prompt non trouvé: ${promptName}`);
      }

      const response = await this.sendMessage(prompt);
      
      try {
        // Tenter de parser la réponse comme du JSON
        return JSON.parse(response);
      } catch (parseError) {
        // Si ce n'est pas du JSON valide, retourner la réponse brute
        this.logger.warn(`La réponse n'est pas un JSON valide: ${parseError.message}`);
        return { raw: response };
      }
    } catch (error) {
      this.logger.error(`Erreur lors de l'analyse de la question: ${error.message}`);
      throw error;
    }
  }
} 