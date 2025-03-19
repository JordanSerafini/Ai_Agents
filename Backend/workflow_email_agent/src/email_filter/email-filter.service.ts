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

  private async deleteEmailBatch(uids: number[]): Promise<number> {
    return new Promise<number>((resolve) => {
      if (uids.length === 0) return resolve(0);

      this.imap.addFlags(uids, '\\Deleted', (err) => {
        if (err) {
          this.logger.error('Erreur lors de la suppression:', err);
          resolve(0);
        } else {
          this.imap.expunge((expungeErr) => {
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
      let currentBatch = 1;

      await new Promise<void>((resolve) => {
        fetch.on('message', (msg: Imap.ImapMessage) => {
          let uid: number | null = null;
          let messageProcessed = false;

          msg.on('attributes', (attrs) => {
            uid = attrs.uid;
          });

          msg.on('body', async (stream: Stream) => {
            try {
              if (messageProcessed) return;
              messageProcessed = true;

              const parsed = await simpleParser(stream);
              analyzedCount++;

              // Afficher le compteur moins fréquemment
              if (analyzedCount % 1000 === 0) {
                this.logger.log(`Emails analysés: ${analyzedCount}`);
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
                if (uid) {
                  emailsToDelete.push(uid);
                  // Réduire la fréquence des logs pour les emails à supprimer
                  if (emailsToDelete.length % 100 === 0) {
                    this.logger.log(
                      `✅ ${emailsToDelete.length} emails marqués pour suppression`,
                    );
                  }
                } else {
                  this.logger.warn(
                    `❌ UID manquant pour l'email : "${subject}"`,
                  );
                }
              }

              // Traitement par lot de 1000
              if (analyzedCount % 1000 === 0) {
                if (emailsToDelete.length > 0) {
                  const deletedInBatch =
                    await this.deleteEmailBatch(emailsToDelete);
                  totalDeleted += deletedInBatch;
                  this.logger.log(
                    `✓ Lot #${currentBatch}: ${deletedInBatch} emails supprimés (Total: ${totalDeleted})`,
                  );
                  emailsToDelete.length = 0;
                }
                currentBatch++;
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
          let messageProcessed = false;

          msg.on('attributes', (attrs) => {
            uid = attrs.uid;
          });

          msg.on('body', async (stream: Stream) => {
            try {
              if (messageProcessed) return;
              messageProcessed = true;

              const parsed: ParsedMail = await simpleParser(stream);
              analyzedCount++;

              // Afficher le compteur moins fréquemment
              if (analyzedCount % 1000 === 0) {
                this.logger.log(`Emails analysés: ${analyzedCount}`);
              }

              // Logs de débogage pour les 10 premiers emails
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
                if (uid) {
                  emailsToDelete.push(uid);
                  this.logger.log(
                    `✅ Email à supprimer trouvé [UID: ${uid}] Sujet: "${subject}"`,
                  );
                } else {
                  this.logger.warn(
                    `❌ UID manquant pour l'email : "${subject}"`,
                  );
                }
              }

              if (analyzedCount >= 200) {
                this.logger.log('🔸 Arrêt du traitement à 200 emails');
                shouldStop = true;

                const emailsBatch = [...emailsToDelete];
                emailsToDelete.length = 0;
                analyzedCount = 0; // Réinitialisation immédiate du compteur

                this.logger.log(
                  `Suppression du lot de ${emailsBatch.length} emails...`,
                );
                await new Promise<void>((resolveDelete) => {
                  this.imap.addFlags(emailsBatch, '\\Deleted', (err) => {
                    if (err) {
                      this.logger.error('Erreur lors de la suppression:', err);
                      this.imap.end();
                      resolveDelete();
                    } else {
                      totalDeleted += emailsBatch.length;
                      this.logger.log(
                        `Emails supprimés: ${totalDeleted} au total`,
                      );
                      this.imap.expunge(() => {
                        resolveDelete();
                      });
                    }
                  });
                });

                shouldStop = false;
                this.logger.log(
                  '▶️ Reprise du traitement du prochain lot de 200 emails',
                );
              }
            } catch (err) {
              this.logger.error('Erreur lors du parsing:', err);
            }
          });
        });

        fetch.once('end', () => {
          if (!shouldStop && emailsToDelete.length > 0) {
            this.logger.log(
              `Suppression finale de ${emailsToDelete.length} emails...`,
            );
            this.imap.addFlags(emailsToDelete, '\\Deleted', (err) => {
              if (err) {
                this.logger.error('Erreur lors de la suppression:', err);
                this.imap.end();
                resolve();
              } else {
                totalDeleted += emailsToDelete.length;
                this.logger.log(`Emails supprimés: ${totalDeleted} au total`);
                this.imap.expunge(() => {
                  this.imap.end();
                  resolve();
                });
              }
            });
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
