import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { ConfigService } from '@nestjs/config';
import { promisify } from 'util';

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

  async processEmails(): Promise<void> {
    try {
      this.logger.log('Démarrage du traitement des emails...');

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
      this.logger.log('Recherche des emails contenant "unsubscribe"...');

      const searchCriteria = ['ALL'];
      const fetch = await new Promise<any>((resolve, reject) => {
        this.imap.search(searchCriteria, (err, results) => {
          if (err) reject(new Error(String(err)));

          if (!results || results.length === 0) {
            this.logger.log('Aucun email trouvé');
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
        return;
      }

      const emailsToDelete: number[] = [];
      let analyzedCount = 0;

      fetch.on('message', (msg: any) => {
        msg.on('body', async (stream: any) => {
          try {
            const parsed = (await simpleParser(stream)) as ParsedMail;
            analyzedCount++;
            this.logger.log(`Emails analysés: ${analyzedCount}`);

            const hasUnsubscribe =
              parsed.text && parsed.text.toLowerCase().includes('unsubscribe');

            if (hasUnsubscribe) {
              this.logger.log(`[${msg.seqno}] Email à supprimer trouvé :`);
              this.logger.log(`    Sujet: ${parsed.subject}`);
              this.logger.log(`    De: ${parsed.from?.text}`);
              this.logger.log(`    Date: ${parsed.date}`);
              emailsToDelete.push(msg.seqno);
            }
          } catch (err) {
            this.logger.error("Erreur lors du traitement de l'email:", err);
          }
        });
      });

      fetch.once('error', (err) => {
        this.logger.error('Erreur de fetch:', err);
      });

      fetch.once('end', () => {
        this.logger.log('Analyse terminée !');
        this.logger.log(`Emails à supprimer : ${emailsToDelete.length}`);

        if (emailsToDelete.length > 0) {
          this.logger.log('Début de la suppression...');
          this.imap.addFlags(emailsToDelete, '\\Deleted', (err) => {
            if (err) {
              this.logger.error('Erreur lors de la suppression:', err);
              this.imap.end();
            } else {
              this.logger.log(
                `${emailsToDelete.length} email(s) marqué(s) pour suppression`,
              );

              this.imap.expunge((err) => {
                if (err) {
                  this.logger.error(
                    'Erreur lors de la suppression définitive:',
                    err,
                  );
                } else {
                  this.logger.log(
                    '✓ Emails supprimés définitivement avec succès !',
                  );
                }
                this.imap.end();
              });
            }
          });
        } else {
          this.logger.log('Aucun email à supprimer');
          this.imap.end();
        }
      });
    } catch (err) {
      this.logger.error('Erreur:', err);
      if (this.imap && this.imap.state !== 'disconnected') {
        this.imap.end();
      }
    }
  }

  async startProcessing(): Promise<void> {
    await this.processEmails();
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
        fetch.on('message', (msg: any) => {
          if (shouldStop) return;

          msg.on('body', async (stream: any) => {
            try {
              const parsed = (await simpleParser(stream)) as ParsedMail;
              analyzedCount++;
              this.logger.log(`Emails analysés: ${analyzedCount}`);

              if (parsed.text?.toLowerCase().includes('unsubscribe')) {
                emailsToDelete.push(msg.seqno);
              }

              // Arrêter à 5000 emails
              if (analyzedCount >= 5000) {
                shouldStop = true;
                this.logger.log('Arrêt du traitement à 5000 emails');

                if (emailsToDelete.length > 0) {
                  this.imap.addFlags(emailsToDelete, '\\Deleted', (err) => {
                    if (err) {
                      this.logger.error('Erreur lors de la suppression:', err);
                    } else {
                      totalDeleted += emailsToDelete.length;
                      this.logger.log(`Emails supprimés: ${totalDeleted}`);
                      this.imap.expunge(() => {
                        this.logger.log(
                          `Lot de ${emailsToDelete.length} emails supprimé`,
                        );
                        this.imap.end();
                        resolve();
                      });
                    }
                  });
                } else {
                  this.imap.end();
                  resolve();
                }
              }
            } catch (err) {
              console.log(err);
            }
          });
        });

        fetch.once('end', () => {
          if (!shouldStop && emailsToDelete.length > 0) {
            this.imap.addFlags(emailsToDelete, '\\Deleted', (err) => {
              if (err) {
                this.logger.error('Erreur lors de la suppression:', err);
              } else {
                totalDeleted += emailsToDelete.length;
                this.logger.log(`Emails supprimés: ${totalDeleted}`);
                this.imap.expunge(() => {
                  this.logger.log(
                    `Dernier lot de ${emailsToDelete.length} emails supprimé`,
                  );
                  this.imap.end();
                  resolve();
                });
              }
            });
          } else {
            this.imap.end();
            resolve();
          }
        });
      });

      return { deleted: totalDeleted };
    } catch (err) {
      if (this.imap && this.imap.state !== 'disconnected') {
        this.imap.end();
      }
      throw err;
    }
  }
}
