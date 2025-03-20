import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Imap from 'imap';
import { simpleParser } from 'mailparser';
import { ConfigService } from '@nestjs/config';
import { promisify } from 'util';
import { Stream } from 'stream';

@Injectable()
export class EmailFilterService implements OnModuleInit {
  private imap: Imap;
  private readonly logger = new Logger(EmailFilterService.name);

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
    this.logger.log("Service de filtrage d'emails initialisé");
  }

  private async deleteEmailBatch(uids: number[]): Promise<number> {
    if (uids.length === 0) return 0;

    try {
      await this.ensureConnection();
      await promisify<string, Imap.Box>(this.imap.openBox.bind(this.imap))(
        'INBOX',
      );

      this.logger.log(`Suppression d'un lot de ${uids.length} emails`);

      // Marquer tous les emails comme supprimés en une seule fois
      await new Promise<void>((resolve, reject) => {
        this.imap.addFlags(uids, '\\Deleted', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Supprimer tous les emails marqués en une seule fois
      await new Promise<void>((resolve, reject) => {
        this.imap.expunge((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.logger.log(`${uids.length} emails supprimés avec succès`);

      return uids.length;
    } catch (err) {
      this.logger.error('Erreur lors de la suppression du lot:', err);
      return 0;
    }
  }

  private async deleteSingleEmailWithoutReconnection(
    uid: number,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, 5000);

      // Marquer comme supprimé
      this.imap.addFlags([uid], '\\Deleted', (err) => {
        if (!resolved) {
          if (err) {
            clearTimeout(timeoutId);
            resolved = true;
            resolve(false);
            return;
          }

          // Supprimer immédiatement
          this.imap.expunge((expungeErr) => {
            if (!resolved) {
              clearTimeout(timeoutId);
              resolved = true;

              if (expungeErr) {
                resolve(false);
                return;
              }

              resolve(true);
            }
          });
        }
      });
    });
  }

  async processEmails(): Promise<{ deleted: number }> {
    try {
      this.logger.log('Démarrage du traitement des emails...');
      await this.ensureConnection();

      const openInbox = promisify<string, Imap.Box>(
        this.imap.openBox.bind(this.imap),
      );
      await openInbox('INBOX');

      this.logger.log('Connexion établie à la boîte mail...');
      const results = await promisify(this.imap.search.bind(this.imap))([
        'ALL',
      ]);

      if (!results || results.length === 0) {
        this.logger.log('Aucun email trouvé');
        this.imap.end();
        return { deleted: 0 };
      }

      this.logger.log(`Nombre total d'emails trouvés : ${results.length}`);

      // Traiter par lots de 100 emails maximum
      const batchSize = 100;
      let totalAnalyzed = 0;
      let totalDeleted = 0;

      for (let i = 0; i < results.length; i += batchSize) {
        const currentBatch = results.slice(i, i + batchSize);
        this.logger.log(
          `Traitement du lot ${Math.floor(i / batchSize) + 1}/${Math.ceil(results.length / batchSize)} (${currentBatch.length} emails)`,
        );

        const { analyzed, deleted } = await this.processBatch(currentBatch);

        totalAnalyzed += analyzed;
        totalDeleted += deleted;

        this.logger.log(
          `Lot traité: ${analyzed} analysés, ${deleted} supprimés. Total: ${totalAnalyzed}/${results.length} analysés, ${totalDeleted} supprimés.`,
        );
      }

      this.logger.log(
        `🎉 Traitement terminé - Total d'emails analysés: ${totalAnalyzed}, supprimés: ${totalDeleted}`,
      );
      this.imap.end();

      return { deleted: totalDeleted };
    } catch (err) {
      this.logger.error('Erreur globale:', err);
      if (this.imap && this.imap.state !== 'disconnected') {
        this.imap.end();
      }
      throw err;
    }
  }

  private async processBatch(
    uids: number[],
  ): Promise<{ analyzed: number; deleted: number }> {
    return new Promise((resolve) => {
      const fetch = this.imap.fetch(uids, { bodies: '' });
      let analyzed = 0;
      const toDelete: number[] = [];

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

          void (async () => {
            try {
              const parsed = await simpleParser(buffer);
              analyzed++;

              // Vérifier si c'est un email à supprimer
              const subject = parsed.subject || '';
              const text = (parsed.text || '').toLowerCase();
              const html = (parsed.html || '').toLowerCase();

              const keywords = [
                'unsubscribe',
                'désabonnement',
                'desabonnement',
                'no-reply',
                'noreply',
              ];
              if (
                keywords.some(
                  (kw) =>
                    text.includes(kw) ||
                    html.includes(kw) ||
                    subject.toLowerCase().includes(kw),
                )
              ) {
                toDelete.push(uid);
              }

              // Libérer la mémoire immédiatement
              buffer = '';
            } catch (err) {
              console.log(err);
            }
          })();
        });
      });

      fetch.once('end', () => {
        void (async () => {
          let deleted = 0;
          if (toDelete.length > 0) {
            this.logger.log(
              `${toDelete.length}/${analyzed} emails à supprimer identifiés`,
            );
            deleted = await this.deleteEmailBatch(toDelete);
            this.logger.log(
              `${deleted}/${toDelete.length} emails effectivement supprimés`,
            );
          }
          resolve({ analyzed, deleted });
        })();
      });
    });
  }

  async startProcessing(): Promise<{ deleted: number }> {
    return this.processEmails();
  }

  async loadEmails(): Promise<{ total: number; emails: any[] }> {
    try {
      this.logger.log('Chargement des emails...');
      await this.ensureConnection();

      const openInbox = promisify<string, Imap.Box>(
        this.imap.openBox.bind(this.imap),
      );
      await openInbox('INBOX');

      const searchCriteria = ['ALL'];
      const results = await promisify(this.imap.search.bind(this.imap))(
        searchCriteria,
      );

      if (!results || results.length === 0) {
        this.logger.log('Aucun email trouvé');
        this.imap.end();
        return { total: 0, emails: [] };
      }

      this.logger.log(
        `${results.length} emails trouvés, chargement en cours...`,
      );

      const batchSize = 100;
      let processedEmails = 0;
      const emails: any[] = [];

      for (let i = 0; i < Math.min(results.length, 500); i += batchSize) {
        const batch = results.slice(i, i + batchSize);
        const batchEmails = await this.fetchEmailBatch(batch);
        emails.push(...batchEmails);
        processedEmails += batch.length;
        this.logger.log(
          `Chargé ${processedEmails}/${Math.min(results.length, 500)} emails`,
        );
      }

      this.logger.log(`Chargement terminé: ${emails.length} emails`);
      this.imap.end();
      return { total: results.length, emails };
    } catch (err) {
      this.logger.error('Erreur:', err);
      if (this.imap && this.imap.state !== 'disconnected') {
        this.imap.end();
      }
      throw err;
    }
  }

  private async fetchEmailBatch(uids: number[]): Promise<any[]> {
    return new Promise((resolve) => {
      const emails: any[] = [];
      const fetch = this.imap.fetch(uids, { bodies: '' });

      fetch.on('message', (msg: Imap.ImapMessage) => {
        let buffer = '';

        msg.on('body', (stream: Stream) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
        });

        msg.once('end', () => {
          void (async () => {
            try {
              const parsed = await simpleParser(buffer);
              emails.push({
                subject: parsed.subject,
                from: parsed.from?.text,
                date: parsed.date,
              });
              buffer = '';
            } catch (err) {
              console.log(err);
            }
          })();
        });
      });

      fetch.once('end', () => {
        resolve(emails);
      });
    });
  }

  async filterAndDeleteEmails(): Promise<{ deleted: number }> {
    try {
      await this.ensureConnection();

      const openInbox = promisify<string, Imap.Box>(
        this.imap.openBox.bind(this.imap),
      );
      await openInbox('INBOX');

      const searchCriteria = ['ALL'];
      const results = await new Promise<number[]>((resolve, reject) => {
        this.imap.search(searchCriteria, (err, results) => {
          if (err) reject(new Error(String(err)));
          if (!results || results.length === 0) {
            resolve([]);
          } else {
            this.logger.log(
              `Nombre total d'emails à analyser : ${results.length}`,
            );
            resolve(results);
          }
        });
      });

      if (results.length === 0) {
        this.imap.end();
        return { deleted: 0 };
      }

      // Traiter par lots de 100 emails maximum
      const batchSize = 100;
      let totalAnalyzed = 0;
      let totalDeleted = 0;

      for (let i = 0; i < results.length; i += batchSize) {
        const currentBatch = results.slice(i, i + batchSize);
        this.logger.log(
          `Traitement du lot ${Math.floor(i / batchSize) + 1}/${Math.ceil(results.length / batchSize)} (${currentBatch.length} emails)`,
        );

        const { analyzed, deleted } = await this.processBatch(currentBatch);

        totalAnalyzed += analyzed;
        totalDeleted += deleted;

        this.logger.log(
          `Lot traité: ${analyzed} analysés, ${deleted} supprimés. Total: ${totalAnalyzed}/${results.length}`,
        );
      }

      this.logger.log(
        `Traitement terminé - Emails analysés: ${totalAnalyzed}, supprimés: ${totalDeleted}`,
      );
      this.imap.end();
      return { deleted: totalDeleted };
    } catch (err) {
      this.logger.error('Erreur lors du filtrage:', err);
      if (this.imap && this.imap.state !== 'disconnected') {
        this.imap.end();
      }
      throw err;
    }
  }

  private async ensureConnection(): Promise<void> {
    if (this.imap.state === 'disconnected') {
      this.logger.log('Connexion au serveur IMAP...');
      await new Promise<void>((resolve, reject) => {
        this.imap.once('ready', () => resolve());
        this.imap.once('error', reject);
        this.imap.connect();
      });
    }
  }

  async testDeleteSingleEmail(uid: number): Promise<boolean> {
    try {
      this.logger.log(`🔄 Test de suppression de l'email ${uid}...`);

      // S'assurer que nous sommes connectés
      await this.ensureConnection();

      // Ouvrir la boîte de réception
      await promisify<string, Imap.Box>(this.imap.openBox.bind(this.imap))(
        'INBOX',
      );

      // Utiliser notre méthode optimisée sans reconnexion
      return await this.deleteSingleEmailWithoutReconnection(uid);
    } catch (err) {
      this.logger.error('Erreur lors du test de suppression:', err);
      return false;
    }
  }
}
