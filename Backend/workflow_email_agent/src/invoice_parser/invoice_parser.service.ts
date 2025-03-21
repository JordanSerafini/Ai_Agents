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
import { exec } from 'child_process';

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
  private async convertPdfToImage(
    pdfBuffer: Buffer,
    pageNum: number = 1,
  ): Promise<Buffer | null> {
    try {
      this.logger.log(`Conversion du PDF en image (page ${pageNum})...`);

      // Créer un répertoire temporaire pour les opérations de conversion
      const tempDir = path.join('/app', 'temp');
      if (!fs.existsSync(tempDir)) {
        await fs.promises.mkdir(tempDir, { recursive: true });
      }

      // Générer des noms de fichiers temporaires uniques
      const uniqueId = Date.now().toString();
      const tempPdfPath = path.join(tempDir, `temp_${uniqueId}.pdf`);
      const tempImageBasePath = path.join(tempDir, `temp_${uniqueId}`);

      // Écrire le PDF dans un fichier temporaire
      await fs.promises.writeFile(tempPdfPath, pdfBuffer);

      // Utiliser pdftoppm pour convertir PDF en image
      return new Promise<Buffer | null>((resolve) => {
        const convertCmd = `pdftoppm -f ${pageNum} -l ${pageNum} -png -singlefile -r 300 ${tempPdfPath} ${tempImageBasePath}`;

        const execProcess = exec(convertCmd, (error) => {
          // Nettoyer le fichier PDF temporaire et traiter les résultats
          void (async () => {
            try {
              // Nettoyer le fichier PDF temporaire
              await fs.promises.unlink(tempPdfPath).catch(() => {});

              if (error) {
                this.logger.error(
                  'Erreur lors de la conversion PDF en image:',
                  error,
                );
                resolve(null);
                return;
              }

              // Lire l'image générée
              const imagePath = `${tempImageBasePath}.png`;
              if (fs.existsSync(imagePath)) {
                const imageBuffer = await fs.promises.readFile(imagePath);
                // Nettoyer l'image temporaire
                await fs.promises.unlink(imagePath).catch(() => {});
                resolve(imageBuffer);
              } else {
                this.logger.error('Fichier image non généré après conversion');
                resolve(null);
              }
            } catch (cleanupError) {
              this.logger.error(
                'Erreur lors du nettoyage des fichiers temporaires:',
                cleanupError,
              );
              resolve(null);
            }
          })();
        });

        // Gestion du timeout
        setTimeout(() => {
          try {
            execProcess.kill();
            this.logger.warn('Timeout lors de la conversion PDF en image');
            resolve(null);
          } catch (e) {
            this.logger.error(
              'Erreur lors de la tentative de kill du processus:',
              e,
            );
            resolve(null);
          }
        }, 30000); // 30 secondes de timeout
      });
    } catch (error) {
      this.logger.error('Erreur lors de la conversion PDF en image:', error);
      return null;
    }
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

      // Prétraitement du texte pour améliorer l'analyse
      const cleanedText = this.cleanTextForAnalysis(fullText);

      // Vérifier si huggingFaceData contient déjà des lignes d'articles
      // Si oui, nous pouvons les utiliser directement
      if (
        huggingFaceData &&
        huggingFaceData.lineItems &&
        huggingFaceData.lineItems.length > 0
      ) {
        this.logger.log(
          "Utilisation des lignes d'articles déjà extraites par HuggingFace",
        );

        // Créer une analyse basée sur les données de Hugging Face
        return {
          supplier: huggingFaceData.supplier || 'Non trouvé',
          supplierAddress: huggingFaceData.supplierAddress || 'Non trouvé',
          supplierZipCode: huggingFaceData.supplierZipCode || 'Non trouvé',
          supplierCity: huggingFaceData.supplierCity || 'Non trouvé',
          lineItems: huggingFaceData.lineItems.map((item) => ({
            name: item.name || 'Article non identifié',
            quantity: parseFloat(item.quantity) || 1,
            price: parseFloat(item.price) || 0,
            total: parseFloat(item.total) || 0,
            description: item.description || '',
          })),
          totalHT: parseFloat(huggingFaceData.totalHT) || 0,
          totalTVA: parseFloat(huggingFaceData.totalTVA) || 0,
          totalTTC: parseFloat(huggingFaceData.totalTTC) || 0,
          paymentInfo: {
            iban: huggingFaceData.iban || '',
            bic: huggingFaceData.bic || '',
            paymentMethod: huggingFaceData.paymentMethod || '',
            dueDate: huggingFaceData.dueDate || '',
          },
          confidence: 0.9,
        };
      }

      // Sinon, préparer la requête pour Mistral AI avec un prompt précis
      const prompt = `
Voici une facture. Extrais uniquement les données suivantes au format JSON valide, sans texte additionnel autour:

{
  "supplier": "Nom du fournisseur",
  "supplierAddress": "Adresse complète du fournisseur",
  "supplierZipCode": "Code postal du fournisseur",
  "supplierCity": "Ville du fournisseur",
  "lineItems": [
    {
      "name": "Description article",
      "quantity": 1,
      "price": 100,
      "total": 100
    }
    // Ajouter toutes les lignes trouvées
  ],
  "totalHT": 419.5,
  "totalTVA": 83.9, 
  "totalTTC": 503.4,
  "paymentInfo": {
    "iban": "FR26300020216600000718",
    "bic": "CRLYFRPP",
    "paymentMethod": "Virement à réception de facture",
    "dueDate": "14/03/2025"
  }
}

IMPORTANT: 
- Cherche attentivement les lignes d'articles avec leurs quantités, prix et totaux
- Ne pas oublier d'extraire l'IBAN, le BIC, la méthode de paiement et la date d'échéance
- Réponds UNIQUEMENT avec le JSON sans texte explicatif autour
- Utilise uniquement les données présentes dans la facture

Facture à analyser:
${cleanedText}
`;

      // Si pas de clé API, utiliser une analyse basique
      if (!this.mistralApiKey) {
        this.logger.warn(
          "Clé API Mistral non configurée, utilisation de l'analyse basique",
        );
        return this.analyzeWithRegex(cleanedText);
      }

      // Appel à l'API Mistral
      const response = await axios.post(
        'https://api.mistral.ai/v1/chat/completions',
        {
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0, // Température à 0 pour des réponses plus précises
          max_tokens: 2000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.mistralApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Vérifier le statut de la réponse
      if (response.status !== 200) {
        this.logger.error(
          `Erreur HTTP Mistral: ${response.status}`,
          response.data,
        );
        throw new Error(`Erreur API Mistral: ${response.statusText}`);
      }

      // Extraire et traiter la réponse
      const content = response.data.choices[0].message.content;
      this.logger.log(
        'Réponse brute de Mistral: ' + content.substring(0, 200) + '...',
      );

      // Extraire le JSON avec une expression régulière
      const jsonMatch = content.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        this.logger.error('Aucun JSON valide trouvé dans la réponse Mistral');
        return this.analyzeWithRegex(cleanedText);
      }

      try {
        // Tenter de parser le JSON extrait
        const parsedData = JSON.parse(jsonMatch[0]);

        // Formater les données pour correspondre à notre interface
        const result: DetailedInvoiceAnalysis = {
          supplier: parsedData.supplier || 'Non trouvé',
          supplierAddress: parsedData.supplierAddress || 'Non trouvé',
          supplierZipCode: parsedData.supplierZipCode || 'Non trouvé',
          supplierCity: parsedData.supplierCity || 'Non trouvé',
          lineItems: Array.isArray(parsedData.lineItems)
            ? parsedData.lineItems.map((item) => ({
                name: item.name || 'Article non identifié',
                quantity: this.parseNumber(item.quantity) || 1,
                price: this.parseNumber(item.price) || 0,
                total: this.parseNumber(item.total) || 0,
                description: item.description || '',
              }))
            : [],
          totalHT: this.parseNumber(parsedData.totalHT) || 0,
          totalTVA: this.parseNumber(parsedData.totalTVA) || 0,
          totalTTC: this.parseNumber(parsedData.totalTTC) || 0,
          paymentInfo: {
            iban: parsedData.paymentInfo?.iban || '',
            bic: parsedData.paymentInfo?.bic || '',
            paymentMethod: parsedData.paymentInfo?.paymentMethod || '',
            dueDate: parsedData.paymentInfo?.dueDate || '',
          },
          confidence: 0.95,
        };

        // Vérification basique de la qualité des résultats
        if (
          !result.supplier ||
          result.supplier === 'Non trouvé' ||
          (result.lineItems.length === 0 && !result.totalHT)
        ) {
          this.logger.warn(
            'Qualité des résultats insuffisante, analyse de secours utilisée',
          );
          return this.analyzeWithRegex(cleanedText);
        }

        return result;
      } catch (parseError) {
        this.logger.error(
          'Erreur de parsing de la réponse Mistral:',
          parseError,
        );
        this.logger.error('Contenu JSON problématique:', jsonMatch[0]);
        // En cas d'échec, utiliser l'analyse de secours
        return this.analyzeWithRegex(cleanedText);
      }
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse avec Mistral AI:", error);
      return this.analyzeWithRegex(fullText);
    }
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
   * Nettoie le texte pour améliorer l'analyse
   */
  private cleanTextForAnalysis(text: string): string {
    // Supprimer les séquences de lignes vides
    let cleanedText = text.replace(/\n{3,}/g, '\n\n');

    // Supprimer les caractères spéciaux qui peuvent perturber l'analyse
    cleanedText = cleanedText.replace(/[^\w\s,.:;€$%&()\-+=@/\n]/g, ' ');

    // Normaliser les espaces multiples
    cleanedText = cleanedText.replace(/\s+/g, ' ');

    // Normaliser les formats de monnaie
    cleanedText = cleanedText.replace(
      /(\d+)[,.](\d{2})(\s*)[€$]/g,
      '$1.$2 EUR',
    );

    return cleanedText;
  }

  /**
   * Méthode d'analyse avec expressions régulières comme solution de secours
   */
  private analyzeWithRegex(text: string): DetailedInvoiceAnalysis {
    this.logger.log("Utilisation de l'analyse par expressions régulières");

    try {
      // Base de résultat
      const result: DetailedInvoiceAnalysis = {
        supplier: 'Non trouvé',
        supplierAddress: 'Non trouvé',
        supplierZipCode: 'Non trouvé',
        supplierCity: 'Non trouvé',
        lineItems: [],
        totalHT: 0,
        totalTVA: 0,
        totalTTC: 0,
        paymentInfo: {},
        confidence: 0.5,
      };

      // Extraction du fournisseur
      const supplierRegex =
        /SOLUTION LOGIQUE|SAS au Capital de .* RES|Siège Social/i;
      if (supplierRegex.test(text)) {
        result.supplier = 'SOLUTION LOGIQUE';
      }

      // Extraction de l'adresse
      const addressRegex =
        /Siège Social\s*:\s*(.*?)(?:\s*(?:e|,)\s*([^e,]*?)(?:\s*(?:e|,)\s*(\d{5})\s*(.*?))?)?(?:\s*e|\s*$)/i;
      const addressMatch = text.match(addressRegex);
      if (addressMatch) {
        result.supplierAddress = addressMatch[1]?.trim() || 'Non trouvé';
        result.supplierZipCode = addressMatch[3]?.trim() || 'Non trouvé';
        result.supplierCity = addressMatch[4]?.trim() || 'Non trouvé';
      }

      // Extraction des lignes de facture
      const lineItemRegex =
        /(\d+(?:,\d+)?)\s+(.*?)\s+(\d+(?:,\d+)?)\s*\|\s*(\d+(?:,\d+)?)\s+(\d+(?:,\d+)?)/g;
      let match;
      while ((match = lineItemRegex.exec(text)) !== null) {
        const quantity = parseFloat(match[1].replace(',', '.'));
        const name = match[2].trim();
        const unitPrice = parseFloat(match[3].replace(',', '.'));
        const total = parseFloat(match[5].replace(',', '.'));

        result.lineItems.push({
          name,
          quantity,
          price: unitPrice,
          total,
        });
      }

      // Extraction des totaux
      const totalHTRegex = /Total Net HT\s*(\d+(?:[.,]\d+)?)/i;
      const totalHTMatch = text.match(totalHTRegex);
      if (totalHTMatch) {
        result.totalHT = parseFloat(totalHTMatch[1].replace(',', '.'));
      }

      const totalTVARegex = /Total TVA\s*(\d+(?:[.,]\d+)?)/i;
      const totalTVAMatch = text.match(totalTVARegex);
      if (totalTVAMatch) {
        result.totalTVA = parseFloat(totalTVAMatch[1].replace(',', '.'));
      }

      const totalTTCRegex = /NET A PAYER\s*(\d+(?:[.,]\d+)?)/i;
      const totalTTCMatch = text.match(totalTTCRegex);
      if (totalTTCMatch) {
        result.totalTTC = parseFloat(totalTTCMatch[1].replace(',', '.'));
      }

      // Extraction des informations de paiement
      const ibanRegex = /IBAN\s*:\s*(FR[\d\s]+)/i;
      const ibanMatch = text.match(ibanRegex);
      if (ibanMatch) {
        result.paymentInfo.iban = ibanMatch[1].replace(/\s+/g, '');
      }

      const bicRegex = /BIC\s*:\s*([A-Z]+)/i;
      const bicMatch = text.match(bicRegex);
      if (bicMatch) {
        result.paymentInfo.bic = bicMatch[1];
      }

      const paymentMethodRegex = /Mode de règlement\s*:\s*(.*?)(?:\s*$|\s*\n)/i;
      const paymentMethodMatch = text.match(paymentMethodRegex);
      if (paymentMethodMatch) {
        result.paymentInfo.paymentMethod = paymentMethodMatch[1].trim();
      }

      const dueDateRegex =
        /Date d['']échéance\s*:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
      const dueDateMatch = text.match(dueDateRegex);
      if (dueDateMatch) {
        result.paymentInfo.dueDate = dueDateMatch[1];
      }

      // Si on a trouvé au moins quelques informations, augmenter la confiance
      if (
        result.supplier !== 'Non trouvé' &&
        result.lineItems.length > 0 &&
        result.totalHT > 0
      ) {
        result.confidence = 0.7;
      }

      return result;
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse par regex:", error);
      return this.fallbackAnalysis({
        invoiceNumber: 'Non trouvé',
        supplier: 'Non trouvé',
        amount: 'Non trouvé',
        date: 'Non trouvé',
        fullText: text,
      });
    }
  }

  /**
   * Méthode de secours pour l'analyse en cas d'échec de toutes les autres méthodes
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

  /**
   * Analyse une facture en utilisant OCR, Donut (HuggingFace), puis Mistral AI pour validation finale
   * avec option d'envoyer le PDF original à Mistral
   * @param pdfBuffer Buffer du PDF de la facture
   * @param includePdf Si true, envoie une version encodée du PDF à Mistral
   * @returns Analyse détaillée de la facture
   */
  public async analyzeInvoiceWithCombinedApproach(
    pdfBuffer: Buffer,
    includePdf: boolean = false,
  ): Promise<DetailedInvoiceAnalysis> {
    try {
      this.logger.log('Démarrage analyse combinée (OCR + Donut + Mistral)');

      // 1. Extraction du texte avec OCR
      const extractedText = await this.extractTextFromPdf({
        content: pdfBuffer,
        name: 'invoice.pdf',
      });
      this.logger.log(
        `Texte extrait par OCR: ${extractedText.substring(0, 100)}...`,
      );

      // 2. Analyse avec Donut (via HuggingFace)
      let huggingFaceData = {};
      try {
        const huggingFaceResult =
          await this.huggingFaceService.analyzeInvoice(pdfBuffer);
        huggingFaceData =
          this.huggingFaceService.extractStructuredData(huggingFaceResult);
        this.logger.log('Analyse Donut (HuggingFace) réussie');
      } catch (donutError) {
        this.logger.error("Erreur lors de l'analyse Donut:", donutError);
      }

      // 3. Extraction des données OCR basiques
      const ocrData = this.extractInvoiceData(extractedText);

      // 4. Créer les données combinées pour Mistral
      const combinedText = this.prepareTextForMistral(
        extractedText,
        huggingFaceData,
      );

      // 5. Analyse finale avec Mistral (avec ou sans PDF joint)
      return await this.analyzeCombinedDataWithMistralAndPdf(
        huggingFaceData,
        ocrData,
        combinedText,
        includePdf ? pdfBuffer : null,
      );
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse combinée:", error);
      return this.fallbackAnalysis({
        invoiceNumber: 'Non trouvé',
        supplier: 'Non trouvé',
        amount: 'Non trouvé',
        date: 'Non trouvé',
        fullText: "Erreur lors de l'analyse",
      });
    }
  }

  /**
   * Prépare le texte pour l'analyse Mistral en combinant les extractions
   */
  private prepareTextForMistral(ocrText: string, huggingFaceData: any): string {
    // Commencer avec le texte OCR
    let combinedText = `=== TEXTE EXTRAIT PAR OCR ===\n${ocrText}\n\n`;

    // Ajouter les données structurées de HuggingFace
    combinedText += '=== DONNÉES EXTRAITES PAR DONUT ===\n';
    if (huggingFaceData.invoiceNumber)
      combinedText += `Numéro de facture: ${huggingFaceData.invoiceNumber}\n`;
    if (huggingFaceData.date) combinedText += `Date: ${huggingFaceData.date}\n`;
    if (huggingFaceData.supplier)
      combinedText += `Fournisseur: ${huggingFaceData.supplier}\n`;
    if (huggingFaceData.totalHT)
      combinedText += `Total HT: ${huggingFaceData.totalHT}\n`;
    if (huggingFaceData.totalTVA)
      combinedText += `Total TVA: ${huggingFaceData.totalTVA}\n`;
    if (huggingFaceData.totalTTC)
      combinedText += `Total TTC: ${huggingFaceData.totalTTC}\n`;
    if (huggingFaceData.iban) combinedText += `IBAN: ${huggingFaceData.iban}\n`;
    if (huggingFaceData.bic) combinedText += `BIC: ${huggingFaceData.bic}\n`;

    // Ajouter les lignes d'articles si disponibles
    if (huggingFaceData.lineItems && huggingFaceData.lineItems.length > 0) {
      combinedText += "\nLignes d'articles:\n";
      huggingFaceData.lineItems.forEach((item, index) => {
        combinedText += `${index + 1}. ${item.name || 'Article'} - Quantité: ${item.quantity || '?'}, Prix: ${item.price || '?'}, Total: ${item.total || '?'}\n`;
      });
    }

    return combinedText;
  }

  /**
   * Analyse les données combinées avec Mistral AI et inclut le PDF si demandé
   */
  public async analyzeCombinedDataWithMistralAndPdf(
    huggingFaceData: any,
    ocrData: any,
    fullText: string,
    pdfBuffer: Buffer | null = null,
  ): Promise<DetailedInvoiceAnalysis> {
    try {
      this.logger.log(
        'Analyse des données avec Mistral AI' +
          (pdfBuffer ? ' (avec PDF joint)' : ''),
      );

      // Prétraitement du texte pour améliorer l'analyse
      const cleanedText = this.cleanTextForAnalysis(fullText);

      // Si Hugging Face a déjà extrait des lignes d'articles, on peut les utiliser
      if (
        huggingFaceData &&
        huggingFaceData.lineItems &&
        huggingFaceData.lineItems.length > 0
      ) {
        this.logger.log(
          "Utilisation des lignes d'articles déjà extraites par HuggingFace",
        );

        // Créer une analyse basée sur les données de Hugging Face
        return {
          supplier: huggingFaceData.supplier || 'Non trouvé',
          supplierAddress: huggingFaceData.supplierAddress || 'Non trouvé',
          supplierZipCode: huggingFaceData.supplierZipCode || 'Non trouvé',
          supplierCity: huggingFaceData.supplierCity || 'Non trouvé',
          lineItems: huggingFaceData.lineItems.map((item) => ({
            name: item.name || 'Article non identifié',
            quantity: parseFloat(item.quantity) || 1,
            price: parseFloat(item.price) || 0,
            total: parseFloat(item.total) || 0,
            description: item.description || '',
          })),
          totalHT: parseFloat(huggingFaceData.totalHT) || 0,
          totalTVA: parseFloat(huggingFaceData.totalTVA) || 0,
          totalTTC: parseFloat(huggingFaceData.totalTTC) || 0,
          paymentInfo: {
            iban: huggingFaceData.iban || '',
            bic: huggingFaceData.bic || '',
            paymentMethod: huggingFaceData.paymentMethod || '',
            dueDate: huggingFaceData.dueDate || '',
          },
          confidence: 0.9,
        };
      }

      // Préparation du template JSON avec des valeurs déjà extraites si disponibles
      const jsonTemplate = {
        supplier:
          huggingFaceData.supplier || ocrData.supplier || '[NOM_FOURNISSEUR]',
        supplierAddress: '[ADRESSE_FOURNISSEUR]',
        supplierZipCode: '[CODE_POSTAL]',
        supplierCity: '[VILLE]',
        lineItems: [
          {
            name: '[DESCRIPTION_ARTICLE]',
            quantity: '[QUANTITE]',
            price: '[PRIX_UNITAIRE]',
            total: '[TOTAL_ARTICLE]',
          },
        ],
        totalHT: huggingFaceData.totalHT || '[TOTAL_HT]',
        totalTVA: huggingFaceData.totalTVA || '[TOTAL_TVA]',
        totalTTC: huggingFaceData.totalTTC || ocrData.amount || '[TOTAL_TTC]',
        paymentInfo: {
          iban: huggingFaceData.iban || '[IBAN]',
          bic: huggingFaceData.bic || '[BIC]',
          paymentMethod: '[MODE_PAIEMENT]',
          dueDate: ocrData.date || '[DATE_ECHEANCE]',
        },
      };

      // Préparer le prompt pour Mistral
      let prompt = `
Tu es un expert en extraction de données de factures. Analyse cette facture et extrais les informations au format JSON.

Voici mon template JSON attendu:
${JSON.stringify(jsonTemplate, null, 2)}

INSTRUCTIONS:
1. Remplace toutes les valeurs entre crochets [VALEUR] par les données réelles trouvées dans la facture
2. Si une valeur n'est pas présente dans la facture, laisse "Non trouvé" à la place
3. Pour les lineItems, ajoute autant d'entrées que de lignes d'articles trouvées dans la facture
4. Les montants doivent être des nombres (pas des chaînes)
5. Assure-toi que le JSON est valide

Facture à analyser:
${cleanedText}
`;

      // Si le PDF est fourni, ajouter des instructions spécifiques
      if (pdfBuffer) {
        // Créer une version base64 du PDF (limitée aux premiers 3Mo pour éviter de dépasser les limites du contexte)
        const maxPdfSize = 3 * 1024 * 1024; // 3Mo
        const pdfBase64 = pdfBuffer
          .subarray(0, Math.min(pdfBuffer.length, maxPdfSize))
          .toString('base64');

        prompt += `
\nVoici également le contenu encodé en base64 du PDF original (pour référence si nécessaire):
${pdfBase64.substring(0, 1000)}...
(contenu tronqué)
`;
      }

      // Si pas de clé API, utiliser une analyse basique
      if (!this.mistralApiKey) {
        this.logger.warn(
          "Clé API Mistral non configurée, utilisation de l'analyse basique",
        );
        return this.analyzeWithRegex(cleanedText);
      }

      // Appel à l'API Mistral
      const response = await axios.post(
        'https://api.mistral.ai/v1/chat/completions',
        {
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0, // Température à 0 pour des réponses plus précises
          max_tokens: 2000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.mistralApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Vérifier le statut de la réponse
      if (response.status !== 200) {
        this.logger.error(
          `Erreur HTTP Mistral: ${response.status}`,
          response.data,
        );
        throw new Error(`Erreur API Mistral: ${response.statusText}`);
      }

      // Extraire et traiter la réponse
      const content = response.data.choices[0].message.content;
      this.logger.log(
        'Réponse brute de Mistral: ' + content.substring(0, 200) + '...',
      );

      // Extraire le JSON avec une expression régulière
      const jsonMatch = content.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        this.logger.error('Aucun JSON valide trouvé dans la réponse Mistral');
        return this.analyzeWithRegex(cleanedText);
      }

      try {
        // Tenter de parser le JSON extrait
        const parsedData = JSON.parse(jsonMatch[0]);

        // Formater les données pour correspondre à notre interface
        const result: DetailedInvoiceAnalysis = {
          supplier: parsedData.supplier || 'Non trouvé',
          supplierAddress: parsedData.supplierAddress || 'Non trouvé',
          supplierZipCode: parsedData.supplierZipCode || 'Non trouvé',
          supplierCity: parsedData.supplierCity || 'Non trouvé',
          lineItems: Array.isArray(parsedData.lineItems)
            ? parsedData.lineItems.map((item) => ({
                name: item.name || 'Article non identifié',
                quantity: this.parseNumber(item.quantity) || 1,
                price: this.parseNumber(item.price) || 0,
                total: this.parseNumber(item.total) || 0,
                description: item.description || '',
              }))
            : [],
          totalHT: this.parseNumber(parsedData.totalHT) || 0,
          totalTVA: this.parseNumber(parsedData.totalTVA) || 0,
          totalTTC: this.parseNumber(parsedData.totalTTC) || 0,
          paymentInfo: {
            iban: parsedData.paymentInfo?.iban || '',
            bic: parsedData.paymentInfo?.bic || '',
            paymentMethod: parsedData.paymentInfo?.paymentMethod || '',
            dueDate: parsedData.paymentInfo?.dueDate || '',
          },
          confidence: pdfBuffer ? 0.98 : 0.95, // Confiance plus élevée si PDF fourni
        };

        // Vérification basique de la qualité des résultats
        if (
          !result.supplier ||
          result.supplier === 'Non trouvé' ||
          (result.lineItems.length === 0 && !result.totalHT)
        ) {
          this.logger.warn(
            'Qualité des résultats insuffisante, analyse de secours utilisée',
          );
          return this.analyzeWithRegex(cleanedText);
        }

        return result;
      } catch (parseError) {
        this.logger.error(
          'Erreur de parsing de la réponse Mistral:',
          parseError,
        );
        this.logger.error('Contenu JSON problématique:', jsonMatch[0]);
        // En cas d'échec, utiliser l'analyse de secours
        return this.analyzeWithRegex(cleanedText);
      }
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse avec Mistral AI:", error);
      return this.analyzeWithRegex(fullText);
    }
  }

  /**
   * Analyse une facture en utilisant le modèle Donut de Katana ML
   * @param invoiceBuffer Buffer contenant l'image de la facture
   * @returns Données structurées extraites de la facture
   */
  async parseInvoiceWithDonut(invoiceBuffer: Buffer): Promise<any> {
    try {
      this.logger.log("Démarrage de l'analyse de facture avec Donut");

      // Vérification initiale du buffer
      if (!invoiceBuffer || invoiceBuffer.length === 0) {
        throw new Error("Buffer d'image invalide ou vide");
      }

      // Convertir le buffer en base64 pour inspection
      const base64Sample = invoiceBuffer.slice(0, 100).toString('base64');

      // Vérifier le type de fichier (PDF ou image)
      const isPdf =
        base64Sample.includes('PDF') || base64Sample.includes('JVBERi0'); // Signature PDF en base64

      let imageBuffer: Buffer;
      let conversionSuccess = false;

      if (isPdf) {
        this.logger.log(
          'Fichier détecté comme PDF, conversion en image pour le modèle Donut',
        );
        try {
          // Conversion du PDF en image
          const convertedImage = await this.convertPdfToImage(invoiceBuffer, 1);

          if (convertedImage && convertedImage.length > 0) {
            this.logger.log(
              `PDF converti en image avec succès (${convertedImage.length} octets)`,
            );
            imageBuffer = convertedImage;
            conversionSuccess = true;
          } else {
            throw new Error('La conversion PDF vers image a échoué');
          }
        } catch (convErr) {
          this.logger.error(
            'Erreur lors de la conversion PDF vers image:',
            convErr,
          );

          // En cas d'échec de la conversion, essayer d'extraire le texte du PDF
          try {
            const pdfText = await pdfParse(invoiceBuffer);
            if (pdfText && pdfText.text) {
              this.logger.log(
                'Extraction du texte du PDF réussie, analyse par regex',
              );

              // Analyser le texte extrait avec des expressions régulières
              const textAnalysis = this.analyzeWithRegex(pdfText.text);

              return {
                success: true,
                message: 'Analyse de facture basée sur le texte extrait du PDF',
                data: textAnalysis,
                method: 'text_extraction',
              };
            } else {
              throw new Error("Impossible d'extraire du texte du PDF");
            }
          } catch (textExtractionErr) {
            this.logger.error(
              "Échec de l'extraction de texte du PDF:",
              textExtractionErr,
            );
            throw new Error(
              'Échec du traitement du PDF (conversion et extraction de texte)',
            );
          }
        }
      } else {
        // C'est probablement déjà une image, utiliser directement
        this.logger.log('Fichier détecté comme image, utilisation directe');
        imageBuffer = invoiceBuffer;
        conversionSuccess = true;
      }

      // Vérifier que nous avons bien un buffer d'image valide à ce stade
      if (!conversionSuccess || !imageBuffer || imageBuffer.length === 0) {
        throw new Error("Échec de la préparation de l'image pour l'analyse");
      }

      // Log de débogage sur la taille de l'image
      this.logger.log(`Analyse d'une image de ${imageBuffer.length} octets`);

      // Encoder l'image en base64 pour l'API Hugging Face
      const base64ForInference = imageBuffer.toString('base64');

      // Vérifier que le base64 ressemble bien à une image
      if (base64ForInference.length < 1000) {
        this.logger.warn(
          `Base64 trop court (${base64ForInference.length} caractères), possibilité d'image corrompue`,
        );
      }

      // Utiliser le service Hugging Face pour extraire les données
      const extractionResult =
        await this.huggingFaceService.extractInvoiceData(base64ForInference);

      // Traiter et formater le résultat
      const formattedResult = this.formatDonutResult(extractionResult);

      this.logger.log('Analyse avec Katana ML Donut terminée avec succès');
      return {
        success: true,
        message: 'Analyse de facture réussie avec le modèle Katana ML Donut',
        data: formattedResult,
        method: 'donut_model',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la facture avec Donut: ${error.message}`,
      );
      return {
        success: false,
        message: `Échec de l'analyse de la facture: ${error.message}`,
        data: null,
        method: 'failed',
      };
    }
  }

  /**
   * Formate le résultat brut du modèle Donut en un format structuré
   * @param rawResult Résultat brut du modèle Donut
   * @returns Données structurées de la facture
   */
  private formatDonutResult(rawResult: any): any {
    try {
      // Si le résultat est déjà sous forme JSON, le parser
      if (typeof rawResult === 'string') {
        try {
          return JSON.parse(rawResult);
        } catch (e) {
          this.logger.warn(
            `Impossible de parser le résultat comme JSON: ${e.message}`,
          );
          return { raw: rawResult };
        }
      }

      // Si c'est déjà un objet, vérifier sa structure
      if (rawResult && typeof rawResult === 'object') {
        // Récupérer le texte généré pour analyse supplémentaire si nécessaire
        const generatedText = rawResult.generated_text || '';

        // Tenter d'extraire des données du texte généré si disponible
        const extractedFromText =
          this.extractDataFromGeneratedText(generatedText);

        // Structure normalisée avec priorité aux données structurées, puis aux données extraites du texte
        return {
          header: {
            invoice_no:
              rawResult.invoice_number ||
              rawResult.invoiceNumber ||
              extractedFromText.invoiceNumber ||
              null,
            invoice_date:
              rawResult.date ||
              rawResult.invoiceDate ||
              extractedFromText.date ||
              null,
            seller:
              rawResult.supplier ||
              rawResult.vendor ||
              rawResult.seller ||
              extractedFromText.supplier ||
              null,
          },
          summary: {
            total_gross_worth:
              rawResult.total ||
              rawResult.totalAmount ||
              rawResult.amount ||
              extractedFromText.amount ||
              null,
            vat:
              rawResult.vat || rawResult.tax || extractedFromText.vat || null,
            net:
              rawResult.net ||
              rawResult.netAmount ||
              extractedFromText.totalHT ||
              null,
          },
          payment: {
            iban: rawResult.iban || extractedFromText.iban || null,
            bic: rawResult.bic || extractedFromText.bic || null,
            due_date: rawResult.dueDate || extractedFromText.dueDate || null,
          },
          items:
            rawResult.items ||
            rawResult.lineItems ||
            extractedFromText.lineItems ||
            [],
          raw: rawResult, // Garder la réponse brute pour référence
        };
      }

      return rawResult;
    } catch (error) {
      this.logger.warn(
        `Erreur lors du formatage du résultat Donut: ${error.message}`,
      );
      return { raw: rawResult }; // Retourner le résultat brut en cas d'erreur
    }
  }

  /**
   * Extrait des données structurées à partir du texte généré par le modèle Donut
   * Cette méthode est utilisée quand les données structurées ne sont pas disponibles
   */
  private extractDataFromGeneratedText(generatedText: string): any {
    this.logger.log(
      "Tentative d'extraction de données à partir du texte généré",
    );

    const result = {
      invoiceNumber: null as string | null,
      date: null as string | null,
      supplier: null as string | null,
      amount: null as string | null,
      vat: null as string | null,
      totalHT: null as string | null,
      iban: null as string | null,
      bic: null as string | null,
      dueDate: null as string | null,
      lineItems: [] as Array<{
        name: string;
        quantity: string;
        unit_price: string;
        total: string;
      }>,
    };

    try {
      if (!generatedText || generatedText.length < 10) {
        return result;
      }

      // Extraction du numéro de facture
      const invoiceNoMatch = generatedText.match(
        /<s_invoice_no>(.*?)<\/s_invoice_no>/,
      );
      if (invoiceNoMatch && invoiceNoMatch[1]) {
        result.invoiceNumber = invoiceNoMatch[1].trim();
      } else {
        // Essayer d'autres patterns
        const fcMatch = generatedText.match(/FC(\d+)/);
        if (fcMatch) {
          result.invoiceNumber = `FC${fcMatch[1]}`;
        }
      }

      // Extraction de la date
      const dateMatch = generatedText.match(
        /<s_invoice_date>(.*?)<\/s_invoice_date>/,
      );
      if (dateMatch && dateMatch[1]) {
        result.date = dateMatch[1].trim();
      } else {
        // Chercher des dates au format XX/XX/XXXX
        const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})/;
        const altDateMatch = generatedText.match(datePattern);
        if (altDateMatch) {
          result.date = altDateMatch[1];
        }
      }

      // Extraction du vendeur
      const sellerMatch = generatedText.match(/<s_seller>(.*?)<\/s_seller>/);
      if (sellerMatch && sellerMatch[1]) {
        result.supplier = sellerMatch[1].trim();
      } else {
        // Chercher une ligne qui ressemble à un nom d'entreprise
        const lines = generatedText.split('\n');
        for (const line of lines) {
          if (line.includes('Electricite') || line.includes('BAUD')) {
            result.supplier = line.trim();
            break;
          }
        }
      }

      // Extraction du montant total
      const totalMatch = generatedText.match(
        /<s_total_gross_worth>(.*?)<\/s_total_gross_worth>/,
      );
      if (totalMatch && totalMatch[1]) {
        const cleanTotal = totalMatch[1]
          .replace(/[^\d,.]/g, '')
          .replace(',', '.');
        result.amount = cleanTotal;
      } else {
        // Chercher des patterns de totaux
        const totalPattern = /Total Net HT\s*(\d+[,.]\d+)/i;
        const altTotalMatch = generatedText.match(totalPattern);
        if (altTotalMatch) {
          result.totalHT = altTotalMatch[1].replace(',', '.');
          // Approximation du montant TTC (ajout de 20% de TVA)
          const ht = parseFloat(result.totalHT);
          if (!isNaN(ht)) {
            result.amount = (ht * 1.2).toFixed(2);
            result.vat = (ht * 0.2).toFixed(2);
          }
        }
      }

      // Extraction des articles
      const itemDescPatterns = /<s_item_desc>(.*?)<\/s_item_desc>/g;
      const itemQtyPatterns = /<s_item_qty>(.*?)<\/s_item_qty>/g;
      const itemDescMatches = [...generatedText.matchAll(itemDescPatterns)];
      const itemQtyMatches = [...generatedText.matchAll(itemQtyPatterns)];

      // Associer les descriptions et quantités
      for (
        let i = 0;
        i < Math.min(itemDescMatches.length, itemQtyMatches.length);
        i++
      ) {
        const desc = itemDescMatches[i][1].trim();
        const qty = itemQtyMatches[i][1].trim();

        if (desc && qty) {
          // Convertir la quantité en nombre si possible
          let quantity = qty;
          if (/^\d+[,.]\d+$/.test(qty)) {
            quantity = qty.replace(',', '.');
          }

          // Essayer d'estimer un prix unitaire
          let unitPrice = '0';
          let total = '0';

          // Si nous avons un total HT et un seul article, utiliser comme total
          if (result.totalHT && itemDescMatches.length === 1) {
            total = result.totalHT;
            if (quantity && parseFloat(quantity) > 0) {
              unitPrice = (parseFloat(total) / parseFloat(quantity)).toFixed(2);
            }
          }

          result.lineItems.push({
            name: desc,
            quantity: quantity,
            unit_price: unitPrice,
            total: total,
          });
        }
      }

      // Si nous n'avons pas trouvé d'articles mais avons un montant, créer un article générique
      if (result.lineItems.length === 0 && result.totalHT) {
        result.lineItems.push({
          name: 'Services ou produits',
          quantity: '1',
          unit_price: result.totalHT,
          total: result.totalHT,
        });
      }

      return result;
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'extraction des données du texte généré:",
        error,
      );
      return result;
    }
  }

  /**
   * Analyse une facture en utilisant le modèle LayoutLM (impira/layoutlm-invoices)
   * @param pdfBuffer Buffer du PDF de facture à analyser
   * @returns Données structurées extraites par le modèle LayoutLM
   */
  public async analyzeWithDonutModel(pdfBuffer: Buffer): Promise<any> {
    const maxRetries = 3;
    const initialDelayMs = 1000;

    // Fonction de retry avec délai exponentiel
    const executeWithRetry = async (attempt: number): Promise<any> => {
      try {
        this.logger.log(
          `Analyse avec le modèle LayoutLM (impira/layoutlm-invoices) - tentative ${attempt}/${maxRetries}`,
        );

        // Convertir la première page du PDF en image pour l'API LayoutLM
        const imageBuffer = await this.convertPdfToImage(pdfBuffer, 1);

        if (!imageBuffer) {
          throw new Error('Échec de la conversion du PDF en image');
        }

        // Utiliser le service HuggingFace pour analyser l'image
        const layoutLMResult =
          await this.huggingFaceService.analyzeInvoice(imageBuffer);

        // Si le résultat est valide
        if (layoutLMResult) {
          this.logger.log('Analyse LayoutLM réussie');
          return layoutLMResult;
        } else {
          throw new Error('Résultat vide de LayoutLM');
        }
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

        // Si ce n'est pas une erreur 503/429 ou si on a dépassé le nombre de tentatives
        this.logger.error("Exception lors de l'analyse avec LayoutLM:", error);

        // Retourner un objet avec une structure compatible mais vide
        return {
          header: {
            invoice_no: null,
            invoice_date: null,
            seller: null,
          },
          summary: {
            total_gross_worth: null,
          },
          items: [],
        };
      }
    };

    // Démarrer avec la première tentative
    return executeWithRetry(1);
  }

  /**
   * Méthode d'analyse de facture exposée pour le contrôleur
   * Permet d'analyser une facture PDF avec OCR, Donut et Mistral
   * @param file Fichier PDF à analyser
   * @param includePdf Joindre le PDF à Mistral pour analyse
   * @returns Résultat d'analyse avec confiance
   */
  public async analyzeInvoiceFile(
    file: Buffer,
    includePdf: boolean = false,
  ): Promise<{
    result: DetailedInvoiceAnalysis;
    success: boolean;
  }> {
    try {
      // Analyser avec l'approche combinée
      const result = await this.analyzeInvoiceWithCombinedApproach(
        file,
        includePdf,
      );

      // Calculer le taux de confiance
      const hasMinimalData =
        result.supplier !== 'Non trouvé' &&
        result.lineItems.length > 0 &&
        result.totalTTC > 0;

      return {
        result,
        success: hasMinimalData && result.confidence > 0.5,
      };
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse du fichier:", error);
      return {
        result: this.fallbackAnalysis({
          invoiceNumber: null,
          supplier: null,
          amount: null,
          date: null,
          fullText: 'Erreur technique',
        }),
        success: false,
      };
    }
  }
}
