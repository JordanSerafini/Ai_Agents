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
    if (uids.length === 0) return 0;

    // Limite le nombre d'emails traités en une fois pour éviter de surcharger le serveur
    const maxEmailsPerBatch = 10;
    const currentBatch = uids.slice(0, maxEmailsPerBatch);
    const remainingUids = uids.slice(maxEmailsPerBatch);

    this.logger.log(
      `📦 Traitement d'un lot de ${currentBatch.length} emails sur ${uids.length} au total`,
    );

    // Assurons-nous d'être connectés avant de commencer le traitement du lot
    try {
      await this.ensureConnection();

      // Ouvrir la boîte de réception une seule fois pour le lot
      await promisify<string, Imap.Box>(this.imap.openBox.bind(this.imap))(
        'INBOX',
      );

      const count = await this.processEmailsSequentially(currentBatch, 0);

      // S'il reste des emails à traiter, appeler récursivement avec pause
      if (remainingUids.length > 0) {
        this.logger.log(`⏱️ Pause de 3 secondes avant le prochain lot...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const remainingCount = await this.deleteEmailBatch(remainingUids);
        return count + remainingCount;
      }

      return count;
    } catch (err) {
      this.logger.error(
        'Erreur lors de la préparation du traitement par lot:',
        err,
      );

      // En cas d'erreur, attendre 10 secondes avant de tenter le lot restant
      if (remainingUids.length > 0) {
        this.logger.log(
          '⚠️ Attente de 10 secondes avant de tenter le prochain lot...',
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return await this.deleteEmailBatch(remainingUids);
      }

      return 0;
    }
  }

  // Nouvelle méthode pour traiter les emails de manière séquentielle
  private async processEmailsSequentially(
    uids: number[],
    count: number,
  ): Promise<number> {
    if (uids.length === 0) return count;

    const currentEmail = uids[0];
    const remaining = uids.slice(1);

    this.logger.log(`🔄 Traitement de l'email ${currentEmail}...`);

    try {
      // Traiter un seul email
      const success =
        await this.deleteSingleEmailWithoutReconnection(currentEmail);

      if (success) {
        this.logger.log(`✅ Email ${currentEmail} supprimé avec succès`);
        count++;
      } else {
        this.logger.error(
          `❌ Échec de la suppression de l'email ${currentEmail}`,
        );
      }

      // Attendre 2 secondes avant de passer à l'email suivant
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Traiter les emails restants
      return this.processEmailsSequentially(remaining, count);
    } catch (err) {
      this.logger.error(
        `❌ Erreur lors de la suppression de l'email ${currentEmail}:`,
        err,
      );
      // En cas d'erreur, on continue avec les emails restants
      return this.processEmailsSequentially(remaining, count);
    }
  }

  // Version simplifiée de testDeleteSingleEmail qui ne tente pas de se reconnecter
  private async deleteSingleEmailWithoutReconnection(
    uid: number,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.logger.error(
            `⏰ Timeout : la suppression a pris trop de temps pour l'email ${uid}`,
          );
          resolve(false);
        }
      }, 30000);

      this.logger.log(`🔄 Marquage de l'email ${uid} comme supprimé...`);

      // Marquer l'email comme supprimé
      this.imap.addFlags([uid], '\\Deleted', (err) => {
        if (!resolved) {
          if (err) {
            this.logger.error(
              `❌ Erreur lors du marquage de l'email ${uid}:`,
              err,
            );
            clearTimeout(timeoutId);
            resolved = true;
            resolve(false);
            return;
          }

          this.logger.log(
            `✅ Email ${uid} marqué comme supprimé, attente avant expunge...`,
          );

          // Attendre 3 secondes avant d'expunger
          setTimeout(() => {
            // Forcer la suppression
            this.imap.expunge((expungeErr) => {
              if (!resolved) {
                clearTimeout(timeoutId);
                resolved = true;

                if (expungeErr) {
                  this.logger.error(
                    `❌ Erreur lors de l'expunge de l'email ${uid}:`,
                    expungeErr,
                  );
                  resolve(false);
                  return;
                }

                this.logger.log(`✅ Email ${uid} supprimé avec succès`);
                resolve(true);
              }
            });
          }, 3000);
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

            // Attendre que l'analyse et le traitement de cet email soit terminé avant de passer au suivant
            try {
              const parsed = await simpleParser(buffer);
              analyzedCount++;

              if (analyzedCount % 100 === 0) {
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
                this.logger.log(
                  `✅ Email à supprimer trouvé [UID: ${uid}] Sujet: "${subject}"`,
                );

                // Supprimer l'email immédiatement et ATTENDRE la fin de la suppression
                this.logger.log(
                  `⏱️ Début de la suppression de l'email ${uid}...`,
                );
                const success = await this.testDeleteSingleEmail(uid);

                if (success) {
                  this.logger.log(
                    `✅ Email [UID: ${uid}] supprimé avec succès - continuation du traitement`,
                  );
                  totalDeleted++;
                } else {
                  this.logger.error(
                    `❌ Échec de la suppression de l'email [UID: ${uid}] - continuation du traitement`,
                  );
                }

                // Pause de 2 secondes après chaque suppression pour éviter de surcharger le serveur
                this.logger.log(
                  `⏱️ Pause de 2 secondes après la suppression de l'email ${uid}...`,
                );
                await new Promise((resolve) => setTimeout(resolve, 2000));
                this.logger.log(
                  `✅ Fin de la pause, passage à l'email suivant`,
                );
              }

              // Limiter le nombre d'emails analysés
              if (analyzedCount >= 100) {
                this.logger.log(
                  '🔸 Arrêt du traitement après 100 emails analysés',
                );
                shouldStop = true;
              }
            } catch (err) {
              this.logger.error('Erreur lors du parsing:', err);
            }
          });
        });

        fetch.once('end', () => {
          this.logger.log(
            `🎉 Traitement terminé - Total d'emails analysés: ${analyzedCount}, supprimés: ${totalDeleted}`,
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

            // Attendre que l'analyse et le traitement de cet email soit terminé avant de passer au suivant
            try {
              const parsed = await simpleParser(buffer);
              analyzedCount++;

              if (analyzedCount % 100 === 0) {
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
                this.logger.log(
                  `✅ Email à supprimer trouvé [UID: ${uid}] Sujet: "${subject}"`,
                );

                // Supprimer l'email immédiatement et ATTENDRE la fin de la suppression
                this.logger.log(
                  `⏱️ Début de la suppression de l'email ${uid}...`,
                );
                const success = await this.testDeleteSingleEmail(uid);

                if (success) {
                  this.logger.log(
                    `✅ Email [UID: ${uid}] supprimé avec succès - continuation du traitement`,
                  );
                  totalDeleted++;
                } else {
                  this.logger.error(
                    `❌ Échec de la suppression de l'email [UID: ${uid}] - continuation du traitement`,
                  );
                }

                // Pause de 2 secondes après chaque suppression pour éviter de surcharger le serveur
                this.logger.log(
                  `⏱️ Pause de 2 secondes après la suppression de l'email ${uid}...`,
                );
                await new Promise((resolve) => setTimeout(resolve, 2000));
                this.logger.log(
                  `✅ Fin de la pause, passage à l'email suivant`,
                );
              }

              // Limiter le nombre d'emails analysés
              if (analyzedCount >= 100) {
                this.logger.log(
                  '🔸 Arrêt du traitement après 100 emails analysés',
                );
                shouldStop = true;
              }
            } catch (err) {
              this.logger.error('Erreur lors du parsing:', err);
            }
          });
        });

        fetch.once('end', () => {
          this.logger.log(
            `🎉 Traitement terminé - Total d'emails analysés: ${analyzedCount}, supprimés: ${totalDeleted}`,
          );
          this.imap.end();
          resolve();
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
