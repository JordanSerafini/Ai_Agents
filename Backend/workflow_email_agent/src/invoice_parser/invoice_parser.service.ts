import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { EmailSortService } from '../email_sort/email-sort.service';
import { HuggingFaceService } from '../hugging_face/hugging-face.service';
import * as tesseract from 'node-tesseract-ocr';
import * as pdfParse from 'pdf-parse';
import * as Imap from 'imap';
import { simpleParser } from 'mailparser';
import { Stream } from 'stream';
import * as crypto from 'crypto';
import axios from 'axios';

// Interface pour l'analyse détaillée des factures
interface DetailedInvoiceAnalysis {
  supplier: string;
  supplierAddress: string;
  supplierZipCode: string;
  supplierCity: string;
  lineItems: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
    description?: string;
  }>;
  totalHT: number;
  totalTVA?: number;
  totalTTC: number;
  paymentInfo: {
    iban?: string;
    bic?: string;
    paymentMethod?: string;
    dueDate?: string;
  };
  confidence: number;
}

@Injectable()
export class InvoiceParserService {
  private readonly logger = new Logger(InvoiceParserService.name);
  private readonly extractPdfPath: string;
  private readonly toAnalysePath: string;
  private imap: Imap;
  private tesseractConfig = {
    lang: 'fra+eng',
    oem: 1,
    psm: 3,
  };
  private readonly mistralApiKey: string;

  // Informations à extraire des factures
  private readonly extractionPatterns = {
    amount:
      /(?:montant|amount|total)[:\s]*(?:EUR|€|USD|\$)?\s*([0-9\s,.]+)(?:\s*(?:EUR|€|USD|\$))?/i,
    date: /(?:date|émission|émise le)[:\s]*([0-9]{1,2}[/.\\-][0-9]{1,2}[/.\\-][0-9]{2,4})/i,
    supplier:
      /(?:fournisseur|émetteur|émis par|supplier)[:\s]*([A-Za-z0-9\s,.&]+)(?:$|\n)/i,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly emailSortService: EmailSortService,
    private readonly huggingFaceService: HuggingFaceService,
  ) {
    // Chemins des dossiers de traitement (adaptés pour Docker)
    this.extractPdfPath = path.join('/app', 'extractPdf');
    this.toAnalysePath = path.join('/app', 'persistence', 'toAnalyse');
    void this.ensureDirectories();

    // Clé API pour Mistral AI
    this.mistralApiKey =
      this.configService.get<string>('MISTRAL_API_KEY') || '';

    // Configuration IMAP
    const user = this.configService.get<string>('EMAIL_USER');
    const password = this.configService.get<string>('EMAIL_PASSWORD');
    const host = this.configService.get<string>('IMAP_HOST');
    const portStr = this.configService.get<string>('IMAP_PORT');

    if (!user || !password || !host || !portStr) {
      throw new Error('Configuration IMAP manquante');
    }

    this.imap = new Imap({
      user,
      password,
      host,
      port: parseInt(portStr, 10),
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });
  }

  private async ensureDirectories(): Promise<void> {
    try {
      if (!fs.existsSync(this.extractPdfPath)) {
        await fs.promises.mkdir(this.extractPdfPath, { recursive: true });
        this.logger.log(`Dossier d'extraction créé: ${this.extractPdfPath}`);
      }

      if (!fs.existsSync(this.toAnalysePath)) {
        await fs.promises.mkdir(this.toAnalysePath, { recursive: true });
        this.logger.log(`Dossier d'analyse créé: ${this.toAnalysePath}`);
      }
    } catch (error) {
      this.logger.error(`Erreur lors de la création des dossiers:`, error);
    }
  }

  async extractAndProcessInvoices(): Promise<{
    processed: number;
    failed: number;
    invoiceNumbers: string[];
  }> {
    this.logger.log("Démarrage de l'extraction et du traitement des factures");

    try {
      // Connexion à la boîte mail
      await this.connectToMailbox();

      // Recherche des emails dans le dossier "Factures"
      const invoices = await this.fetchInvoicesFromFolder();

      if (invoices.length === 0) {
        this.logger.log('Aucune facture trouvée dans le dossier');
        return { processed: 0, failed: 0, invoiceNumbers: [] };
      }

      this.logger.log(`${invoices.length} factures trouvées à traiter`);

      // Traitement des factures trouvées
      const results = await this.processInvoices(invoices);

      // Déconnexion
      await this.disconnectMailbox();

      return results;
    } catch (error) {
      this.logger.error("Erreur lors de l'extraction des factures:", error);
      await this.disconnectMailbox();
      return { processed: 0, failed: 1, invoiceNumbers: [] };
    }
  }

  private async connectToMailbox(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.logger.log('Connexion à la boîte mail...');

      this.imap.once('ready', () => {
        this.imap.openBox('Factures', false, (err) => {
          if (err) {
            reject(
              new Error(
                `Erreur lors de l'ouverture du dossier Factures: ${err.message}`,
              ),
            );
            return;
          }
          this.logger.log('Connexion établie et dossier Factures ouvert');
          resolve();
        });
      });

      this.imap.once('error', (err) => {
        reject(new Error(`Erreur de connexion IMAP: ${err.message}`));
      });

      this.imap.connect();
    });
  }

  private async disconnectMailbox(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.imap && this.imap.state !== 'disconnected') {
        this.imap.end();
        this.logger.log('Déconnexion de la boîte mail');
      }
      resolve();
    });
  }

  private async fetchInvoicesFromFolder(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.logger.log('Récupération des factures depuis le dossier "Factures"');

      // Rechercher tous les messages non traités (sans marqueur spécifique)
      this.imap.search(['ALL'], (err, results) => {
        if (err) {
          reject(
            new Error(`Erreur lors de la recherche des emails: ${err.message}`),
          );
          return;
        }

        if (!results || results.length === 0) {
          this.logger.log('Aucun email trouvé dans le dossier Factures');
          resolve([]);
          return;
        }

        this.logger.log(
          `${results.length} emails trouvés dans le dossier Factures`,
        );
        resolve(results);
      });
    });
  }

  private async processInvoices(invoices: number[]): Promise<{
    processed: number;
    failed: number;
    invoiceNumbers: string[];
  }> {
    let processed = 0;
    let failed = 0;
    const invoiceNumbers: string[] = [];

    // Traiter par lots pour éviter de surcharger la mémoire
    const batchSize = 10;
    for (let i = 0; i < invoices.length; i += batchSize) {
      const batch = invoices.slice(i, i + batchSize);
      this.logger.log(
        `Traitement du lot ${i / batchSize + 1}/${Math.ceil(invoices.length / batchSize)}`,
      );

      // Traiter chaque email du lot
      const batchResults = await this.processBatch(batch);

      // Mettre à jour les compteurs
      processed += batchResults.processed;
      failed += batchResults.failed;
      invoiceNumbers.push(...batchResults.invoiceNumbers);
    }

    this.logger.log(
      `Traitement terminé: ${processed} factures traitées, ${failed} échecs`,
    );
    return { processed, failed, invoiceNumbers };
  }

  private async processBatch(uids: number[]): Promise<{
    processed: number;
    failed: number;
    invoiceNumbers: string[];
  }> {
    return new Promise((resolve) => {
      let processed = 0;
      let failed = 0;
      const invoiceNumbers: string[] = [];

      const fetch = this.imap.fetch(uids, { bodies: [''], struct: true });

      fetch.on('message', (msg) => {
        let uid: number;
        let buffer = '';
        const attachments: any[] = [];

        msg.on('attributes', (attrs) => {
          uid = attrs.uid;

          // Extraire les infos sur les pièces jointes
          if (attrs.struct) {
            this.findAttachmentParts(attrs.struct, attachments);
          }
        });

        msg.on('body', (stream: Stream) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
        });

        msg.once('end', () => {
          // Processus asynchrone mais nous ne pouvons pas await dans l'événement
          void this.processEmailContent(buffer, uid, attachments)
            .then((result) => {
              if (result.success) {
                processed++;
                if (result.invoiceNumber) {
                  invoiceNumbers.push(result.invoiceNumber);
                }
              } else {
                failed++;
              }
            })
            .catch(() => {
              failed++;
            });
        });
      });

      fetch.once('end', () => {
        setTimeout(() => {
          // Attendre un peu pour laisser le temps aux promesses de se terminer
          resolve({ processed, failed, invoiceNumbers });
        }, 1000);
      });
    });
  }

  private findAttachmentParts(
    struct: any,
    attachments: any[],
    path: string = '',
  ) {
    if (!struct) return;

    if (Array.isArray(struct)) {
      struct.forEach((item, i) => {
        this.findAttachmentParts(item, attachments, `${path}.${i + 1}`);
      });
      return;
    }

    // Vérifier si cette partie est une pièce jointe
    if (
      struct.disposition &&
      ['attachment', 'inline'].includes(
        struct.disposition.type.toLowerCase(),
      ) &&
      struct.disposition.params && // Vérifier si params existe
      struct.disposition.params.filename // Vérifier si filename existe
    ) {
      attachments.push({
        filename: struct.disposition.params.filename,
        path: path,
        contentType: struct.type + '/' + struct.subtype,
      });
    }

    // Continuer la recherche dans les parties imbriquées
    if (struct.childNodes) {
      this.findAttachmentParts(struct.childNodes, attachments, path);
    }
  }

  private async processEmailContent(
    rawEmail: string,
    uid: number,
    attachments: any[],
  ): Promise<{ success: boolean; invoiceNumber?: string }> {
    try {
      // Analyser l'email
      const email = await simpleParser(rawEmail);

      // Filtrer uniquement les pièces jointes PDF
      const pdfAttachments = attachments.filter(
        (att) =>
          att.contentType === 'application/pdf' ||
          (att.filename && att.filename.toLowerCase().endsWith('.pdf')),
      );

      if (pdfAttachments.length === 0) {
        // Si l'email n'a pas de pièce jointe PDF, vérifier si le corps est une facture
        if (email.text) {
          const invoiceData = this.extractInvoiceData(email.text);
          if (invoiceData.invoiceNumber) {
            // Tronquer le numéro de facture si nécessaire pour éviter ENAMETOOLONG
            const safeInvoiceNumber = this.getSafeFilename(
              invoiceData.invoiceNumber,
            );
            invoiceData.invoiceNumber = safeInvoiceNumber;

            await this.saveTextContent(
              safeInvoiceNumber,
              email.text,
              invoiceData,
            );
            return { success: true, invoiceNumber: safeInvoiceNumber };
          }
        }
        return { success: false };
      }

      // Traiter chaque pièce jointe PDF
      for (const attachment of pdfAttachments) {
        // Récupérer la pièce jointe
        const pdfBuffer = await this.downloadAttachment(uid, attachment.path);
        if (!pdfBuffer) continue;

        // Extraire le texte du PDF
        const pdfText = await this.extractTextFromPdf({
          content: pdfBuffer,
          name: attachment.filename,
        });

        // Extraire les données de la facture
        const invoiceData = this.extractInvoiceData(pdfText);

        // Générer un nom de facture et s'assurer qu'il n'est pas trop long
        let invoiceNumber =
          invoiceData.invoiceNumber ||
          `FACTURE-${uid}-${attachment.filename.replace(/\.[^/.]+$/, '')}`;

        // Tronquer le numéro de facture si nécessaire
        invoiceNumber = this.getSafeFilename(invoiceNumber);

        // Mettre à jour l'objet de données avec le numéro de facture
        invoiceData.invoiceNumber = invoiceNumber;

        // Sauvegarder le contenu
        await this.savePdfAndText(
          invoiceNumber,
          pdfBuffer,
          pdfText,
          invoiceData,
        );

        return { success: true, invoiceNumber };
      }

      return { success: false };
    } catch (error) {
      this.logger.error(`Erreur lors du traitement de l'email ${uid}:`, error);
      return { success: false };
    }
  }

  private async downloadAttachment(
    uid: number,
    partPath: string,
  ): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const buffers: Buffer[] = [];

      const fetch = this.imap.fetch(uid, { bodies: [partPath] });

      fetch.on('message', (msg) => {
        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            buffers.push(Buffer.from(chunk));
          });

          stream.once('end', () => {
            const buffer = Buffer.concat(buffers);
            resolve(buffer);
          });
        });
      });

      fetch.once('error', () => {
        resolve(null);
      });

      fetch.once('end', () => {
        if (buffers.length === 0) {
          resolve(null);
        }
      });
    });
  }

  private async savePdfAndText(
    invoiceNumber: string,
    pdfBuffer: Buffer,
    text: string,
    invoiceData: {
      invoiceNumber: string | null;
      amount: string | null;
      date: string | null;
      supplier: string | null;
    },
  ): Promise<void> {
    try {
      // Déterminer le dossier racine en fonction du fournisseur si disponible
      const supplierFolder = invoiceData.supplier
        ? this.sanitizeFolderName(invoiceData.supplier)
        : 'non-classifie';

      // Créer un dossier pour cette facture
      const rootPath = path.join(this.extractPdfPath, supplierFolder);
      const invoiceFolderPath = path.join(rootPath, invoiceNumber);

      if (!fs.existsSync(rootPath)) {
        await fs.promises.mkdir(rootPath, { recursive: true });
      }

      if (!fs.existsSync(invoiceFolderPath)) {
        await fs.promises.mkdir(invoiceFolderPath, { recursive: true });
      }

      // Sauvegarder le PDF
      const pdfFilePath = path.join(invoiceFolderPath, `${invoiceNumber}.pdf`);
      await fs.promises.writeFile(pdfFilePath, pdfBuffer);

      // Sauvegarder le texte extrait
      const textFilePath = path.join(invoiceFolderPath, `${invoiceNumber}.txt`);
      await fs.promises.writeFile(textFilePath, text);

      // Sauvegarder les métadonnées de la facture
      const metadataFilePath = path.join(
        invoiceFolderPath,
        `${invoiceNumber}_metadata.json`,
      );
      await fs.promises.writeFile(
        metadataFilePath,
        JSON.stringify(invoiceData, null, 2),
      );

      this.logger.log(
        `Facture ${invoiceNumber} traitée et sauvegardée dans: ${invoiceFolderPath}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la sauvegarde de la facture ${invoiceNumber}:`,
        error,
      );
      throw error;
    }
  }

  private async saveTextContent(
    invoiceNumber: string,
    text: string,
    invoiceData: {
      invoiceNumber: string | null;
      amount: string | null;
      date: string | null;
      supplier: string | null;
    },
  ): Promise<void> {
    try {
      // Déterminer le dossier racine en fonction du fournisseur si disponible
      const supplierFolder = invoiceData.supplier
        ? this.sanitizeFolderName(invoiceData.supplier)
        : 'non-classifie';

      // Créer un dossier pour cette facture
      const rootPath = path.join(this.extractPdfPath, supplierFolder);
      const invoiceFolderPath = path.join(rootPath, invoiceNumber);

      if (!fs.existsSync(rootPath)) {
        await fs.promises.mkdir(rootPath, { recursive: true });
      }

      if (!fs.existsSync(invoiceFolderPath)) {
        await fs.promises.mkdir(invoiceFolderPath, { recursive: true });
      }

      // Sauvegarder le texte
      const textFilePath = path.join(invoiceFolderPath, `${invoiceNumber}.txt`);
      await fs.promises.writeFile(textFilePath, text);

      // Sauvegarder les métadonnées de la facture
      const metadataFilePath = path.join(
        invoiceFolderPath,
        `${invoiceNumber}_metadata.json`,
      );
      await fs.promises.writeFile(
        metadataFilePath,
        JSON.stringify(invoiceData, null, 2),
      );

      this.logger.log(
        `Facture texte ${invoiceNumber} traitée et sauvegardée dans: ${invoiceFolderPath}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la sauvegarde du texte de facture ${invoiceNumber}:`,
        error,
      );
      throw error;
    }
  }

  private sanitizeFolderName(name: string): string {
    // Remplacer les caractères non sûrs pour les noms de dossiers
    return name
      .replace(/[\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 50); // Limiter la longueur
  }

  public extractInvoiceData(text: string): {
    invoiceNumber: string | null;
    amount: string | null;
    date: string | null;
    supplier: string | null;
  } {
    const result = {
      invoiceNumber: null as string | null,
      amount: null as string | null,
      date: null as string | null,
      supplier: null as string | null,
    };

    try {
      // Extraction du numéro de facture - patterns améliorés
      const invoicePatterns = [
        /(?:facture|invoice|n°|no|number|ref|reference|FC)[:\s#]*([A-Za-z0-9][\w.-]{2,})/i,
        /(?:facture|invoice)[:\s#]*(?:n°|no|numéro|number)?[:\s#]*([A-Za-z0-9][\w.-]{2,})/i,
        /\b(FC\d{3,})\b/i,
      ];

      for (const pattern of invoicePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          result.invoiceNumber = match[1].trim();
          break;
        }
      }

      // Extraction du montant - patterns améliorés
      const amountPatterns = [
        /(?:total\s+ttc|net\s+à\s+payer|montant\s+total|total\s+amount)[:\s]*(?:EUR|€|USD|\$)?\s*([0-9\s,.]+)(?:\s*(?:EUR|€|USD|\$))?/i,
        /(?:montant|amount|total)[:\s]*(?:EUR|€|USD|\$)?\s*([0-9\s,.]+)(?:\s*(?:EUR|€|USD|\$))?/i,
        /([0-9]+[,.][0-9]{2})\s*(?:EUR|€|USD|\$)/i,
      ];

      for (const pattern of amountPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          result.amount = match[1].trim().replace(/\s+/g, '');
          break;
        }
      }

      // Extraction de la date - patterns améliorés
      const datePatterns = [
        /(?:date)[:\s]*([0-9]{1,2}[/.\\-][0-9]{1,2}[/.\\-][0-9]{2,4})/i,
        /(?:date\s+d'émission|date\s+facture|invoice\s+date|émise\s+le)[:\s]*([0-9]{1,2}[/.\\-][0-9]{1,2}[/.\\-][0-9]{2,4})/i,
        /\b([0-9]{1,2}[/.\\-][0-9]{1,2}[/.\\-](?:20)?[0-9]{2})\b/i,
      ];

      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          result.date = match[1].trim();
          break;
        }
      }

      // Extraction du fournisseur - patterns améliorés
      const supplierPatterns = [
        /(?:fournisseur|émetteur|émis par|supplier|vendor)[:\s]*([A-Za-z0-9\s,.&]{3,}?)(?:$|\n)/i,
        /^([A-Z][A-Za-z0-9\s,.&]{2,}?)\n/i,
      ];

      for (const pattern of supplierPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          result.supplier = match[1].trim();
          break;
        }
      }

      return result;
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'extraction des données de la facture:",
        error,
      );
      return result;
    }
  }

  private async extractTextFromPdf(pdf: {
    content: Buffer;
    name: string;
  }): Promise<string> {
    try {
      const pdfData = await pdfParse(pdf.content);
      let text = pdfData.text || '';

      // Si le texte est vide ou trop court, tenter d'utiliser OCR ou LayoutLMv3
      if (!text || text.length < 50) {
        this.logger.log(
          `Texte extrait trop court (${text.length} caractères), essai avec LayoutLMv3...`,
        );

        try {
          // Tenter d'abord l'analyse avec LayoutLMv3
          const layoutLmResult = await this.analyzePdfWithLayoutLm(pdf.content);

          if (layoutLmResult && layoutLmResult.length > 50) {
            this.logger.log('Texte extrait avec succès via LayoutLMv3');
            return layoutLmResult;
          }

          this.logger.log(
            'Résultat LayoutLMv3 insuffisant, essai avec Tesseract OCR...',
          );
        } catch (layoutLmError) {
          this.logger.error(
            'Erreur LayoutLMv3, repli sur Tesseract:',
            layoutLmError,
          );
        }

        // Si LayoutLMv3 échoue, repli sur Tesseract OCR
        try {
          // Convertir chaque page en image pour OCR
          const tempImagePath = path.join(
            this.extractPdfPath,
            `temp_${Date.now()}.png`,
          );

          // Utiliser la première page pour l'OCR
          const pngBuffer = await this.convertPdfToImage(pdf.content, 1);
          if (pngBuffer) {
            await fs.promises.writeFile(tempImagePath, pngBuffer);
            text = await tesseract.recognize(
              tempImagePath,
              this.tesseractConfig,
            );
            await fs.promises.unlink(tempImagePath);
          }
        } catch (ocrErr) {
          this.logger.error("Erreur lors de l'OCR:", ocrErr);
        }
      }

      return text;
    } catch (error) {
      this.logger.error("Erreur lors de l'extraction du texte du PDF:", error);
      return '';
    }
  }

  // Méthode pour convertir un PDF en image simplifiée (sans dépendances externes)
  private convertPdfToImage(
    pdfBuffer: Buffer,
    pageNum: number = 1,
  ): Promise<Buffer | null> {
    return new Promise<Buffer | null>((resolve) => {
      try {
        this.logger.log(`Préparation du PDF pour analyse (page ${pageNum})...`);

        // Approche simplifiée - utiliser directement le buffer PDF
        this.logger.log("Utilisation du buffer PDF brut pour l'analyse");
        resolve(pdfBuffer);
      } catch (error) {
        this.logger.error('Erreur lors de la préparation du PDF:', error);
        resolve(null);
      }
    });
  }

  // Maintenant publique pour être utilisée par le contrôleur
  public async analyzePdfWithLayoutLm(pdfBuffer: Buffer): Promise<string> {
    try {
      // Obtenir le buffer pour l'analyse
      const buffer = await this.convertPdfToImage(pdfBuffer, 1);

      if (!buffer) {
        throw new Error('Échec de la préparation du PDF pour analyse');
      }

      // Première tentative - essayer d'extraire le texte avec pdfParse
      const pdfData = await pdfParse(buffer);
      let extractedText = pdfData.text || '';

      // Si le texte extrait est suffisant, ne pas appeler Hugging Face
      if (extractedText && extractedText.length > 100) {
        this.logger.log('Texte extrait directement du PDF avec pdfParse');
        return extractedText;
      }

      this.logger.log('Texte insuffisant, tentative avec Hugging Face API...');

      // Si le texte est insuffisant, essayer avec Hugging Face
      try {
        // L'API peut ne pas fonctionner si elle s'attend à une image plutôt qu'un PDF
        const predictions =
          await this.huggingFaceService.analyzeInvoice(buffer);

        // Extraire les données structurées
        const structuredData =
          this.huggingFaceService.extractStructuredData(predictions);

        // Construire un texte à partir des prédictions pour extraction ultérieure
        if (Array.isArray(predictions)) {
          // Assembler le texte à partir des prédictions
          for (const prediction of predictions) {
            if (prediction.word || prediction.text) {
              extractedText += ' ' + (prediction.word || prediction.text);
            }
          }
        }

        // Ajouter les données structurées au texte pour la recherche de motifs
        if (structuredData.invoiceNumber) {
          extractedText += ` Numéro de facture: ${structuredData.invoiceNumber}`;
        }
        if (structuredData.amount) {
          extractedText += ` Montant: ${structuredData.amount}`;
        }
        if (structuredData.date) {
          extractedText += ` Date: ${structuredData.date}`;
        }
        if (structuredData.supplier) {
          extractedText += ` Fournisseur: ${structuredData.supplier}`;
        }

        this.logger.log('Texte extrait avec succès via HuggingFace');
        return extractedText.trim();
      } catch (huggingFaceError) {
        this.logger.error(
          "Erreur lors de l'analyse avec Hugging Face:",
          huggingFaceError,
        );

        // En cas d'échec, revenir au texte extrait par pdfParse
        if (extractedText) {
          this.logger.log(
            'Utilisation du texte extrait par pdfParse en solution de repli',
          );
          return extractedText;
        }

        throw new Error("Aucune méthode d'extraction n'a fonctionné");
      }
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse avec LayoutLMv3:", error);
      throw error;
    }
  }

  private extractInvoiceNumber(text: string): string | null {
    return this.extractInvoiceData(text).invoiceNumber;
  }

  // Fonction pour s'assurer que le nom de fichier/dossier n'est pas trop long
  private getSafeFilename(filename: string): string {
    // Limiter à 50 caractères pour éviter ENAMETOOLONG
    // Si le nom est trop long, générer un ID aléatoire court mais unique
    if (filename.length > 50) {
      const shortHash = crypto
        .createHash('md5')
        .update(filename)
        .digest('hex')
        .substring(0, 15);

      this.logger.log(
        `Nom de facture tronqué: "${filename}" -> "FACTURE-${shortHash}"`,
      );
      return `FACTURE-${shortHash}`;
    }
    return filename;
  }

  /**
   * Extrait les données de Hugging Face à partir du texte combiné
   * Cette méthode extrait les parties provenant de Hugging Face
   */
  public extractHuggingFaceData(combinedText: string): any {
    try {
      // Le texte combiné contient d'abord le texte OCR puis le texte Hugging Face
      // séparés par une double ligne vide
      const parts = combinedText.split('\n\n');
      if (parts.length < 2) {
        return this.extractInvoiceData(combinedText);
      }

      // La partie Hugging Face est après la première double ligne vide
      const huggingFaceText = parts.slice(1).join('\n\n');
      return this.extractInvoiceData(huggingFaceText);
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'extraction des données Hugging Face:",
        error,
      );
      return {};
    }
  }

  /**
   * Extrait les données OCR à partir du texte combiné
   * Cette méthode extrait les parties provenant de l'OCR
   */
  public extractTesseractData(combinedText: string): any {
    try {
      // Le texte OCR est dans la première partie avant la double ligne vide
      const parts = combinedText.split('\n\n');
      if (parts.length === 0) {
        return {};
      }

      const tesseractText = parts[0];
      return this.extractInvoiceData(tesseractText);
    } catch (error) {
      this.logger.error("Erreur lors de l'extraction des données OCR:", error);
      return {};
    }
  }

  /**
   * Analyse les données combinées avec Mistral AI
   * Cette fonction combine les données de Hugging Face (80%) et OCR (20%),
   * puis les envoie à Mistral AI pour une analyse détaillée
   */
  public async analyzeCombinedDataWithMistral(
    huggingFaceData: any,
    ocrData: any,
    fullText: string,
  ): Promise<DetailedInvoiceAnalysis> {
    try {
      this.logger.log('Analyse des données avec Mistral AI');

      // Préparer les données combinées avec pondération 80% HF / 20% OCR
      const combinedData = {
        invoiceNumber:
          huggingFaceData.invoiceNumber ||
          ocrData.invoiceNumber ||
          'Non trouvé',
        supplier: huggingFaceData.supplier || ocrData.supplier || 'Non trouvé',
        amount: huggingFaceData.amount || ocrData.amount || 'Non trouvé',
        date: huggingFaceData.date || ocrData.date || 'Non trouvé',
        fullText: fullText,
      };

      // Préparer la requête pour Mistral AI
      const prompt = `
      Voici le contenu d'une facture. Analyse cette facture et extrais les informations suivantes au format JSON :
      
      1. Fournisseur (nom de l'entreprise)
      2. Adresse complète du fournisseur (avec code postal et ville séparés)
      3. Toutes les lignes de facture/devis avec détails (quantité, prix unitaire, nom de l'article, description si disponible)
      4. Total HT, TVA (si disponible), et total TTC
      5. Informations de paiement (IBAN, BIC, méthode de paiement, date d'échéance)
      
      Voici les informations déjà extraites et leur texte complet:
      
      Numéro de facture: ${combinedData.invoiceNumber}
      Fournisseur: ${combinedData.supplier}
      Montant: ${combinedData.amount}
      Date: ${combinedData.date}
      
      Texte complet:
      ${combinedData.fullText.substring(0, 5000)}
      
      Réponds uniquement avec le JSON structuré, sans texte additionnel.
      `;

      // Si pas de clé API, utiliser une analyse basique
      if (!this.mistralApiKey) {
        this.logger.warn(
          "Clé API Mistral non configurée, utilisation de l'analyse basique",
        );
        return this.fallbackAnalysis(combinedData);
      }

      // Appel à l'API Mistral
      const response = await axios.post(
        'https://api.mistral.ai/v1/chat/completions',
        {
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 1500,
        },
        {
          headers: {
            Authorization: `Bearer ${this.mistralApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Extraire la réponse
      let result: DetailedInvoiceAnalysis;

      try {
        const content = response.data.choices[0].message.content;
        // Tenter de parser le JSON de la réponse
        result = JSON.parse(content);
      } catch (parseError) {
        this.logger.error(
          'Erreur de parsing de la réponse Mistral:',
          parseError,
        );
        // En cas d'échec, utiliser l'analyse basique
        result = this.fallbackAnalysis(combinedData);
      }

      // Ajouter le niveau de confiance
      result.confidence = 0.85; // Valeur arbitraire

      return result;
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse avec Mistral AI:", error);
      return this.fallbackAnalysis({
        invoiceNumber: 'Non trouvé',
        supplier: 'Non trouvé',
        amount: 'Non trouvé',
        date: 'Non trouvé',
        fullText: fullText,
      });
    }
  }

  /**
   * Méthode de secours pour l'analyse en cas d'échec de Mistral AI
   */
  private fallbackAnalysis(data: any): DetailedInvoiceAnalysis {
    return {
      supplier: data.supplier || 'Non trouvé',
      supplierAddress: 'Non trouvé',
      supplierZipCode: 'Non trouvé',
      supplierCity: 'Non trouvé',
      lineItems: [
        {
          name: 'Article non identifié',
          quantity: 1,
          price:
            parseFloat(
              data.amount?.replace(/[^\d,.]/g, '').replace(',', '.'),
            ) || 0,
          total:
            parseFloat(
              data.amount?.replace(/[^\d,.]/g, '').replace(',', '.'),
            ) || 0,
        },
      ],
      totalHT:
        parseFloat(data.amount?.replace(/[^\d,.]/g, '').replace(',', '.')) *
          0.8 || 0,
      totalTVA:
        parseFloat(data.amount?.replace(/[^\d,.]/g, '').replace(',', '.')) *
          0.2 || 0,
      totalTTC:
        parseFloat(data.amount?.replace(/[^\d,.]/g, '').replace(',', '.')) || 0,
      paymentInfo: {
        dueDate: data.date || 'Non trouvé',
      },
      confidence: 0.3, // Basse confiance pour l'analyse de secours
    };
  }
}
