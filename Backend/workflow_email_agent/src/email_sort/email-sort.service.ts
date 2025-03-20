import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Imap from 'imap';
import { simpleParser } from 'mailparser';
import { ConfigService } from '@nestjs/config';
import { promisify } from 'util';
import { Stream } from 'stream';
import * as pdfParse from 'pdf-parse';

@Injectable()
export class EmailSortService implements OnModuleInit {
  private imap: Imap;
  private readonly logger = new Logger(EmailSortService.name);

  constructor(private configService: ConfigService) {
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

  onModuleInit(): void {
    this.logger.log("Service de tri d'emails initialisé");
  }

  private async ensureConnection(): Promise<void> {
    if (this.imap.state !== 'authenticated') {
      await new Promise<void>((resolve, reject) => {
        this.imap.once('ready', () => resolve());
        this.imap.once('error', reject);
        this.imap.connect();
      });
    }
  }

  async checkForInvoices(
    maxMessages: number = 50,
    startIndex: number = 0,
  ): Promise<{ total: number; invoicesFound: number; remaining: number }> {
    let invoicesFound = 0;

    try {
      await this.ensureConnection();
      const openInbox = promisify<string, Imap.Box>(
        this.imap.openBox.bind(this.imap),
      );
      await openInbox('INBOX');

      this.logger.log('Connexion établie à la boîte mail...');
      const results = await promisify(this.imap.search.bind(this.imap))([
        'UNSEEN',
      ]);

      if (!results || results.length === 0) {
        this.logger.log('Aucun nouvel email non lu trouvé');
        return { total: 0, invoicesFound: 0, remaining: 0 };
      }

      // Vérifier si le dossier "Factures" existe, sinon le créer
      await this.ensureInvoiceFolder();

      // Calcul des indices de départ et de fin
      const endIndex = Math.min(startIndex + maxMessages, results.length);
      const messagesToProcess = results.slice(startIndex, endIndex);
      const remaining = results.length - endIndex;

      this.logger.log(`Nombre total de nouveaux messages: ${results.length}`);
      this.logger.log(
        `Traitement des messages ${startIndex} à ${endIndex - 1}`,
      );
      this.logger.log(
        `Il restera ${remaining} messages à traiter après cette exécution`,
      );

      // Diviser les messages en lots plus petits
      const batchSize = 50;
      const batches: number[][] = [];
      for (let i = 0; i < messagesToProcess.length; i += batchSize) {
        batches.push(messagesToProcess.slice(i, i + batchSize));
      }

      // Traiter chaque lot séparément
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        this.logger.log(
          `Traitement du lot ${batchIndex + 1}/${batches.length} (${batch.length} messages)`,
        );

        const invoiceUids = await this.processBatch(batch);

        // Déplacer les factures identifiées vers le dossier "Factures"
        if (invoiceUids.length > 0) {
          this.logger.log(
            `Déplacement de ${invoiceUids.length} factures vers le dossier "Factures"...`,
          );
          await this.moveToInvoiceFolder(invoiceUids);
          invoicesFound += invoiceUids.length;
          this.logger.log(`Total des factures déplacées: ${invoicesFound}`);
        }
      }

      this.logger.log(
        `Traitement terminé. ${invoicesFound} factures trouvées et déplacées sur ${messagesToProcess.length} emails analysés.`,
      );
      return { total: messagesToProcess.length, invoicesFound, remaining };
    } catch (error) {
      this.logger.error('Erreur lors de la vérification des emails:', error);
      return { total: 0, invoicesFound: 0, remaining: 0 };
    }
  }

  private async processBatch(uids: number[]): Promise<number[]> {
    const invoiceUids: number[] = [];

    const fetch = this.imap.fetch(uids, { bodies: '' });

    return new Promise<number[]>((resolve) => {
      let processedCount = 0;
      const totalMessages = uids.length;
      const processingPromises: Promise<void>[] = [];

      fetch.on('message', (msg: Imap.ImapMessage) => {
        let uid: number | null = null;
        let buffer = '';

        msg.on('attributes', (attrs) => {
          uid = attrs.uid;
        });

        msg.on('body', (stream: Stream) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
        });

        msg.once('end', () => {
          if (!uid) {
            this.logger.warn(`❌ UID manquant pour un email`);
            processedCount++;
            if (processedCount === totalMessages) {
              void Promise.all(processingPromises).then(() =>
                resolve(invoiceUids),
              );
            }
            return;
          }

          // Créer une promesse pour le traitement de cet email et l'ajouter à notre tableau
          const emailProcessingPromise = this.processEmail(buffer, uid)
            .then((isInvoice) => {
              if (isInvoice) {
                invoiceUids.push(uid as number);
                this.logger.log(`Email ${uid} identifié comme facture`);
              }

              // Libérer la mémoire
              buffer = '';

              processedCount++;
              // Résoudre la promesse principale uniquement quand tous les emails ont été traités
              if (processedCount === totalMessages) {
                resolve(invoiceUids);
              }
            })
            .catch((error) => {
              this.logger.error(
                `Erreur lors du traitement de l'email ${uid}:`,
                error,
              );

              processedCount++;
              if (processedCount === totalMessages) {
                resolve(invoiceUids);
              }
            });

          processingPromises.push(emailProcessingPromise);
        });
      });

      fetch.once('error', (err) => {
        this.logger.error('Erreur lors de la récupération des emails:', err);
        // En cas d'erreur, résoudre avec les factures trouvées jusqu'à présent
        resolve(invoiceUids);
      });

      fetch.once('end', () => {
        this.logger.log(`Récupération du lot terminée, traitement en cours...`);
        // Ne pas résoudre ici, attendre que tous les traitements soient terminés
      });
    });
  }

  private async ensureInvoiceFolder(): Promise<void> {
    try {
      // Obtenir la liste des dossiers
      const boxes = await promisify<Imap.MailBoxes>(
        this.imap.getBoxes.bind(this.imap),
      )();

      // Vérifier si le dossier "Factures" existe
      if (!boxes.Factures) {
        this.logger.log('Création du dossier "Factures"...');
        await promisify(this.imap.addBox.bind(this.imap))('Factures');
        this.logger.log('Dossier "Factures" créé avec succès');
      } else {
        this.logger.log('Le dossier "Factures" existe déjà');
      }
    } catch (error) {
      this.logger.error(
        'Erreur lors de la vérification/création du dossier "Factures":',
        error,
      );
      throw error;
    }
  }

  private async moveToInvoiceFolder(uids: number[]): Promise<void> {
    try {
      if (uids.length === 0) return;

      await promisify(this.imap.move.bind(this.imap))(uids, 'Factures');
      this.logger.log(
        `${uids.length} emails déplacés vers le dossier "Factures"`,
      );
    } catch (error) {
      this.logger.error(
        'Erreur lors du déplacement des emails vers le dossier "Factures":',
        error,
      );
      throw error;
    }
  }

  private async processEmail(buffer: string, uid: number): Promise<boolean> {
    try {
      const parsed = await simpleParser(buffer);
      let isInvoice = false;

      // 1. Vérifier le sujet de l'email
      if (parsed.subject) {
        if (this.isInvoiceText(parsed.subject)) {
          this.logger.log(`Email ${uid}: Sujet identifié comme facture`);
          isInvoice = true;
        }
      }

      // 2. Vérifier le corps du message
      if (!isInvoice && parsed.text) {
        if (this.isInvoiceText(parsed.text)) {
          this.logger.log(
            `Email ${uid}: Corps du message identifié comme facture`,
          );
          isInvoice = true;
        }
      }

      // 3. Vérifier les pièces jointes PDF
      if (!isInvoice && parsed.attachments && parsed.attachments.length > 0) {
        const pdfAttachments = parsed.attachments.filter(
          (att) => att.contentType === 'application/pdf',
        );

        if (pdfAttachments.length > 0) {
          this.logger.log(
            `Email ${uid}: ${pdfAttachments.length} pièce(s) jointe(s) PDF trouvée(s)`,
          );

          for (const attachment of pdfAttachments) {
            try {
              const pdfData = await pdfParse(attachment.content);
              const text = pdfData.text.toLowerCase();

              // Vérifier si le PDF contient des informations de facture
              if (this.isInvoiceText(text)) {
                this.logger.log(
                  `Facture trouvée dans la pièce jointe de l'email ${uid}`,
                );
                isInvoice = true;
                break; // Sortir de la boucle dès qu'une facture est trouvée
              }
            } catch (error) {
              this.logger.error(
                `Erreur lors de l'analyse du PDF dans l'email ${uid}:`,
                error,
              );
            }
          }
        }
      }

      return isInvoice;
    } catch (error) {
      this.logger.error(`Erreur lors du traitement de l'email ${uid}:`, error);
      return false;
    }
  }

  private isInvoiceText(text: string): boolean {
    const textLower = text.toLowerCase();

    // Mots-clés principaux (au moins un doit être présent)
    const primaryKeywords = [
      'facture',
      'invoice',
      'devis',
      'bon de commande',
      'reçu',
      'receipt',
    ];

    // Vérifier si au moins un mot-clé principal est présent
    const hasPrimaryKeyword = primaryKeywords.some((keyword) =>
      textLower.includes(keyword),
    );
    if (!hasPrimaryKeyword) {
      return false;
    }

    // Vérifier la présence d'un montant avec devise (format: 123,45€ ou 123.45 EUR)
    const hasAmount = /\d+[.,]\d+\s*(?:€|eur|euro|euros|\$|usd)/i.test(
      textLower,
    );
    if (!hasAmount) {
      return false;
    }

    // Vérifier la présence d'un numéro de facture
    const hasInvoiceNumber =
      /(?:numéro|n°|no|number)\s*(?:facture|invoice)?\s*[:.]?\s*[A-Z0-9-]+/i.test(
        textLower,
      );

    // Vérifier la présence d'une date
    const hasDate = /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(textLower);

    // Vérifier la présence d'une TVA
    const hasVAT = /(?:tva|vat)\s*[:.]?\s*[A-Z0-9]+/i.test(textLower);

    // Vérifier la présence d'un montant HT et TTC
    const hasHTandTTC =
      /(?:ht|h\.t\.|h\.t)\s*[:.]?\s*\d+[.,]\d+\s*(?:€|eur|euro|euros|\$|usd).*?(?:ttc|t\.t\.c\.|t\.t\.c)\s*[:.]?\s*\d+[.,]\d+\s*(?:€|eur|euro|euros|\$|usd)/i.test(
        textLower,
      );

    // Pour qu'un texte soit considéré comme une facture, il doit contenir:
    // - Un mot-clé principal ET
    // - Un montant avec devise ET
    // - Au moins 2 des éléments suivants:
    //   - Numéro de facture
    //   - Date
    //   - TVA
    //   - Montants HT et TTC
    const secondaryCriteriaCount = [
      hasInvoiceNumber,
      hasDate,
      hasVAT,
      hasHTandTTC,
    ].filter(Boolean).length;

    return secondaryCriteriaCount >= 2;
  }

  async disconnect(): Promise<void> {
    if (this.imap) {
      return new Promise<void>((resolve) => {
        this.imap.end();
        this.logger.log('Déconnexion de la boîte mail réussie');
        resolve();
      });
    }
  }
}
