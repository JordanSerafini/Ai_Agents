import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HfInference } from '@huggingface/inference';
import { MistralPromp } from './MistralPromp';

@Injectable()
export class ModelService {
  private readonly logger = new Logger(ModelService.name);
  private readonly huggingFaceToken?: string;
  private readonly hfModel?: HfInference;
  private readonly mistralModel = 'mistralai/Mistral-7B-Instruct-v0.2';

  constructor(private readonly configService: ConfigService) {
    this.huggingFaceToken =
      this.configService.get<string>('HUGGING_FACE_TOKEN');

    if (this.huggingFaceToken) {
      this.hfModel = new HfInference(this.huggingFaceToken);
      this.logger.log('Service HuggingFace initialisé');
    } else {
      this.logger.warn(
        'Token HuggingFace manquant - Service HuggingFace désactivé',
      );
    }
  }

  /**
   * Analyse une question avec le modèle Mistral via HuggingFace Inference API
   * @param question Question à analyser
   * @returns Réponse du modèle
   */
  async analyzeWithMistralHF(question: string): Promise<string> {
    try {
      if (!this.huggingFaceToken) {
        throw new Error('Token HuggingFace non configuré');
      }

      if (!this.hfModel) {
        throw new Error('Modèle HuggingFace non initialisé');
      }

      this.logger.log(
        `Analyse via HuggingFace: "${question.substring(0, 50)}..."`,
      );

      const prompt = `
[INST]
${question}
[/INST]`;

      const response = await this.hfModel.textGeneration({
        model: this.mistralModel,
        inputs: prompt,
        parameters: {
          max_new_tokens: 1512,
          temperature: 0.1,
          top_p: 0.95,
        },
      });

      return response.generated_text;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse HuggingFace: ${error.message}`,
      );
      throw new Error(`Erreur HuggingFac+e: ${error.message}`);
    }
  }

  /**
   * Analyse un fichier (image ou PDF) via HuggingFace Inference API
   * @param fileContent Contenu du fichier en base64
   * @param fileType Type MIME du fichier
   * @returns Description du contenu du fichier
   */
  async analyzeFileWithMistralHF(
    fileContent: string,
    fileType: string,
  ): Promise<string> {
    try {
      if (!this.huggingFaceToken) {
        throw new Error('Token HuggingFace non configuré');
      }

      if (!this.hfModel) {
        throw new Error('Modèle HuggingFace non initialisé');
      }

      this.logger.log(`Analyse de fichier ${fileType} via HuggingFace`);

      // Limiter la taille pour éviter de dépasser les limites de contexte
      const maxLength = 10000;
      const truncatedContent =
        fileContent.length > maxLength
          ? fileContent.substring(0, maxLength) + '...[contenu tronqué]'
          : fileContent;

      // Construire le prompt selon le type de fichier
      let prompt = '';
      if (fileType === 'application/pdf') {
        prompt = `
[INST]
Tu es un expert en analyse de documents. Voici un fichier PDF encodé en base64.
Décris le contenu principal et extrais les informations importantes.

${truncatedContent}
[/INST]`;
      } else if (fileType.startsWith('image/')) {
        prompt = `
[INST]
Tu es un expert en analyse d'images. Voici une image encodée en base64.
Décris en détail ce que tu vois dans cette image.

${truncatedContent}
[/INST]`;
      } else {
        prompt = `
[INST]
Analyse ce fichier encodé en base64 et décris son contenu.

${truncatedContent}
[/INST]`;
      }

      const response = await this.hfModel.textGeneration({
        model: this.mistralModel,
        inputs: prompt,
        parameters: {
          max_new_tokens: 2000,
          temperature: 0.1,
          top_p: 0.95,
        },
      });

      return response.generated_text;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de fichier: ${error.message}`,
      );
      throw new Error(`Erreur d'analyse de fichier: ${error.message}`);
    }
  }

  /**
   * Analyse une facture en combinant OCR et Donut, puis en soumettant le résultat à Mistral
   * @param ocrText Texte extrait par OCR
   * @param donutAnalysis Analyse structurée générée par Donut
   * @param fileContent Contenu encodé en base64 du fichier original (optionnel)
   * @returns Résultat d'analyse validé et structuré
   */
  async analyzeInvoiceCombined(
    ocrText: string,
    donutAnalysis: any,
    fileContent?: string,
  ): Promise<any> {
    try {
      if (!this.huggingFaceToken) {
        throw new Error('Token HuggingFace non configuré');
      }

      if (!this.hfModel) {
        throw new Error('Modèle HuggingFace non initialisé');
      }

      this.logger.log('Analyse combinée de facture via HuggingFace');

      // Préparer le prompt en utilisant le template défini dans MistralPromp
      const prompt = `
[INST]
${MistralPromp.analyzeFile}

# Analyse OCR
${ocrText}

# Analyse Donut (LLM fine-tuné)
${JSON.stringify(donutAnalysis, null, 2)}

${
  fileContent
    ? `# Contenu du fichier (base64, partiel)
${fileContent.substring(0, 3000)}...`
    : ''
}
[/INST]`;

      const response = await this.hfModel.textGeneration({
        model: this.mistralModel,
        inputs: prompt,
        parameters: {
          max_new_tokens: 3000,
          temperature: 0.1,
          top_p: 0.95,
        },
      });

      // Essayer d'extraire le JSON de la réponse
      try {
        const jsonMatch = response.generated_text.match(/{[\s\S]*}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (jsonError) {
        this.logger.warn(`Erreur lors du parsing JSON: ${jsonError.message}`);
      }

      // Si aucun JSON valide n'a été trouvé, retourner la réponse brute
      return {
        analyse: response.generated_text,
        note: 0,
        analyse_csv: null,
      };
    } catch (error) {
      this.logger.error(`Erreur lors de l'analyse combinée: ${error.message}`);
      throw new Error(`Erreur d'analyse combinée: ${error.message}`);
    }
  }
}
