import {
  Controller,
  Post,
  Get,
  Param,
  Logger,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoiceParserService } from './invoice_parser.service';
import * as fs from 'fs';
import * as path from 'path';
import * as tesseract from 'node-tesseract-ocr';
import * as pdfParse from 'pdf-parse';

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

// Interface pour les factures traitées
interface ProcessedInvoice {
  filename: string;
  invoiceNumber: string;
  supplier: string | null;
  amount: string | null;
  date: string | null;
}

@Controller('invoice-parser')
export class InvoiceParserController {
  private readonly logger = new Logger(InvoiceParserController.name);
  private readonly extractPdfPath: string;
  private readonly persistencePath: string;

  constructor(private readonly invoiceParserService: InvoiceParserService) {
    this.extractPdfPath = path.join('/app', 'extractPdf');
    this.persistencePath = path.join('/app', 'persistence', 'Factures');
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
      let invoicePath: string = '';

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

  @Post('analyze-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async analyzePdfWithHuggingFace(@UploadedFile() file) {
    this.logger.log('Analyse de facture avec Hugging Face');

    if (!file) {
      return {
        success: false,
        message: 'Aucun fichier fourni',
        data: null,
      };
    }

    try {
      // Récupérer le buffer du fichier
      const pdfBuffer = file.buffer;

      // Utiliser la méthode analyzePdfWithLayoutLm directement
      const extractedText =
        await this.invoiceParserService.analyzePdfWithLayoutLm(pdfBuffer);

      // Extraire les données structurées à partir du texte
      const invoiceData =
        this.invoiceParserService.extractInvoiceData(extractedText);

      return {
        success: true,
        message: 'Analyse réussie',
        data: {
          text:
            extractedText.substring(0, 1000) +
            (extractedText.length > 1000 ? '...' : ''),
          extractedData: invoiceData,
        },
      };
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse de la facture:", error);
      return {
        success: false,
        message: `Erreur: ${error.message}`,
        data: null,
      };
    }
  }

  @Post('analyze-persistence-folder')
  async analyzeInvoicesFromPersistence() {
    this.logger.log('Analyse des factures du dossier persistence/Factures');

    try {
      // Vérifier si le dossier existe
      if (!fs.existsSync(this.persistencePath)) {
        return {
          success: false,
          message: "Le dossier persistence/Factures n'existe pas",
          processed: 0,
          failed: 0,
        };
      }

      // Lire tous les fichiers PDF du dossier
      const files = await fs.promises.readdir(this.persistencePath);
      const pdfFiles = files.filter((file) =>
        file.toLowerCase().endsWith('.pdf'),
      );

      if (pdfFiles.length === 0) {
        return {
          success: false,
          message: 'Aucun fichier PDF trouvé dans le dossier',
          processed: 0,
          failed: 0,
        };
      }

      this.logger.log(`${pdfFiles.length} fichiers PDF trouvés`);

      let processed = 0;
      let failed = 0;
      const processedInvoices: ProcessedInvoice[] = [];

      // Traiter chaque fichier PDF
      for (const pdfFile of pdfFiles) {
        try {
          const filePath = path.join(this.persistencePath, pdfFile);
          const pdfBuffer = await fs.promises.readFile(filePath);

          // 1. Analyse avec Tesseract OCR
          const tesseractText = await this.processPdfWithTesseract(pdfBuffer);

          // 2. Analyse avec Hugging Face
          const huggingFaceText =
            await this.invoiceParserService.analyzePdfWithLayoutLm(pdfBuffer);

          // 3. Enrichir le texte combiné pour une meilleure extraction
          // On combine les deux sources de texte pour une meilleure détection
          const combinedText = `${tesseractText}\n\n${huggingFaceText}`;

          // Extraire les données structurées à partir du texte combiné
          const invoiceData =
            this.invoiceParserService.extractInvoiceData(combinedText);

          // Si le numéro de facture n'est pas extrait, utiliser le nom du fichier
          const invoiceNumber =
            invoiceData.invoiceNumber || path.basename(pdfFile, '.pdf');

          // Créer le dossier pour cette facture dans extractPdf
          const supplierFolder = invoiceData.supplier
            ? this.sanitizeFolderName(invoiceData.supplier)
            : 'non-classifie';

          const rootPath = path.join(this.extractPdfPath, supplierFolder);
          const invoiceFolderPath = path.join(rootPath, invoiceNumber);

          // Créer les dossiers s'ils n'existent pas
          if (!fs.existsSync(rootPath)) {
            await fs.promises.mkdir(rootPath, { recursive: true });
          }

          if (!fs.existsSync(invoiceFolderPath)) {
            await fs.promises.mkdir(invoiceFolderPath, { recursive: true });
          }

          // Sauvegarder le PDF original
          await fs.promises.copyFile(
            filePath,
            path.join(invoiceFolderPath, `${invoiceNumber}.pdf`),
          );

          // Sauvegarder le texte extrait par Tesseract
          await fs.promises.writeFile(
            path.join(invoiceFolderPath, `${invoiceNumber}_tesseract.txt`),
            tesseractText,
          );

          // Sauvegarder le texte extrait par Hugging Face
          await fs.promises.writeFile(
            path.join(invoiceFolderPath, `${invoiceNumber}_huggingface.txt`),
            huggingFaceText,
          );

          // Sauvegarder le texte combiné
          await fs.promises.writeFile(
            path.join(invoiceFolderPath, `${invoiceNumber}_combined.txt`),
            combinedText,
          );

          // Sauvegarder les métadonnées
          await fs.promises.writeFile(
            path.join(invoiceFolderPath, `${invoiceNumber}_metadata.json`),
            JSON.stringify(invoiceData, null, 2),
          );

          processedInvoices.push({
            filename: pdfFile,
            invoiceNumber,
            supplier: invoiceData.supplier,
            amount: invoiceData.amount,
            date: invoiceData.date,
          });

          processed++;
          this.logger.log(`Traitement réussi pour ${pdfFile}`);
        } catch (error) {
          this.logger.error(`Erreur lors du traitement de ${pdfFile}:`, error);
          failed++;
        }
      }

      return {
        success: true,
        message: `Traitement terminé: ${processed} factures traitées, ${failed} échecs`,
        processed,
        failed,
        invoices: processedInvoices,
      };
    } catch (error) {
      this.logger.error('Erreur lors du traitement des factures:', error);
      return {
        success: false,
        message: `Erreur: ${error.message}`,
        processed: 0,
        failed: 0,
      };
    }
  }

  private async processPdfWithTesseract(pdfBuffer: Buffer): Promise<string> {
    try {
      // Créer un fichier temporaire pour le traitement OCR
      const tempDir = path.join('/app', 'temp');
      if (!fs.existsSync(tempDir)) {
        await fs.promises.mkdir(tempDir, { recursive: true });
      }

      const tempPdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
      await fs.promises.writeFile(tempPdfPath, pdfBuffer);

      this.logger.log('Analyse OCR avec Tesseract');

      try {
        // Exécuter Tesseract OCR directement sur le PDF
        const tesseractConfig = {
          lang: 'fra+eng', // Français et anglais
          oem: 1, // Mode OCR Engine - utilise LSTM uniquement
          psm: 3, // Page Segmentation Mode - segmentation automatique de page
        };

        const text = await tesseract.recognize(tempPdfPath, tesseractConfig);

        // Nettoyer les fichiers temporaires
        await fs.promises.unlink(tempPdfPath);

        return text;
      } catch (tesseractError) {
        this.logger.error(
          'Erreur avec Tesseract, tentative avec extraction de texte basique:',
          tesseractError,
        );

        // En cas d'échec, utiliser pdf-parse comme solution de repli
        const dataBuffer = fs.readFileSync(tempPdfPath);
        const pdfData = await pdfParse(dataBuffer);

        // Nettoyer les fichiers temporaires
        await fs.promises.unlink(tempPdfPath);

        return pdfData.text || "Échec de l'extraction de texte";
      }
    } catch (error) {
      this.logger.error('Erreur lors du traitement OCR:', error);
      return "Erreur lors de l'extraction du texte via OCR";
    }
  }

  private sanitizeFolderName(name: string): string {
    // Remplacer les caractères non sûrs pour les noms de dossiers
    return name
      .replace(/[\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 50); // Limiter la longueur
  }
}
