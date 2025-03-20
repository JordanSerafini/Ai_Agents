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

  async checkForInvoices(maxMessages: number = 50): Promise<void> {
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
        return;
      }

      this.logger.log(`Nombre total de nouveaux messages: ${results.length}`);
      const messagesToProcess = results.slice(0, maxMessages);
      this.logger.log(
        `Nombre de messages à traiter: ${messagesToProcess.length}`,
      );

      const fetch = this.imap.fetch(messagesToProcess, { bodies: '' });

      await new Promise<void>((resolve) => {
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
              return;
            }

            this.processEmail(buffer, uid).catch((error) => {
              this.logger.error(
                `Erreur lors du traitement de l'email ${uid}:`,
                error,
              );
            });
          });
        });

        fetch.once('error', (err) => {
          this.logger.error('Erreur lors de la récupération des emails:', err);
          resolve();
        });

        fetch.once('end', () => {
          this.logger.log('Traitement des emails terminé');
          resolve();
        });
      });
    } catch (error) {
      this.logger.error('Erreur lors de la vérification des emails:', error);
    }
  }

  private async processEmail(buffer: string, uid: number): Promise<void> {
    try {
      const parsed = await simpleParser(buffer);
      // Vérifier si l'email contient des pièces jointes PDF
      const pdfAttachments = parsed.attachments.filter(
        (att) => att.contentType === 'application/pdf',
      );

      if (pdfAttachments.length === 0) {
        this.logger.log(`Email ${uid}: Aucune pièce jointe PDF trouvée`);
        return;
      }

      this.logger.log(
        `Email ${uid}: ${pdfAttachments.length} pièce(s) jointe(s) PDF trouvée(s)`,
      );

      for (const attachment of pdfAttachments) {
        try {
          const pdfData = await pdfParse(attachment.content);
          const text = pdfData.text.toLowerCase();

          // Vérifier si le PDF contient des informations de facture
          if (this.isInvoice(text)) {
            this.logger.log(`Facture trouvée dans l'email ${uid}`);
            // TODO: Implémenter la logique de traitement des factures
          }
        } catch (error) {
          this.logger.error(
            `Erreur lors de l'analyse du PDF dans l'email ${uid}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Erreur lors du traitement de l'email ${uid}:`, error);
    }
  }

  private isInvoice(text: string): boolean {
    const invoiceKeywords = [
      'facture',
      'invoice',
      'montant',
      'amount',
      'total',
      'date',
      'client',
      'customer',
      'société',
      'company',
      'tva',
      'vat',
      'numéro',
      'number',
      'référence',
      'reference',
    ];

    return invoiceKeywords.some((keyword) => text.includes(keyword));
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
