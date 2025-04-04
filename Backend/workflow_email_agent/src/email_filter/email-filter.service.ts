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

      // Vérifier si les emails ont été supprimés
      const remainingEmails = await promisify(this.imap.search.bind(this.imap))(
        ['ALL'],
      );
      const deletedCount =
        uids.length -
        uids.filter((uid) => remainingEmails.includes(uid)).length;

      this.logger.log(
        `${deletedCount}/${uids.length} emails effectivement supprimés (vérifié)`,
      );

      return deletedCount;
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

  private async getAllMailboxes(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.imap.getBoxes((err, boxes) => {
        if (err) {
          reject(err);
          return;
        }

        // Extraire tous les noms de dossiers (y compris les sous-dossiers)
        const mailboxes: string[] = ['INBOX'];

        const extractFolders = (boxes: Imap.MailBoxes, prefix: string = '') => {
          Object.keys(boxes).forEach((key) => {
            const fullPath = prefix + key;
            mailboxes.push(fullPath);

            if (boxes[key].children) {
              extractFolders(
                boxes[key].children,
                fullPath + boxes[key].delimiter,
              );
            }
          });
        };

        extractFolders(boxes);
        resolve(mailboxes);
      });
    });
  }

  async processEmails(): Promise<{ deleted: number }> {
    try {
      this.logger.log('Démarrage du traitement des emails...');
      await this.ensureConnection();

      // Récupérer tous les dossiers
      const mailboxes = await this.getAllMailboxes();
      this.logger.log(`Dossiers trouvés: ${mailboxes.join(', ')}`);

      let totalDeleted = 0;

      // Traiter chaque dossier
      for (const mailbox of mailboxes) {
        try {
          this.logger.log(`Traitement du dossier: ${mailbox}`);
          const openBox = promisify<string, boolean, Imap.Box>(
            this.imap.openBox.bind(this.imap),
          );
          await openBox(mailbox, false); // false = ouverture en mode lecture/écriture

          const results = await promisify(this.imap.search.bind(this.imap))([
            'ALL',
          ]);

          if (!results || results.length === 0) {
            this.logger.log('Aucun email trouvé');
            this.imap.end();
            continue;
          }

          this.logger.log(`Nombre total d'emails trouvés : ${results.length}`);

          // Augmenter drastiquement la taille des lots pour accélérer le traitement
          const batchSize = 500; // 5x plus qu'avant
          let totalAnalyzed = 0;
          let batchDeleted = 0;

          // Traiter plusieurs lots en parallèle pour encore plus de vitesse
          const batches: number[][] = [];
          for (let i = 0; i < results.length; i += batchSize) {
            batches.push(results.slice(i, i + batchSize));
          }

          // Traiter jusqu'à 3 lots en parallèle
          const concurrentBatches = 3;
          for (let i = 0; i < batches.length; i += concurrentBatches) {
            const currentBatches = batches.slice(i, i + concurrentBatches);
            this.logger.log(
              `Traitement des lots ${i + 1} à ${Math.min(i + concurrentBatches, batches.length)}/${batches.length} en parallèle...`,
            );

            const batchResults = await Promise.all(
              currentBatches.map((batch) => this.processBatch(batch)),
            );

            for (const { analyzed, deleted } of batchResults) {
              totalAnalyzed += analyzed;
              batchDeleted += deleted;
            }

            this.logger.log(
              `Lots traités - Total: ${totalAnalyzed}/${results.length} analysés, ${batchDeleted} supprimés.`,
            );
          }

          totalDeleted += batchDeleted;
          this.logger.log(
            `Traitement terminé - Total d'emails analysés: ${totalAnalyzed}, supprimés: ${batchDeleted}`,
          );
        } catch (folderErr) {
          this.logger.error(
            `Erreur lors du traitement du dossier ${mailbox}:`,
            folderErr,
          );
          // Continuer avec le dossier suivant même en cas d'erreur
        }
      }

      this.logger.log(
        `🎉 Traitement de tous les dossiers terminé - Total supprimé: ${totalDeleted}`,
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
      const fetch = this.imap.fetch(uids, {
        bodies: [''],
      });
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

          (() => {
            try {
              // Réduire la charge en ne récupérant que les données nécessaires
              analyzed++;

              // Analyse plus complète incluant le corps du message
              const hasKeyword =
                buffer.toLowerCase().includes('unsubscribe') ||
                buffer.toLowerCase().includes('désabonnement') ||
                buffer.toLowerCase().includes('desabonnement') ||
                buffer.toLowerCase().includes('se désabonner') ||
                buffer.toLowerCase().includes('se desabonner') ||
                buffer.toLowerCase().includes('no-reply') ||
                buffer.toLowerCase().includes('noreply');

              if (hasKeyword) {
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
            // Copie du tableau toDelete pour éviter les modifications pendant le traitement
            const emailsToDelete = [...toDelete];
            this.logger.log(
              `${emailsToDelete.length}/${analyzed} emails à supprimer identifiés`,
            );
            deleted = await this.deleteEmailBatch(emailsToDelete);
            this.logger.log(
              `${deleted}/${emailsToDelete.length} emails effectivement supprimés`,
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

      // Appliquer la même optimisation que processEmails
      const batchSize = 500;
      const batches: number[][] = [];
      let totalAnalyzed = 0;
      let totalDeleted = 0;

      for (let i = 0; i < results.length; i += batchSize) {
        batches.push(results.slice(i, i + batchSize));
      }

      const concurrentBatches = 3;
      for (let i = 0; i < batches.length; i += concurrentBatches) {
        const currentBatches = batches.slice(i, i + concurrentBatches);
        this.logger.log(
          `Traitement des lots ${i + 1} à ${Math.min(i + concurrentBatches, batches.length)}/${batches.length} en parallèle...`,
        );

        const batchResults = await Promise.all(
          currentBatches.map((batch) => this.processBatch(batch)),
        );

        for (const { analyzed, deleted } of batchResults) {
          totalAnalyzed += analyzed;
          totalDeleted += deleted;
        }

        this.logger.log(
          `Lots traités - Total: ${totalAnalyzed}/${results.length} analysés, ${totalDeleted} supprimés.`,
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
