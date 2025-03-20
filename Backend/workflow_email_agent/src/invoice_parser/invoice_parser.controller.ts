import { Controller, Post, Get, Param, Logger } from '@nestjs/common';
import { InvoiceParserService } from './invoice_parser.service';
import * as fs from 'fs';
import * as path from 'path';

// Interfaces pour les types de retour
interface InvoiceInfo {
  invoiceNumber: string;
  supplier: string;
  path: string;
  files: string[];
  metadata: any;
  textSample: string;
}

interface InvoicesResponse {
  success: boolean;
  message: string;
  invoices: InvoiceInfo[];
}

@Controller('invoice-parser')
export class InvoiceParserController {
  private readonly logger = new Logger(InvoiceParserController.name);
  private readonly extractPdfPath: string;

  constructor(private readonly invoiceParserService: InvoiceParserService) {
    this.extractPdfPath = path.join(process.cwd(), 'extractPdf');
  }

  @Post('process')
  async processInvoices() {
    this.logger.log('Démarrage du traitement des factures');

    try {
      const result =
        await this.invoiceParserService.extractAndProcessInvoices();

      return {
        success: true,
        message: `Traitement terminé: ${result.processed} factures traitées, ${result.failed} échecs`,
        processed: result.processed,
        failed: result.failed,
        invoiceNumbers: result.invoiceNumbers,
      };
    } catch (error) {
      this.logger.error('Erreur lors du traitement des factures:', error);
      return {
        success: false,
        message: `Erreur lors du traitement des factures: ${error.message}`,
        processed: 0,
        failed: 1,
        invoiceNumbers: [],
      };
    }
  }

  @Get('invoices')
  async getProcessedInvoices(): Promise<InvoicesResponse> {
    try {
      if (!fs.existsSync(this.extractPdfPath)) {
        return {
          success: false,
          message: "Le dossier d'extraction n'existe pas",
          invoices: [],
        };
      }

      // Lire le contenu du dossier d'extraction pour obtenir la liste des factures traitées
      const rootDirs = await fs.promises.readdir(this.extractPdfPath, {
        withFileTypes: true,
      });
      const supplierDirectories = rootDirs
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      const invoices: InvoiceInfo[] = [];

      // Pour chaque dossier de fournisseur
      for (const supplierDir of supplierDirectories) {
        const supplierPath = path.join(this.extractPdfPath, supplierDir);

        // Lire les factures dans le dossier du fournisseur
        const invoiceDirs = await fs.promises.readdir(supplierPath, {
          withFileTypes: true,
        });
        const invoiceDirectories = invoiceDirs
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        // Pour chaque dossier de facture, récupérer les informations
        for (const invoiceNumber of invoiceDirectories) {
          const invoicePath = path.join(supplierPath, invoiceNumber);
          const files = await fs.promises.readdir(invoicePath);

          // Vérifier si le fichier texte existe
          const textFile = files.find((file) => file.endsWith('.txt'));
          let textContent = '';

          if (textFile) {
            const textFilePath = path.join(invoicePath, textFile);
            textContent = await fs.promises.readFile(textFilePath, 'utf8');
          }

          // Vérifier si le fichier de métadonnées existe
          const metadataFile = files.find((file) =>
            file.endsWith('_metadata.json'),
          );
          let metadata = null;

          if (metadataFile) {
            const metadataFilePath = path.join(invoicePath, metadataFile);
            const metadataContent = await fs.promises.readFile(
              metadataFilePath,
              'utf8',
            );
            try {
              metadata = JSON.parse(metadataContent);
            } catch (error) {
              this.logger.error(
                `Erreur de parsing du fichier de métadonnées pour ${invoiceNumber}:`,
                error,
              );
            }
          }

          invoices.push({
            invoiceNumber,
            supplier: supplierDir,
            path: invoicePath,
            files,
            metadata,
            textSample:
              textContent.substring(0, 200) +
              (textContent.length > 200 ? '...' : ''),
          });
        }
      }

      return {
        success: true,
        message: `${invoices.length} factures traitées trouvées`,
        invoices,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des factures traitées:',
        error,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
        invoices: [],
      };
    }
  }

  @Get('invoice/:invoiceNumber')
  async getInvoiceDetails(@Param('invoiceNumber') invoiceNumber: string) {
    return this.getInvoiceDetailsImpl(invoiceNumber);
  }

  @Get('invoice/:invoiceNumber/:supplier')
  async getInvoiceDetailsWithSupplier(
    @Param('invoiceNumber') invoiceNumber: string,
    @Param('supplier') supplier: string,
  ) {
    return this.getInvoiceDetailsImpl(invoiceNumber, supplier);
  }

  private async getInvoiceDetailsImpl(
    invoiceNumber: string,
    supplier?: string,
  ) {
    try {
      // Si un fournisseur est spécifié, chercher dans ce dossier spécifique
      let invoicePath: string = ''; // Initialiser avec une valeur par défaut

      if (supplier) {
        invoicePath = path.join(this.extractPdfPath, supplier, invoiceNumber);
        if (!fs.existsSync(invoicePath)) {
          return {
            success: false,
            message: `La facture ${invoiceNumber} du fournisseur ${supplier} n'existe pas`,
            invoice: null,
          };
        }
      } else {
        // Sinon, rechercher la facture dans tous les dossiers fournisseurs
        const rootDirs = await fs.promises.readdir(this.extractPdfPath, {
          withFileTypes: true,
        });
        const supplierDirectories = rootDirs
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        let found = false;

        for (const supplierDir of supplierDirectories) {
          const testPath = path.join(
            this.extractPdfPath,
            supplierDir,
            invoiceNumber,
          );
          if (fs.existsSync(testPath)) {
            invoicePath = testPath;
            found = true;
            break;
          }
        }

        if (!found) {
          return {
            success: false,
            message: `La facture ${invoiceNumber} n'existe pas`,
            invoice: null,
          };
        }
      }

      // À ce stade, invoicePath devrait être défini, mais vérifions par sécurité
      if (!invoicePath) {
        return {
          success: false,
          message: `Impossible de localiser la facture ${invoiceNumber}`,
          invoice: null,
        };
      }

      const files = await fs.promises.readdir(invoicePath);
      let textContent = '';
      let pdfFile = '';
      let metadata = null;

      // Vérifier si le fichier texte existe
      const textFile = files.find((file) => file.endsWith('.txt'));
      if (textFile) {
        const textFilePath = path.join(invoicePath, textFile);
        textContent = await fs.promises.readFile(textFilePath, 'utf8');
      }

      // Vérifier si le fichier PDF existe
      const pdfFilePath = files.find((file) => file.endsWith('.pdf'));
      if (pdfFilePath) {
        pdfFile = pdfFilePath;
      }

      // Vérifier si le fichier de métadonnées existe
      const metadataFile = files.find((file) =>
        file.endsWith('_metadata.json'),
      );
      if (metadataFile) {
        const metadataFilePath = path.join(invoicePath, metadataFile);
        const metadataContent = await fs.promises.readFile(
          metadataFilePath,
          'utf8',
        );
        try {
          metadata = JSON.parse(metadataContent);
        } catch (error) {
          this.logger.error(
            `Erreur de parsing du fichier de métadonnées pour ${invoiceNumber}:`,
            error,
          );
        }
      }

      return {
        success: true,
        message: `Détails de la facture ${invoiceNumber}`,
        invoice: {
          invoiceNumber,
          path: invoicePath,
          files,
          textContent,
          pdfFile,
          metadata,
        },
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des détails de la facture ${invoiceNumber}:`,
        error,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
        invoice: null,
      };
    }
  }
}
