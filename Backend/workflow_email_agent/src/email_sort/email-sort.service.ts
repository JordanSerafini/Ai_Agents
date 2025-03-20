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

        const { analyzed, moved } = await this.processBatch(batch);
        this.logger.log(`Lot ${batchIndex + 1}: ${analyzed} emails analysés`);
        invoicesFound += moved;
        this.logger.log(`Total des factures déplacées: ${invoicesFound}`);
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

  private async processBatch(
    uids: number[],
  ): Promise<{ analyzed: number; moved: number }> {
    return new Promise((resolve) => {
      const fetch = this.imap.fetch(uids, {
        bodies: [''],
        struct: true,
      });
      let analyzed = 0;
      const toMove: number[] = [];

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
          if (!uid) return;

          try {
            analyzed++;
            // Analyse complète de l'email via processEmail (c'est une promesse mais nous ne l'attendons pas ici)
            const uidValue = uid;
            void this.processEmail(buffer, uidValue).then((isInvoice) => {
              if (isInvoice) {
                this.logger.log(`Email ${uidValue} identifié comme facture`);
                toMove.push(uidValue);
              }
              buffer = '';
            });
          } catch (err) {
            this.logger.error(
              `Erreur lors de l'analyse de l'email ${uid}:`,
              err,
            );
          }
        });
      });

      fetch.once('end', () => {
        void (async () => {
          let moved = 0;
          if (toMove.length > 0) {
            const emailsToMove = [...toMove];
            this.logger.log(
              `${emailsToMove.length}/${analyzed} factures identifiées`,
            );
            moved = await this.moveEmailsToFolder(emailsToMove, 'Factures');
            this.logger.log(
              `${moved}/${emailsToMove.length} factures déplacées`,
            );
          }
          resolve({ analyzed, moved });
        })();
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

  private async moveEmailsToFolder(
    uids: number[],
    folder: string,
  ): Promise<number> {
    if (uids.length === 0) return 0;

    try {
      await this.ensureConnection();
      await promisify<string, Imap.Box>(this.imap.openBox.bind(this.imap))(
        'INBOX',
      );

      this.logger.log(
        `Déplacement d'un lot de ${uids.length} emails vers ${folder}`,
      );

      // Créer le dossier si nécessaire
      await this.ensureInvoiceFolder();

      // Déplacer les emails en une seule fois
      await new Promise<void>((resolve, reject) => {
        this.imap.move(uids, folder, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return uids.length;
    } catch (err) {
      this.logger.error('Erreur lors du déplacement du lot:', err);
      return 0;
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
      'paiement',
      'payment',
      'commande',
      'order',
      'purchase',
      'achat',
      'confirmation',
    ];

    // Vérifier si au moins un mot-clé principal est présent
    const hasPrimaryKeyword = primaryKeywords.some((keyword) =>
      textLower.includes(keyword),
    );
    if (!hasPrimaryKeyword) {
      return false;
    }

    // Vérifier la présence d'un montant avec devise (format: 123,45€ ou 123.45 EUR ou 123€)
    const hasAmount = /\d+(?:[.,]\d+)?\s*(?:€|eur|euro|euros|\$|usd)/i.test(
      textLower,
    );

    // Vérifier la présence d'un numéro de facture
    const hasInvoiceNumber =
      /(?:numéro|n°|no|number|ref|référence|reference)\s*(?:facture|invoice|commande|order)?\s*[:.]?\s*[A-Z0-9-]+/i.test(
        textLower,
      );

    // Vérifier la présence d'une date
    const hasDate = /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(textLower);

    // Vérifier la présence d'une TVA
    const hasVAT = /(?:tva|vat|taxe|tax|t\.v\.a)/i.test(textLower);

    // Vérifier la présence d'un montant HT ou TTC
    const hasHTorTTC = /(?:ht|h\.t\.|h\.t|ttc|t\.t\.c\.|t\.t\.c)/i.test(
      textLower,
    );

    // Pour qu'un texte soit considéré comme une facture, il doit contenir:
    // - Un mot-clé principal ET
    // - Au moins 2 des éléments suivants:
    //   - Un montant avec devise
    //   - Numéro de facture
    //   - Date
    //   - TVA
    //   - Montants HT ou TTC
    const secondaryCriteriaCount = [
      hasAmount,
      hasInvoiceNumber,
      hasDate,
      hasVAT,
      hasHTorTTC,
    ].filter(Boolean).length;

    // Assouplissement des critères: au moins 2 critères secondaires
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
