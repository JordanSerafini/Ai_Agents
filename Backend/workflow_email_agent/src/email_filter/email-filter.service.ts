import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
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

  private async deleteEmailBatch(
    uids: number[],
    retryCount = 0,
  ): Promise<number> {
    return new Promise<number>((resolve) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.logger.error(
            '⏰ Timeout : la suppression a pris trop de temps.',
          );

          // Si nous avons moins de 2 tentatives et au moins 10 emails, réessayer avec un lot plus petit
          if (retryCount < 2 && uids.length > 10) {
            this.logger.log(
              `🔄 Tentative de nouvelle suppression avec un lot plus petit (${Math.floor(uids.length / 2)} emails)...`,
            );
            // Diviser le lot en deux et réessayer avec la première moitié
            const halfSize = Math.floor(uids.length / 2);
            const firstHalf = uids.slice(0, halfSize);

            // Réessayer de façon asynchrone pour ne pas bloquer
            setTimeout(() => {
              // Utilisation d'une IIFE (Immediately Invoked Function Expression) non-async
              void (async () => {
                const deletedInRetry = await this.deleteEmailBatch(
                  firstHalf,
                  retryCount + 1,
                );
                resolve(deletedInRetry);
              })();
            }, 1000);
          } else {
            resolve(0);
          }
        }
      }, 15000); // timeout de 15 secondes maximum

      if (uids.length === 0) {
        clearTimeout(timeout);
        return resolve(0);
      }

      this.imap.addFlags(uids, '\\Deleted', (err) => {
        if (resolved) return;
        if (err) {
          clearTimeout(timeout);
          resolved = true;
          this.logger.error('Erreur lors de la suppression:', err);

          // Si erreur et lot important, tenter avec un lot plus petit
          if (retryCount < 2 && uids.length > 10) {
            this.logger.log(
              `🔄 Tentative après erreur avec un lot plus petit (${Math.floor(uids.length / 2)} emails)...`,
            );
            const halfSize = Math.floor(uids.length / 2);
            const firstHalf = uids.slice(0, halfSize);

            setTimeout(() => {
              // Utilisation d'une IIFE (Immediately Invoked Function Expression) non-async
              void (async () => {
                const deletedInRetry = await this.deleteEmailBatch(
                  firstHalf,
                  retryCount + 1,
                );
                resolve(deletedInRetry);
              })();
            }, 1000);
          } else {
            resolve(0);
          }
        } else {
          this.imap.expunge((expungeErr) => {
            if (resolved) return;
            clearTimeout(timeout);
            resolved = true;
            if (expungeErr) {
              this.logger.error(
                'Erreur lors de la suppression définitive:',
                expungeErr,
              );
              resolve(0);
            } else {
              this.logger.log(
                `✅ ${uids.length} emails supprimés définitivement`,
              );
              resolve(uids.length);
            }
          });
        }
      });
    });
  }

  async processEmails(): Promise<{ deleted: number }> {
    try {
      this.logger.log('Démarrage du traitement des emails...');
      await new Promise<void>((resolve, reject) => {
        this.imap.once('ready', () => resolve());
        this.imap.once('error', reject);
        this.imap.connect();
      });

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

      this.logger.log(`Emails trouvés : ${results.length}`);
      const fetch = this.imap.fetch(results, { bodies: '' });

      let analyzedCount = 0;
      const emailsToDelete: number[] = [];
      let totalDeleted = 0;
      let shouldStop = false;

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

          msg.once('end', async () => {
            if (!uid) {
              this.logger.warn(`❌ UID manquant pour un email`);
              return;
            }

            if (shouldStop) {
              return;
            }

            try {
              const parsed = await simpleParser(buffer);
              analyzedCount++;

              if (analyzedCount % 1000 === 0) {
                this.logger.log(`Emails analysés: ${analyzedCount}`);
              }

              if (analyzedCount <= 10) {
                this.logger.log("=== Détails de l'email ===");
                this.logger.log(`Sujet: ${parsed.subject}`);
                this.logger.log(`De: ${parsed.from?.text}`);
                this.logger.log(
                  `Texte brut: ${parsed.text ? parsed.text.substring(0, 200) : 'Non disponible'}`,
                );
                this.logger.log(
                  `HTML: ${parsed.html ? parsed.html.substring(0, 200) : 'Non disponible'}`,
                );
                this.logger.log('=======================');
              }

              const subject = parsed.subject || '';
              const textContent = (parsed.text || '').toLowerCase();
              const htmlContent = (parsed.html || '').toLowerCase();
              const subjectContent = subject.toLowerCase();

              const keywords = [
                'unsubscribe',
                'désabonnement',
                'desabonnement',
                'no-reply',
                'noreply',
              ];

              const hasUnsubscribe = keywords.some(
                (keyword) =>
                  textContent.includes(keyword) ||
                  htmlContent.includes(keyword) ||
                  subjectContent.includes(keyword),
              );

              if (hasUnsubscribe) {
                emailsToDelete.push(uid);
                this.logger.log(
                  `✅ Email à supprimer trouvé [UID: ${uid}] Sujet: "${subject}"`,
                );
              }

              if (analyzedCount >= 100) {
                this.logger.log('🔸 Arrêt du traitement à 100 emails');
                shouldStop = true;

                const emailsBatch = [...emailsToDelete];
                emailsToDelete.length = 0;
                analyzedCount = 0;

                this.logger.log(
                  `Suppression du lot de ${emailsBatch.length} emails...`,
                );
                const deletedInBatch = await this.deleteEmailBatch(emailsBatch);
                totalDeleted += deletedInBatch;

                shouldStop = false;
                this.logger.log(
                  '▶️ Reprise du traitement du prochain lot de 100 emails',
                );
              }
            } catch (err) {
              this.logger.error('Erreur lors du parsing:', err);
            }
          });
        });

        fetch.once('end', async () => {
          // Traiter le dernier lot s'il reste des emails
          if (emailsToDelete.length > 0) {
            this.logger.log(
              `Traitement du dernier lot (${emailsToDelete.length} emails)`,
            );
            const deletedFinal = await this.deleteEmailBatch(emailsToDelete);
            totalDeleted += deletedFinal;
            this.logger.log(`✓ Dernier lot: ${deletedFinal} emails supprimés`);
          }

          this.logger.log(
            `🎉 Traitement terminé - Total d'emails supprimés : ${totalDeleted}`,
          );
          this.imap.end();
          resolve();
        });
      });

      return { deleted: totalDeleted };
    } catch (err) {
      this.logger.error('Erreur globale:', err);
      if (this.imap && this.imap.state !== 'disconnected') {
        this.imap.end();
      }
      throw err;
    }
  }

  async startProcessing(): Promise<{ deleted: number }> {
    return this.processEmails();
  }

  async loadEmails(): Promise<{ total: number; emails: any[] }> {
    try {
      this.logger.log('Chargement des emails...');

      await new Promise<void>((resolve, reject) => {
        this.imap.once('ready', () => resolve());
        this.imap.once('error', (err) => reject(new Error(String(err))));
        this.imap.connect();
      });

      const openInbox = promisify<string, Imap.Box>(
        this.imap.openBox.bind(this.imap),
      );
      await openInbox('INBOX');

      this.logger.log('Connexion établie à la boîte mail...');

      const searchCriteria = ['ALL'];
      const fetch = await new Promise<any>((resolve, reject) => {
        this.imap.search(searchCriteria, (err, results) => {
          if (err) reject(new Error(String(err)));

          if (!results || results.length === 0) {
            this.logger.log('Aucun email trouvé');
            return resolve(null);
          }

          this.logger.log(`Nombre total d'emails trouvés : ${results.length}`);
          const fetch = this.imap.fetch(results, { bodies: '' });
          resolve(fetch);
        });
      });

      if (!fetch) {
        this.imap.end();
        return { total: 0, emails: [] };
      }

      const emails: any[] = [];

      await new Promise<void>((resolve) => {
        fetch.on('message', (msg: any) => {
          msg.on('body', async (stream: any) => {
            try {
              const parsed = (await simpleParser(stream)) as ParsedMail;
              emails.push({
                subject: parsed.subject,
                from: parsed.from?.text,
                date: parsed.date,
                hasUnsubscribe:
                  parsed.text?.toLowerCase().includes('unsubscribe') || false,
              });
            } catch (err) {
              this.logger.error("Erreur lors du traitement de l'email:", err);
            }
          });
        });

        fetch.once('end', () => {
          this.logger.log(
            `Chargement terminé : ${emails.length} emails analysés`,
          );
          this.imap.end();
          resolve();
        });
      });

      return { total: emails.length, emails };
    } catch (err) {
      this.logger.error('Erreur:', err);
      if (this.imap && this.imap.state !== 'disconnected') {
        this.imap.end();
      }
      throw err;
    }
  }

  async filterAndDeleteEmails(): Promise<{ deleted: number }> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.imap.once('ready', () => resolve());
        this.imap.once('error', (err) => reject(new Error(String(err))));
        this.imap.connect();
      });

      const openInbox = promisify<string, Imap.Box>(
        this.imap.openBox.bind(this.imap),
      );
      await openInbox('INBOX');

      const searchCriteria = ['ALL'];
      const fetch = await new Promise<any>((resolve, reject) => {
        this.imap.search(searchCriteria, (err, results) => {
          if (err) reject(new Error(String(err)));

          if (!results || results.length === 0) {
            return resolve(null);
          }

          this.logger.log(
            `Nombre total d'emails à analyser : ${results.length}`,
          );
          const fetch = this.imap.fetch(results, { bodies: '' });
          resolve(fetch);
        });
      });

      if (!fetch) {
        this.imap.end();
        return { deleted: 0 };
      }

      const emailsToDelete: number[] = [];
      let analyzedCount = 0;
      let totalDeleted = 0;
      let shouldStop = false;

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

          msg.once('end', async () => {
            if (!uid) {
              this.logger.warn(`❌ UID manquant pour un email`);
              return;
            }

            if (shouldStop) {
              return;
            }

            try {
              const parsed = await simpleParser(buffer);
              analyzedCount++;

              if (analyzedCount % 1000 === 0) {
                this.logger.log(`Emails analysés: ${analyzedCount}`);
              }

              if (analyzedCount <= 10) {
                this.logger.log("=== Détails de l'email ===");
                this.logger.log(`Sujet: ${parsed.subject}`);
                this.logger.log(`De: ${parsed.from?.text}`);
                this.logger.log(
                  `Texte brut: ${parsed.text ? parsed.text.substring(0, 200) : 'Non disponible'}`,
                );
                this.logger.log(
                  `HTML: ${parsed.html ? parsed.html.substring(0, 200) : 'Non disponible'}`,
                );
                this.logger.log('=======================');
              }

              const subject = parsed.subject || '';
              const textContent = (parsed.text || '').toLowerCase();
              const htmlContent = (parsed.html || '').toLowerCase();
              const subjectContent = subject.toLowerCase();

              const keywords = [
                'unsubscribe',
                'désabonnement',
                'desabonnement',
                'no-reply',
                'noreply',
              ];

              const hasUnsubscribe = keywords.some(
                (keyword) =>
                  textContent.includes(keyword) ||
                  htmlContent.includes(keyword) ||
                  subjectContent.includes(keyword),
              );

              if (hasUnsubscribe) {
                emailsToDelete.push(uid);
                this.logger.log(
                  `✅ Email à supprimer trouvé [UID: ${uid}] Sujet: "${subject}"`,
                );
              }

              if (analyzedCount >= 100) {
                this.logger.log('🔸 Arrêt du traitement à 100 emails');
                shouldStop = true;

                const emailsBatch = [...emailsToDelete];
                emailsToDelete.length = 0;
                analyzedCount = 0;

                this.logger.log(
                  `Suppression du lot de ${emailsBatch.length} emails...`,
                );
                const deletedInBatch = await this.deleteEmailBatch(emailsBatch);
                totalDeleted += deletedInBatch;

                shouldStop = false;
                this.logger.log(
                  '▶️ Reprise du traitement du prochain lot de 100 emails',
                );
              }
            } catch (err) {
              this.logger.error('Erreur lors du parsing:', err);
            }
          });
        });

        fetch.once('end', async () => {
          if (!shouldStop && emailsToDelete.length > 0) {
            this.logger.log(
              `Suppression finale de ${emailsToDelete.length} emails...`,
            );
            const deletedFinal = await this.deleteEmailBatch(emailsToDelete);
            totalDeleted += deletedFinal;
            this.logger.log(
              `🎉 Traitement terminé - Total d'emails supprimés: ${totalDeleted}`,
            );
            this.imap.end();
            resolve();
          } else if (!shouldStop) {
            this.logger.log('Traitement terminé, aucun email à supprimer');
            this.imap.end();
            resolve();
          }
        });
      });

      return { deleted: totalDeleted };
    } catch (err) {
      this.logger.error('Erreur lors du filtrage:', err);
      if (this.imap && this.imap.state !== 'disconnected') {
        this.imap.end();
      }
      throw err;
    }
  }
}
