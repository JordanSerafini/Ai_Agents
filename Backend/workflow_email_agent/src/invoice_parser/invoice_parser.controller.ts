import {
  Controller,
  Post,
  Get,
  Param,
  Logger,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoiceParserService } from './invoice_parser.service';
import * as fs from 'fs';
import * as path from 'path';
import * as tesseract from 'node-tesseract-ocr';
import * as pdfParse from 'pdf-parse';
import { exec } from 'child_process';

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
  private readonly toAnalysePath: string;

  constructor(private readonly invoiceParserService: InvoiceParserService) {
    this.extractPdfPath = path.join('/app', 'extractPdf');
    this.persistencePath = path.join('/app', 'persistence', 'Factures');
    this.toAnalysePath = path.join('/app', 'persistence', 'toAnalyse');
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

      // Créer le dossier toAnalyse s'il n'existe pas
      if (!fs.existsSync(this.toAnalysePath)) {
        await fs.promises.mkdir(this.toAnalysePath, { recursive: true });
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

          // Sauvegarder aussi le texte combiné dans toAnalyse
          await fs.promises.writeFile(
            path.join(this.toAnalysePath, `${invoiceNumber}_combined.txt`),
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

  @Post('analyze-with-ai')
  @UseInterceptors(FileInterceptor('file'))
  async analyzeWithCombinedApproach(
    @UploadedFile() file,
    @Param('includePdf') includePdf: boolean = false,
  ) {
    this.logger.log(
      'Analyse de facture avec approche combinée (OCR + Donut + Mistral)',
    );

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

      // Utiliser la nouvelle méthode d'analyse combinée
      const result = await this.invoiceParserService.analyzeInvoiceFile(
        pdfBuffer,
        includePdf,
      );

      return {
        success: result.success,
        message: result.success
          ? 'Analyse réussie'
          : 'Analyse partielle (certaines données manquantes)',
        data: {
          supplier: result.result.supplier,
          address: {
            full: result.result.supplierAddress,
            zipCode: result.result.supplierZipCode,
            city: result.result.supplierCity,
          },
          lineItems: result.result.lineItems,
          totals: {
            ht: result.result.totalHT,
            tva: result.result.totalTVA,
            ttc: result.result.totalTTC,
          },
          paymentInfo: result.result.paymentInfo,
          confidence: result.result.confidence,
        },
      };
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'analyse avancée de la facture:",
        error,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
        data: null,
      };
    }
  }

  @Post('analyze-file')
  async analyzeSpecificFile(
    @Param('filePath') filePath: string,
    @Param('includePdf') includePdf: boolean = false,
  ) {
    this.logger.log(`Analyse du fichier spécifique: ${filePath}`);

    try {
      // Vérifier si le fichier existe
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: `Le fichier ${filePath} n'existe pas`,
          data: null,
        };
      }

      // Lire le fichier PDF
      const pdfBuffer = await fs.promises.readFile(filePath);

      // Utiliser la méthode d'analyse combinée
      const result = await this.invoiceParserService.analyzeInvoiceFile(
        pdfBuffer,
        includePdf,
      );

      return {
        success: result.success,
        message: result.success
          ? 'Analyse réussie'
          : 'Analyse partielle (certaines données manquantes)',
        data: {
          supplier: result.result.supplier,
          address: {
            full: result.result.supplierAddress,
            zipCode: result.result.supplierZipCode,
            city: result.result.supplierCity,
          },
          lineItems: result.result.lineItems,
          totals: {
            ht: result.result.totalHT,
            tva: result.result.totalTVA,
            ttc: result.result.totalTTC,
          },
          paymentInfo: result.result.paymentInfo,
          confidence: result.result.confidence,
        },
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse du fichier ${filePath}:`,
        error,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
        data: null,
      };
    }
  }

  @Post('parse-with-donut')
  @UseInterceptors(FileInterceptor('file'))
  async parseInvoiceWithDonut(@UploadedFile() file) {
    if (!file) {
      throw new BadRequestException("Fichier d'invoice manquant");
    }
    return this.invoiceParserService.parseInvoiceWithDonut(file.buffer);
  }

  private async processPdfWithTesseract(pdfBuffer: Buffer): Promise<string> {
    try {
      // Créer un fichier temporaire pour le traitement OCR
      const tempDir = path.join('/app', 'temp');
      if (!fs.existsSync(tempDir)) {
        await fs.promises.mkdir(tempDir, { recursive: true });
      }

      const tempPdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
      const tempImagePath = path.join(tempDir, `temp_${Date.now()}.png`);

      await fs.promises.writeFile(tempPdfPath, pdfBuffer);

      this.logger.log('Conversion du PDF en image avant OCR');

      try {
        // Utiliser pdftoppm (de poppler-utils) pour convertir la première page du PDF en image
        return new Promise<string>((resolve) => {
          // Convertir la première page du PDF en image PNG
          const convertCmd = `pdftoppm -f 1 -l 1 -png -singlefile -r 300 ${tempPdfPath} ${tempImagePath.replace('.png', '')}`;

          exec(convertCmd, (error) => {
            if (error) {
              this.logger.error(
                'Erreur lors de la conversion PDF en image:',
                error,
              );
              // En cas d'échec, passer à la méthode de repli
              pdfParse(pdfBuffer)
                .then((pdfData) => {
                  // Nettoyer les fichiers temporaires
                  void fs.promises.unlink(tempPdfPath).finally(() => {
                    resolve(pdfData.text || "Échec de l'extraction de texte");
                  });
                })
                .catch((fallbackError) => {
                  this.logger.error(
                    "Erreur lors de l'extraction de texte de secours:",
                    fallbackError,
                  );
                  resolve("Échec de l'extraction de texte");
                });
              return;
            }

            // Le chemin de l'image générée
            const generatedImagePath = `${tempImagePath.replace('.png', '')}.png`;

            // Exécuter Tesseract OCR sur l'image
            const tesseractConfig = {
              lang: 'fra+eng', // Français et anglais
              oem: 1, // Mode OCR Engine - utilise LSTM uniquement
              psm: 3, // Page Segmentation Mode - segmentation automatique de page
            };

            this.logger.log("Analyse OCR de l'image avec Tesseract");
            tesseract
              .recognize(generatedImagePath, tesseractConfig)
              .then((text) => {
                // Nettoyer les fichiers temporaires
                void Promise.all([
                  fs.promises.unlink(tempPdfPath),
                  fs.promises.unlink(generatedImagePath),
                ]).finally(() => {
                  resolve(text);
                });
              })
              .catch((tesseractError) => {
                this.logger.error(
                  'Erreur avec Tesseract, tentative avec extraction de texte basique:',
                  tesseractError,
                );

                // En cas d'échec, utiliser pdf-parse comme solution de repli
                pdfParse(pdfBuffer)
                  .then((pdfData) => {
                    // Nettoyer les fichiers temporaires
                    void Promise.all([
                      fs.promises.unlink(tempPdfPath),
                      fs.existsSync(generatedImagePath)
                        ? fs.promises.unlink(generatedImagePath)
                        : Promise.resolve(),
                    ]).finally(() => {
                      resolve(pdfData.text || "Échec de l'extraction de texte");
                    });
                  })
                  .catch((fallbackError) => {
                    this.logger.error(
                      "Erreur lors de l'extraction de texte de secours:",
                      fallbackError,
                    );
                    resolve("Échec de l'extraction de texte");
                  });
              });
          });
        });
      } catch (conversionError) {
        this.logger.error(
          "Erreur lors de la conversion ou de l'OCR:",
          conversionError,
        );

        // En cas d'échec, utiliser pdf-parse comme solution de repli
        const pdfData = await pdfParse(pdfBuffer);

        // Nettoyer les fichiers temporaires si possible
        if (fs.existsSync(tempPdfPath)) {
          await fs.promises.unlink(tempPdfPath);
        }

        return pdfData.text || "Échec de l'extraction de texte";
      }
    } catch (error) {
      this.logger.error('Erreur générale lors du traitement OCR:', error);
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

  /**
   * Endpoint pour analyser les factures avec OCR et LayoutLM et les stocker dans toAnalyse
   */
  @Post('analyze-combined-step1')
  async analyzeInvoicesStep1() {
    this.logger.log(
      'Étape 1: Analyse des factures avec OCR et LayoutLM (impira/layoutlm-invoices)',
    );

    try {
      // Vérifier si le dossier Factures existe
      if (!fs.existsSync(this.persistencePath)) {
        return {
          success: false,
          message: "Le dossier persistence/Factures n'existe pas",
          processed: 0,
          failed: 0,
        };
      }

      // Créer le dossier toAnalyse s'il n'existe pas
      if (!fs.existsSync(this.toAnalysePath)) {
        await fs.promises.mkdir(this.toAnalysePath, { recursive: true });
      }

      // Lire tous les fichiers PDF du dossier Factures
      const files = await fs.promises.readdir(this.persistencePath);
      const pdfFiles = files.filter((file) =>
        file.toLowerCase().endsWith('.pdf'),
      );

      if (pdfFiles.length === 0) {
        return {
          success: false,
          message: 'Aucun fichier PDF trouvé dans le dossier Factures',
          processed: 0,
          failed: 0,
        };
      }

      this.logger.log(`${pdfFiles.length} fichiers PDF trouvés dans Factures`);

      let processedCount = 0;
      let failedCount = 0;
      const processedInvoices: {
        invoiceNumber: string;
        originalFile: string;
        folderPath: string;
      }[] = [];

      // Traiter chaque fichier PDF
      for (const pdfFile of pdfFiles) {
        try {
          const filePath = path.join(this.persistencePath, pdfFile);
          const pdfBuffer = await fs.promises.readFile(filePath);

          // Générer un numéro de facture basé sur le compteur
          const invoiceNumber = `facture_${processedCount + 1}`;

          // Créer un sous-dossier dans toAnalyse pour cette facture
          const invoiceFolderPath = path.join(
            this.toAnalysePath,
            invoiceNumber,
          );
          if (!fs.existsSync(invoiceFolderPath)) {
            await fs.promises.mkdir(invoiceFolderPath, { recursive: true });
          }

          // 1. Analyser avec Tesseract OCR
          const ocrText = await this.processPdfWithTesseract(pdfBuffer);
          await fs.promises.writeFile(
            path.join(invoiceFolderPath, `${invoiceNumber}_ocr.txt`),
            ocrText,
          );

          // 2. Analyser avec LayoutLM via HuggingFace
          const layoutLMResult =
            await this.invoiceParserService.analyzeWithDonutModel(pdfBuffer);
          await fs.promises.writeFile(
            path.join(invoiceFolderPath, `${invoiceNumber}_layoutlm.json`),
            JSON.stringify(layoutLMResult, null, 2),
          );

          // 3. Extraire le numéro de facture, la date et le fournisseur si possible
          const extractedInvoiceNo = layoutLMResult?.header?.invoice_no || null;
          const extractedDate = layoutLMResult?.header?.invoice_date || null;
          const extractedSupplier = layoutLMResult?.header?.seller || null;
          const extractedTotal =
            layoutLMResult?.summary?.total_gross_worth || null;

          // 4. Combiner les résultats
          const combinedData = {
            ocr: ocrText,
            layoutlm: layoutLMResult,
            extracted: {
              invoiceNumber: extractedInvoiceNo,
              date: extractedDate,
              supplier: extractedSupplier,
              total: extractedTotal,
            },
            filename: pdfFile,
          };

          await fs.promises.writeFile(
            path.join(invoiceFolderPath, `${invoiceNumber}_combined.json`),
            JSON.stringify(combinedData, null, 2),
          );

          // 5. Copier le PDF original
          await fs.promises.copyFile(
            filePath,
            path.join(invoiceFolderPath, `${invoiceNumber}.pdf`),
          );

          processedInvoices.push({
            invoiceNumber: extractedInvoiceNo || invoiceNumber,
            originalFile: pdfFile,
            folderPath: invoiceFolderPath,
          });

          processedCount++;
          this.logger.log(
            `Analyse initiale réussie pour ${pdfFile} -> ${invoiceNumber}`,
          );
        } catch (error) {
          this.logger.error(
            `Erreur lors de l'analyse initiale de ${pdfFile}:`,
            error,
          );
          failedCount++;
        }
      }

      return {
        success: true,
        message: `Étape 1 terminée: ${processedCount} factures analysées, ${failedCount} échecs`,
        processed: processedCount,
        failed: failedCount,
        invoices: processedInvoices,
      };
    } catch (error) {
      this.logger.error("Erreur lors de l'étape 1:", error);
      return {
        success: false,
        message: `Erreur: ${error.message}`,
        processed: 0,
        failed: 0,
      };
    }
  }

  /**
   * Endpoint pour l'analyse finale avec Mistral et génération du CSV
   */
  @Post('analyze-combined-step2')
  async analyzeInvoicesStep2() {
    this.logger.log('Étape 2: Analyse finale avec Mistral et génération CSV');

    try {
      // Vérifier si le dossier toAnalyse existe
      if (!fs.existsSync(this.toAnalysePath)) {
        return {
          success: false,
          message: "Le dossier toAnalyse n'existe pas",
          processed: 0,
          failed: 0,
          csvPath: null,
        };
      }

      // Lister tous les sous-dossiers (factures) dans toAnalyse
      const invoiceFolders = await fs.promises.readdir(this.toAnalysePath, {
        withFileTypes: true,
      });
      const folders = invoiceFolders
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      if (folders.length === 0) {
        return {
          success: false,
          message: 'Aucun dossier de facture trouvé dans toAnalyse',
          processed: 0,
          failed: 0,
          csvPath: null,
        };
      }

      this.logger.log(
        `${folders.length} dossiers de factures trouvés dans toAnalyse`,
      );

      let processedCount = 0;
      let failedCount = 0;
      const finalResults: {
        invoiceNumber: string;
        originalFile: string;
        supplier: string;
        totalHT: number;
        totalTVA: number;
        totalTTC: number;
        date: string;
        confidence: number;
        lineItemsCount: number;
      }[] = [];

      // Traiter chaque dossier de facture
      for (const folder of folders) {
        try {
          const folderPath = path.join(this.toAnalysePath, folder);

          // Rechercher les fichiers dans le dossier
          const files = await fs.promises.readdir(folderPath);
          const pdfFile = files.find((f) => f.endsWith('.pdf'));
          const combinedFile = files.find((f) => f.endsWith('_combined.json'));

          if (!pdfFile || !combinedFile) {
            this.logger.warn(`Dossier ${folder} incomplet, fichiers manquants`);
            failedCount++;
            continue;
          }

          // Charger les données combinées
          const combinedData = JSON.parse(
            await fs.promises.readFile(
              path.join(folderPath, combinedFile),
              'utf8',
            ),
          );

          // Charger le PDF
          const pdfBuffer = await fs.promises.readFile(
            path.join(folderPath, pdfFile),
          );

          // Analyser avec Mistral
          const mistralResult =
            await this.invoiceParserService.analyzeInvoiceFile(
              pdfBuffer,
              true, // Inclure le PDF dans l'analyse
            );

          // Sauvegarder le résultat final
          await fs.promises.writeFile(
            path.join(folderPath, `${folder}_final.json`),
            JSON.stringify(mistralResult, null, 2),
          );

          // Ajouter les résultats pour le CSV
          finalResults.push({
            invoiceNumber: folder,
            originalFile: combinedData.filename || 'inconnu',
            supplier: mistralResult.result.supplier || 'Non trouvé',
            totalHT: mistralResult.result.totalHT || 0,
            totalTVA: mistralResult.result.totalTVA || 0,
            totalTTC: mistralResult.result.totalTTC || 0,
            date: mistralResult.result.paymentInfo?.dueDate || 'non trouvé',
            confidence: mistralResult.result.confidence || 0,
            lineItemsCount: mistralResult.result.lineItems?.length || 0,
          });

          processedCount++;
          this.logger.log(`Analyse finale réussie pour ${folder}`);
        } catch (error) {
          this.logger.error(
            `Erreur lors de l'analyse finale de ${folder}:`,
            error,
          );
          failedCount++;
        }
      }

      // Générer le CSV
      const csvPath = path.join(this.toAnalysePath, 'resultats_factures.csv');
      let csvContent =
        'Numéro de facture;Fichier original;Fournisseur;Total HT;Total TVA;Total TTC;Date;Confiance;Nombre de lignes\n';

      for (const result of finalResults) {
        csvContent += `${result.invoiceNumber};${result.originalFile};${result.supplier};${result.totalHT};${result.totalTVA};${result.totalTTC};${result.date};${result.confidence};${result.lineItemsCount}\n`;
      }

      await fs.promises.writeFile(csvPath, csvContent);

      return {
        success: true,
        message: `Étape 2 terminée: ${processedCount} factures analysées, ${failedCount} échecs`,
        processed: processedCount,
        failed: failedCount,
        csvPath,
        results: finalResults,
      };
    } catch (error) {
      this.logger.error("Erreur lors de l'étape 2:", error);
      return {
        success: false,
        message: `Erreur: ${error.message}`,
        processed: 0,
        failed: 0,
        csvPath: null,
      };
    }
  }
}
