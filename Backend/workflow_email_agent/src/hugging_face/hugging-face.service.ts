import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { HfInference } from '@huggingface/inference';

@Injectable()
export class HuggingFaceService {
  private readonly logger = new Logger(HuggingFaceService.name);
  private readonly token: string;
  private readonly invoiceModel = 'mychen76/invoice-and-receipts_donut_v1';
  private readonly apiUrl = 'https://api-inference.huggingface.co/models/';
  private readonly extractPdfPath: string;
  private readonly hf: HfInference;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('HUGGING_FACE_TOKEN');

    if (!token) {
      throw new Error(
        "Token Hugging Face manquant dans les variables d'environnement",
      );
    }

    this.token = token;
    // Initialiser le client HfInference
    this.hf = new HfInference(this.token);
    // Chemin pour sauvegarder les résultats d'analyse
    this.extractPdfPath = path.join('/app', 'extractPdf');
    this.logger.log('Service Hugging Face initialisé avec le modèle Donut');
  }

  /**
   * Analyse une image de facture avec le modèle Donut
   * @param imageBuffer Buffer contenant l'image de la facture
   * @returns Les données extraites de la facture
   */
  async analyzeInvoice(imageBuffer: Buffer): Promise<any> {
    const maxRetries = 3;
    const initialDelayMs = 1000;

    // Fonction de retry avec délai exponentiel
    const executeWithRetry = async (attempt: number): Promise<any> => {
      try {
        this.logger.log(
          `Analyse de facture avec le modèle Donut (tentative ${attempt}/${maxRetries})`,
        );

        // Utiliser l'API REST directement avec axios
        const response = await axios({
          method: 'post',
          url: `${this.apiUrl}${this.invoiceModel}`,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          data: {
            inputs: imageBuffer.toString('base64'),
            parameters: {
              return_tensors: false,
              task: 'document-question-answering',
              question:
                'Extract all invoice information including invoice number, date, total amount, and vendor details',
            },
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });

        this.logger.log('Analyse Hugging Face terminée avec succès');

        // Le format de réponse du modèle Donut est différent
        return this.processDonutResponse(response.data);
      } catch (error) {
        // Vérifier si l'erreur est un 503 (Service Unavailable) ou 429 (Too Many Requests)
        if (
          error.response &&
          (error.response.status === 503 || error.response.status === 429) &&
          attempt < maxRetries
        ) {
          // Calculer un délai exponentiel avec un peu de jitter aléatoire
          const delayMs =
            initialDelayMs *
            Math.pow(2, attempt - 1) *
            (1 + Math.random() * 0.1);
          this.logger.warn(
            `Service Hugging Face indisponible (${error.response.status}). Nouvelle tentative dans ${delayMs}ms...`,
          );

          // Attendre le délai avant de réessayer
          await new Promise((resolve) => setTimeout(resolve, delayMs));

          // Réessayer avec le compteur incrémenté
          return executeWithRetry(attempt + 1);
        }

        // Si ce n'est pas une erreur 503/429 ou si on a dépassé le nombre de tentatives, on propage l'erreur
        this.logger.error(
          "Erreur lors de l'analyse de la facture:",
          error.response?.data || error.message,
        );
        throw new Error(`Échec de l'analyse de facture: ${error.message}`);
      }
    };

    // Démarrer avec la première tentative
    return executeWithRetry(1);
  }

  /**
   * Extrait les informations structurées d'une facture à partir des prédictions du modèle
   * @param predictions Résultats bruts du modèle LayoutLM
   * @returns Objet contenant les informations structurées (montant, date, numéro, etc.)
   */
  extractStructuredData(predictions: any): {
    invoiceNumber: string | null;
    amount: string | null;
    date: string | null;
    supplier: string | null;
    lineItems: any[];
    totalHT?: string | null;
    totalTVA?: string | null;
    totalTTC?: string | null;
    iban?: string | null;
    bic?: string | null;
  } {
    const result: {
      invoiceNumber: string | null;
      amount: string | null;
      date: string | null;
      supplier: string | null;
      lineItems: any[];
      totalHT?: string | null;
      totalTVA?: string | null;
      totalTTC?: string | null;
      iban?: string | null;
      bic?: string | null;
    } = {
      invoiceNumber: null,
      amount: null,
      date: null,
      supplier: null,
      lineItems: [], // Initialisation avec un tableau vide pour éviter les undefined
      totalHT: null,
      totalTVA: null,
      totalTTC: null,
      iban: null,
      bic: null,
    };

    // Analyser les prédictions du modèle LayoutLM et extraire les informations pertinentes
    try {
      this.logger.log(
        'Extraction des données structurées à partir des prédictions',
      );
      this.logger.debug(
        'Données brutes:',
        JSON.stringify(predictions).substring(0, 200) + '...',
      );

      // Vérifier si le résultat est une chaîne JSON
      if (predictions && typeof predictions === 'string') {
        try {
          // Essayer de trouver un JSON dans la chaîne (parfois il y a du texte avant/après)
          const jsonMatch = predictions.match(/{[\s\S]*}/);
          if (jsonMatch) {
            const parsedJson = JSON.parse(jsonMatch[0]);
            return this.extractFromParsedJson(parsedJson);
          }

          // Si pas de JSON, essayer de parser la chaîne entière
          const parsed = JSON.parse(predictions);
          return this.extractFromParsedJson(parsed);
        } catch (jsonError) {
          this.logger.warn('Erreur lors du parsing JSON:', jsonError.message);
          // Continuer avec l'extraction par regex
        }
      } else if (predictions && typeof predictions === 'object') {
        // Si c'est déjà un objet structuré
        return this.extractFromParsedJson(predictions);
      }

      // Extraction par regex si les méthodes précédentes ont échoué
      this.logger.debug('Extraction par regex');

      // Extraction du numéro de facture
      const invoiceMatch = String(predictions).match(
        /(?:facture|invoice|n°|no)[:\s]*([A-Za-z0-9-_]{3,})/i,
      );
      if (invoiceMatch && invoiceMatch[1]) {
        result.invoiceNumber = invoiceMatch[1];
      }

      // Extraction du montant total
      const amountMatch = String(predictions).match(
        /(?:NET A PAYER|TOTAL TTC|montant|amount|total)[:\s]*(?:EUR|€|USD|\$)?\s*([0-9\s,.]+)/i,
      );
      if (amountMatch && amountMatch[1]) {
        result.amount = amountMatch[1].replace(/\s+/g, '');
        result.totalTTC = result.amount;
      }

      // Extraction de la date
      const dateMatch = String(predictions).match(
        /(?:date)[:\s]*([0-9]{1,2}[/.\\-][0-9]{1,2}[/.\\-][0-9]{2,4})/i,
      );
      if (dateMatch && dateMatch[1]) {
        result.date = dateMatch[1];
      }

      // Extraction du fournisseur
      const supplierMatch = String(predictions).match(
        /(?:fournisseur|émetteur|émis par|supplier|SOLUTION LOGIQUE)[:\s]*([A-Za-z0-9\s,.&]+)(?:$|\n)/i,
      );
      if (supplierMatch && supplierMatch[1]) {
        result.supplier = supplierMatch[1].trim();
      } else if (String(predictions).includes('SOLUTION LOGIQUE')) {
        result.supplier = 'SOLUTION LOGIQUE';
      }

      // Extraction du total HT
      const htMatch = String(predictions).match(
        /(?:Total Net HT|Total HT)[:\s]*([0-9\s,.]+)/i,
      );
      if (htMatch && htMatch[1]) {
        result.totalHT = htMatch[1].replace(/\s+/g, '');
      }

      // Extraction du total TVA
      const tvaMatch = String(predictions).match(
        /(?:Total TVA)[:\s]*([0-9\s,.]+)/i,
      );
      if (tvaMatch && tvaMatch[1]) {
        result.totalTVA = tvaMatch[1].replace(/\s+/g, '');
      }

      // Extraction de l'IBAN
      const ibanMatch = String(predictions).match(/IBAN[:\s]*([A-Z0-9\s]+)/i);
      if (ibanMatch && ibanMatch[1]) {
        result.iban = ibanMatch[1].replace(/\s+/g, '');
      }

      // Extraction du BIC
      const bicMatch = String(predictions).match(/BIC[:\s]*([A-Z]+)/i);
      if (bicMatch && bicMatch[1]) {
        result.bic = bicMatch[1];
      }

      // Extraction des lignes d'articles (regex complexe pour capturer les lignes)
      const lineItemRegex =
        /(\d+(?:[,.]\d+)?)\s+(.*?)\s+(\d+(?:[,.]\d+)?)\s*\|\s*(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)/g;
      let match;
      while ((match = lineItemRegex.exec(String(predictions))) !== null) {
        result.lineItems.push({
          quantity: match[1].replace(',', '.'),
          name: match[2].trim(),
          unit_price: match[3].replace(',', '.'),
          vat_rate: match[4].replace(',', '.'),
          total: match[5].replace(',', '.'),
        });
      }
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'extraction des données structurées:",
        error,
      );
    }

    return result;
  }

  /**
   * Extrait les données structurées à partir d'un objet JSON
   */
  private extractFromParsedJson(parsed: any): any {
    const result: any = {
      invoiceNumber: null,
      amount: null,
      date: null,
      supplier: null,
      lineItems: [],
      totalHT: null,
      totalTVA: null,
      totalTTC: null,
      iban: null,
      bic: null,
    };

    try {
      // Structure basée sur le modèle impira/layoutlm-invoices
      if (parsed.header) {
        // Extraction des informations d'en-tête
        result.invoiceNumber = parsed.header.invoice_no || null;
        result.date = parsed.header.invoice_date || null;
        result.supplier = parsed.header.seller || null;
        result.iban = parsed.header.iban || null;
        result.bic = parsed.header.bic || null;
      }

      // Extraction des lignes d'articles
      if (parsed.items && Array.isArray(parsed.items)) {
        result.lineItems = parsed.items.map((item) => ({
          name: item.item_desc || '',
          quantity: this.parseNumber(item.item_qty),
          price: this.parseNumber(item.item_net_price),
          total: this.parseNumber(item.item_net_worth),
          vat_rate: item.item_vat || '',
        }));
      }

      // Extraction des totaux
      if (parsed.summary) {
        result.totalHT = this.parseNumber(parsed.summary.total_net_worth);
        result.totalTVA = this.parseNumber(parsed.summary.total_vat);
        result.totalTTC = this.parseNumber(parsed.summary.total_gross_worth);
        result.amount = result.totalTTC; // Pour compatibilité
      }

      // Extraction des informations de paiement
      if (parsed.payment) {
        result.paymentMethod = parsed.payment.payment_method || null;
        result.dueDate = parsed.payment.due_date || null;
      }

      // Format alternatif possible
      if (parsed.invoice_number) result.invoiceNumber = parsed.invoice_number;
      if (parsed.date) result.date = parsed.date;
      if (parsed.supplier || parsed.vendor || parsed.company) {
        result.supplier = parsed.supplier || parsed.vendor || parsed.company;
      }
      if (parsed.total_amount || parsed.amount || parsed.total) {
        result.amount = this.parseNumber(
          parsed.total_amount || parsed.amount || parsed.total,
        );
      }
      if (parsed.items) result.lineItems = parsed.items;

      this.logger.debug('Extraction JSON réussie');
    } catch (error) {
      this.logger.error("Erreur lors de l'extraction à partir du JSON:", error);
    }

    return result;
  }

  /**
   * Convertit une chaîne représentant un nombre en nombre
   */
  private parseNumber(value: any): number | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
      // Nettoyer la chaîne
      const cleanValue = value
        .replace(/[^\d,.]/g, '') // Garder uniquement les chiffres, points et virgules
        .replace(',', '.'); // Normaliser le séparateur décimal

      const parsed = parseFloat(cleanValue);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  /**
   * Sauvegarde les données structurées au format JSON
   * @param invoiceNumber Numéro de la facture
   * @param supplier Nom du fournisseur
   * @param data Données structurées à sauvegarder
   */
  async saveStructuredData(
    invoiceNumber: string,
    supplier: string,
    data: any,
  ): Promise<string> {
    try {
      // Si le fournisseur n'est pas défini, utiliser un dossier par défaut
      const safeSupplier = supplier
        ? this.sanitizeFolderName(supplier)
        : 'non-classifie';

      // Créer le chemin du dossier pour la facture
      const supplierPath = path.join(this.extractPdfPath, safeSupplier);
      const invoicePath = path.join(supplierPath, invoiceNumber);

      // Créer les dossiers s'ils n'existent pas
      if (!fs.existsSync(supplierPath)) {
        await fs.promises.mkdir(supplierPath, { recursive: true });
      }

      if (!fs.existsSync(invoicePath)) {
        await fs.promises.mkdir(invoicePath, { recursive: true });
      }

      // Préparation des données au format JSON pour le modèle LayoutLM
      const jsonData = {
        header: {
          invoice_no: data.invoiceNumber || invoiceNumber,
          invoice_date: data.date || null,
          seller: data.supplier || supplier || 'SOLUTION LOGIQUE',
          client: data.client || null,
          client_address: data.clientAddress || null,
          iban: data.iban || null,
          bic: data.bic || null,
        },
        items: Array.isArray(data.lineItems)
          ? data.lineItems.map((item) => ({
              item_desc: item.name || 'Article',
              item_qty: item.quantity || 0,
              item_net_price: item.price || 0,
              item_net_worth: item.total || 0,
              item_vat: item.vat_rate || '20%',
            }))
          : [],
        summary: {
          total_net_worth: data.totalHT || 0,
          total_vat: data.totalTVA || 0,
          total_gross_worth: data.totalTTC || data.amount || 0,
        },
        payment: {
          payment_method:
            data.paymentMethod || data.paymentInfo?.paymentMethod || null,
          due_date: data.dueDate || data.paymentInfo?.dueDate || null,
        },
      };

      // Chemin du fichier JSON à créer
      const jsonFilePath = path.join(
        invoicePath,
        `${invoiceNumber}_huggingface.json`,
      );

      // Écrire le fichier JSON
      await fs.promises.writeFile(
        jsonFilePath,
        JSON.stringify(jsonData, null, 2),
        'utf8',
      );

      this.logger.log(`Données structurées sauvegardées dans: ${jsonFilePath}`);

      return jsonFilePath;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la sauvegarde des données structurées:',
        error,
      );
      throw error;
    }
  }

  /**
   * Sanitize un nom de dossier pour éviter les caractères spéciaux
   */
  private sanitizeFolderName(name: string): string {
    return name
      .replace(/[\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  // Nouvelle méthode pour transformer la réponse du modèle Donut
  private processDonutResponse(data: any): any {
    this.logger.log('Traitement de la réponse Donut...');

    try {
      // Avec le modèle Donut, la réponse est généralement une chaîne structurée
      let responseText = '';

      // Gestion des différents formats possibles de réponse
      if (typeof data === 'string') {
        responseText = data;
      } else if (data && data.answer) {
        responseText = data.answer;
      } else if (data && data.generated_text) {
        responseText = data.generated_text;
      } else {
        responseText = JSON.stringify(data);
      }

      this.logger.debug('Réponse brute du modèle Donut:', responseText);

      // Extraction des informations structurées depuis la réponse textuelle
      const extractedData = this.extractStructuredData(responseText);

      // Adapter au format attendu par le reste de l'application
      return {
        header: {
          invoice_no: extractedData.invoiceNumber,
          invoice_date: extractedData.date,
          seller: extractedData.supplier,
          iban: extractedData.iban,
          bic: extractedData.bic,
        },
        summary: {
          total_net_worth: extractedData.totalHT,
          total_vat: extractedData.totalTVA,
          total_gross_worth: extractedData.amount || extractedData.totalTTC,
        },
        items: extractedData.lineItems.map((item) => ({
          item_desc: item.name || '',
          item_qty: item.quantity || '1',
          item_net_price: item.unit_price || '0',
          item_net_worth: item.total || '0',
          item_vat: item.vat_rate || '20%',
        })),
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors du traitement de la réponse Donut:',
        error,
      );
      // En cas d'erreur, retourner une structure minimale pour éviter les crashes
      return {
        header: {
          invoice_no: null,
          invoice_date: null,
          seller: null,
        },
        summary: {
          total_gross_worth: null,
        },
      };
    }
  }

  /**
   * Extrait les données d'une facture en utilisant le modèle Donut de Katana ML
   * @param imageData Image de la facture (Buffer ou string base64)
   * @returns Données structurées extraites de la facture
   */
  async extractInvoiceData(imageData: Buffer | string): Promise<any> {
    const maxRetries = 3;
    const initialDelayMs = 1000;
    const katanamlModel = 'katanaml-org/invoices-donut-model-v1';

    // Fonction de retry avec délai exponentiel
    const executeWithRetry = async (attempt: number): Promise<any> => {
      try {
        this.logger.log(
          `Extraction de données avec le modèle Katana ML Donut (tentative ${attempt}/${maxRetries})`,
        );

        // Préparer le buffer d'image à partir des données d'entrée
        let imageBuffer: Buffer;
        if (Buffer.isBuffer(imageData)) {
          // Si c'est déjà un Buffer, l'utiliser directement
          imageBuffer = imageData;
        } else if (typeof imageData === 'string') {
          // Si c'est une chaîne, vérifier s'il s'agit d'une data URL
          if (imageData.startsWith('data:')) {
            // Format data URL
            const base64Data = imageData.split(',')[1];
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else {
            // Format base64 simple
            imageBuffer = Buffer.from(imageData, 'base64');
          }
        } else {
          throw new Error("Format de données d'image non pris en charge");
        }

        // Utiliser le client HfInference pour appeler le modèle
        const result = await this.hf.imageToText({
          model: katanamlModel,
          data: imageBuffer,
        });

        this.logger.log('Analyse avec Katana ML Donut terminée avec succès');
        return result;
      } catch (error) {
        // Vérifier si l'erreur est un 503 (Service Unavailable) ou 429 (Too Many Requests)
        if (
          error.response?.status === 503 ||
          error.response?.status === 429 ||
          error.message?.includes('503') ||
          error.message?.includes('429')
        ) {
          if (attempt < maxRetries) {
            // Calculer un délai exponentiel avec un peu de jitter aléatoire
            const delayMs =
              initialDelayMs *
              Math.pow(2, attempt - 1) *
              (1 + Math.random() * 0.1);
            this.logger.warn(
              `Service Hugging Face indisponible. Nouvelle tentative dans ${delayMs}ms...`,
            );

            // Attendre le délai avant de réessayer
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            // Réessayer avec le compteur incrémenté
            return executeWithRetry(attempt + 1);
          }
        }

        // Si ce n'est pas une erreur 503/429 ou si on a dépassé le nombre de tentatives, on propage l'erreur
        this.logger.error(
          "Erreur lors de l'extraction des données avec Katana ML Donut:",
          error.response?.data || error.message,
        );
        throw new Error(`Échec de l'extraction de données: ${error.message}`);
      }
    };

    // Démarrer avec la première tentative
    return executeWithRetry(1);
  }
}
