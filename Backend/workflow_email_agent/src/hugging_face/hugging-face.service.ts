import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class HuggingFaceService {
  private readonly logger = new Logger(HuggingFaceService.name);
  private readonly token: string;
  private readonly invoiceModel = 'mychen76/invoice-and-receipts_donut_v1';
  private readonly apiUrl = 'https://api-inference.huggingface.co/models/';

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('HUGGING_FACE_TOKEN');

    if (!token) {
      throw new Error(
        "Token Hugging Face manquant dans les variables d'environnement",
      );
    }

    this.token = token;
    this.logger.log('Service Hugging Face initialisé');
  }

  /**
   * Analyse une image de facture avec le modèle Donut pour factures
   * @param imageBuffer Buffer contenant l'image de la facture
   * @returns Les données extraites de la facture
   */
  async analyzeInvoice(imageBuffer: Buffer): Promise<any> {
    try {
      this.logger.log('Analyse de facture avec le modèle Donut...');

      const response = await axios({
        method: 'post',
        url: `${this.apiUrl}${this.invoiceModel}`,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        data: {
          inputs: imageBuffer.toString('base64'),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      this.logger.log('Analyse terminée avec succès');
      return response.data;
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'analyse de la facture:",
        error.response?.data || error.message,
      );
      throw new Error(`Échec de l'analyse de facture: ${error.message}`);
    }
  }

  /**
   * Extrait les informations structurées d'une facture à partir des prédictions du modèle
   * @param predictions Résultats bruts du modèle Donut
   * @returns Objet contenant les informations structurées (montant, date, numéro, etc.)
   */
  extractStructuredData(predictions: any): {
    invoiceNumber: string | null;
    amount: string | null;
    date: string | null;
    supplier: string | null;
  } {
    const result: {
      invoiceNumber: string | null;
      amount: string | null;
      date: string | null;
      supplier: string | null;
    } = {
      invoiceNumber: null,
      amount: null,
      date: null,
      supplier: null,
    };

    // Analyser les prédictions du modèle Donut et extraire les informations pertinentes
    try {
      // Le modèle Donut peut renvoyer des résultats structurés différemment
      if (predictions && typeof predictions === 'string') {
        // Si c'est une chaîne JSON, essayons de la parser
        try {
          const parsed = JSON.parse(predictions);

          if (parsed.invoice_number) {
            result.invoiceNumber = parsed.invoice_number;
          }
          if (parsed.total || parsed.amount) {
            result.amount = parsed.total || parsed.amount;
          }
          if (parsed.date) {
            result.date = parsed.date;
          }
          if (parsed.supplier || parsed.vendor || parsed.company) {
            result.supplier =
              parsed.supplier || parsed.vendor || parsed.company;
          }

          return result;
        } catch (jsonError) {
          console.log(jsonError);
          const invoiceMatch = predictions.match(
            /(?:facture|invoice|n°|no)[:\s]*([A-Za-z0-9-_]{3,})/i,
          );

          if (invoiceMatch && invoiceMatch[1]) {
            result.invoiceNumber = invoiceMatch[1];
          }

          const amountMatch = predictions.match(
            /(?:montant|amount|total)[:\s]*(?:EUR|€|USD|\$)?\s*([0-9\s,.]+)/i,
          );
          if (amountMatch && amountMatch[1]) {
            result.amount = amountMatch[1].replace(/\s+/g, '');
          }

          const dateMatch = predictions.match(
            /(?:date)[:\s]*([0-9]{1,2}[/.\\-][0-9]{1,2}[/.\\-][0-9]{2,4})/i,
          );
          if (dateMatch && dateMatch[1]) {
            result.date = dateMatch[1];
          }
        }
      } else if (predictions && typeof predictions === 'object') {
        // Si c'est déjà un objet structuré
        if (predictions.invoice_number) {
          result.invoiceNumber = predictions.invoice_number;
        }
        if (predictions.total || predictions.amount) {
          result.amount = predictions.total || predictions.amount;
        }
        if (predictions.date) {
          result.date = predictions.date;
        }
        if (predictions.supplier || predictions.vendor || predictions.company) {
          result.supplier =
            predictions.supplier || predictions.vendor || predictions.company;
        }
      }
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'extraction des données structurées:",
        error,
      );
    }

    return result;
  }
}
