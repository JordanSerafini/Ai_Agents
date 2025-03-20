import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { EmailSortService } from '../email_sort/email-sort.service';
import * as tesseract from 'node-tesseract-ocr';
import * as pdfParse from 'pdf-parse';
import * as Imap from 'imap';
import { simpleParser } from 'mailparser';
import { Stream } from 'stream';
import * as crypto from 'crypto';

@Injectable()
export class InvoiceParserService {
  private readonly logger = new Logger(InvoiceParserService.name);
  private readonly extractPdfPath: string;
  private imap: Imap;
  private tesseractConfig = {
    lang: 'fra+eng',
    oem: 1,
    psm: 3,
  };

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
  ) {
    // Chemin où seront extraits les PDF (adapté pour Docker)
    this.extractPdfPath = path.join('/app', 'extractPdf');
    void this.ensureExtractDirectory();

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

  private async ensureExtractDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.extractPdfPath)) {
        await fs.promises.mkdir(this.extractPdfPath, { recursive: true });
        this.logger.log(`Dossier d'extraction créé: ${this.extractPdfPath}`);
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création du dossier d'extraction:`,
        error,
      );
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

  private extractInvoiceData(text: string): {
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
      // Extraction du numéro de facture
      const invoiceRegex =
        /(?:facture|invoice|n°|no|number|ref)[:\s]*([A-Za-z0-9-_]{3,})/i;
      const invoiceMatch = text.match(invoiceRegex);
      if (invoiceMatch && invoiceMatch[1]) {
        result.invoiceNumber = invoiceMatch[1].trim();
      }

      // Extraction du montant
      const amountMatch = text.match(this.extractionPatterns.amount);
      if (amountMatch && amountMatch[1]) {
        result.amount = amountMatch[1].trim().replace(/\s+/g, '');
      }

      // Extraction de la date
      const dateMatch = text.match(this.extractionPatterns.date);
      if (dateMatch && dateMatch[1]) {
        result.date = dateMatch[1].trim();
      }

      // Extraction du fournisseur
      const supplierMatch = text.match(this.extractionPatterns.supplier);
      if (supplierMatch && supplierMatch[1]) {
        result.supplier = supplierMatch[1].trim();
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
      this.logger.log(`Extraction du texte du PDF: ${pdf.name}`);

      // Extraire le texte du PDF avec pdf-parse
      let parsedText = '';
      try {
        const data = await pdfParse(pdf.content);
        parsedText = data.text || '';
        this.logger.log(
          `Texte extrait par pdf-parse: ${parsedText.length} caractères`,
        );
      } catch (parseError) {
        this.logger.error(
          "Erreur lors de l'extraction avec pdf-parse:",
          parseError,
        );
      }

      // Extraire le texte du PDF avec OCR (tesseract)
      let ocrText = '';
      try {
        // Pour l'OCR avec Tesseract, nous pourrions utiliser pdf2image pour convertir
        // chaque page du PDF en image, mais cela nécessiterait une implémentation plus complexe

        // Implémentation simplifiée pour l'exemple
        // Dans un cas réel, vous devriez convertir le PDF en images puis analyser chaque image
        ocrText = await tesseract.recognize(pdf.content, this.tesseractConfig);
        this.logger.log(`Texte extrait par OCR: ${ocrText.length} caractères`);
      } catch (ocrError) {
        this.logger.error("Erreur lors de l'OCR avec tesseract:", ocrError);
      }

      // Combiner les résultats (si les deux méthodes ont fonctionné)
      let combinedText = '';

      if (parsedText && ocrText) {
        // Combiner les deux textes en évitant les duplications
        combinedText = `--- TEXTE EXTRAIT PAR PDF-PARSE ---\n${parsedText}\n\n--- TEXTE EXTRAIT PAR OCR ---\n${ocrText}`;
      } else if (parsedText) {
        combinedText = parsedText;
      } else if (ocrText) {
        combinedText = ocrText;
      } else {
        // Fallback si les deux méthodes échouent
        combinedText = `FACTURE N° PDF-OCR-${Date.now()}
Date: ${new Date().toLocaleDateString()}
Contenu non extrait du fichier ${pdf.name}
(Échec de l'extraction de texte)`;
      }

      return combinedText;
    } catch (error) {
      this.logger.error("Erreur lors de l'extraction du texte:", error);
      return '';
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
}
