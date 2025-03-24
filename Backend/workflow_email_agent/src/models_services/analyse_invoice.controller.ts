import {
  Controller,
  Post,
  Logger,
  HttpException,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { ModelService } from './models.service';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { createWorker } from 'tesseract.js';
import { ConfigService } from '@nestjs/config';
import { HfInference } from '@huggingface/inference';

interface InvoiceAnalysisResult {
  invoiceId: string;
  originalPath: string;
  ocrResults: string;
  donutResults: any;
  combinedResults: any;
  processingTime: number;
  success: boolean;
}

@Controller('analyse-invoice')
export class AnalyseInvoiceController {
  private readonly logger = new Logger(AnalyseInvoiceController.name);
  private readonly facturesPath: string;
  private readonly outputPath: string;
  private readonly huggingFaceToken?: string;
  private readonly hfModel?: HfInference;
  private readonly invoiceModel = 'selvakumarcts/sk_invoice_receipts';

  constructor(
    private readonly modelService: ModelService,
    private readonly configService: ConfigService,
  ) {
    // Initialiser les chemins
    const basePath = path.join(process.cwd(), 'persistence');
    this.facturesPath = path.join(basePath, 'Factures');
    this.outputPath = path.join(basePath, 'FacturesAnalysees');

    // Créer les répertoires si nécessaires
    fsExtra.ensureDirSync(this.facturesPath);
    fsExtra.ensureDirSync(this.outputPath);

    // Initialiser HuggingFace
    this.huggingFaceToken =
      this.configService.get<string>('HUGGING_FACE_TOKEN');
    if (this.huggingFaceToken) {
      this.hfModel = new HfInference(this.huggingFaceToken);
      this.logger.log(
        'Service HuggingFace pour analyse de factures initialisé',
      );
    } else {
      this.logger.warn('Token HuggingFace manquant - Analyse Donut désactivée');
    }
  }

  @Get('status')
  getStatus() {
    try {
      // Lister les fichiers dans le répertoire Factures
      const files = fs.readdirSync(this.facturesPath).filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.pdf' || ext === '.png';
      });

      // Lister les fichiers déjà traités
      const processedFiles = fs.existsSync(this.outputPath)
        ? fs
            .readdirSync(this.outputPath)
            .filter((dir) =>
              fs.statSync(path.join(this.outputPath, dir)).isDirectory(),
            )
        : [];

      return {
        status: 'ok',
        facturesDirectory: this.facturesPath,
        outputDirectory: this.outputPath,
        pendingFiles: files.length,
        processedFiles: processedFiles.length,
        huggingFaceEnabled: !!this.huggingFaceToken,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification du statut: ${error.message}`,
      );
      throw new HttpException(
        `Erreur lors de la vérification: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('process-all')
  async processAllInvoices() {
    this.logger.log('Début de traitement de toutes les factures');

    try {
      // Vérifier si le répertoire Factures existe
      if (!fs.existsSync(this.facturesPath)) {
        throw new Error(`Répertoire ${this.facturesPath} non trouvé`);
      }

      // Lire tous les fichiers PDF et PNG dans le répertoire
      const files = fs.readdirSync(this.facturesPath).filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.png';
      });

      if (files.length === 0) {
        return {
          success: true,
          message: 'Aucun fichier PNG trouvé dans le répertoire Factures',
          processed: 0,
        };
      }

      this.logger.log(
        `${files.length} fichiers trouvés dans ${this.facturesPath}`,
      );

      // Traiter les fichiers
      const results: InvoiceAnalysisResult[] = [];
      for (const file of files) {
        try {
          const fileExt = path.extname(file).toLowerCase();
          const invoiceId = path.basename(file, fileExt);
          const filePath = path.join(this.facturesPath, file);

          this.logger.log(`Traitement de la facture ${invoiceId}`);

          const startTime = Date.now();

          // Créer un répertoire pour les résultats de cette facture
          const invoiceOutputDir = path.join(this.outputPath, invoiceId);
          fsExtra.ensureDirSync(invoiceOutputDir);

          // 1. Lire le fichier
          const fileBuffer = fs.readFileSync(filePath);

          // 2. Effectuer OCR avec Tesseract
          const ocrResults = await this.performOcr(
            fileBuffer,
            invoiceOutputDir,
            fileExt === '.pdf',
          );

          // 3. Effectuer analyse Donut via HuggingFace
          const donutResults = this.huggingFaceToken
            ? await this.performDonutAnalysis(fileBuffer)
            : { error: 'HuggingFace non configuré' };

          // 4. Effectuer analyse combinée avec Mistral
          const combinedResults =
            await this.modelService.analyzeInvoiceCombined(
              ocrResults.text || '',
              donutResults,
              fileBuffer.toString('base64').substring(0, 1000), // Limiter la taille
            );

          // 5. Sauvegarder les résultats
          this.saveResults(
            invoiceOutputDir,
            invoiceId,
            ocrResults,
            donutResults,
            combinedResults,
          );

          const processingTime = Date.now() - startTime;

          // Ajouter aux résultats
          results.push({
            invoiceId,
            originalPath: filePath,
            ocrResults: ocrResults.text || '',
            donutResults,
            combinedResults,
            processingTime,
            success: true,
          });

          this.logger.log(
            `Facture ${invoiceId} traitée en ${processingTime}ms`,
          );
        } catch (error) {
          this.logger.error(
            `Erreur lors du traitement de ${file}: ${error.message}`,
          );
          results.push({
            invoiceId: path.basename(file, '.pdf'),
            originalPath: path.join(this.facturesPath, file),
            ocrResults: '',
            donutResults: null,
            combinedResults: null,
            processingTime: 0,
            success: false,
          });
        }
      }

      // Résumé des résultats
      const successful = results.filter((r) => r.success).length;
      const failed = results.length - successful;

      return {
        success: true,
        message: `Traitement terminé: ${successful} factures traitées avec succès, ${failed} échecs`,
        processed: results.length,
        successful,
        failed,
        results: results.map((r) => ({
          invoiceId: r.invoiceId,
          success: r.success,
          processingTime: r.processingTime,
          confidence: r.combinedResults?.note || 0,
        })),
      };
    } catch (error) {
      this.logger.error(`Erreur globale: ${error.message}`);
      throw new HttpException(
        `Erreur lors du traitement des factures: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Réalise l'OCR sur un buffer PDF ou image
   */
  private async performOcr(
    fileBuffer: Buffer,
    outputDir: string,
    isPdf: boolean,
  ): Promise<{ text: string; pages: any[] }> {
    try {
      this.logger.log('Début OCR avec Tesseract');

      // Créer un worker Tesseract
      const worker = await createWorker('fra');

      // Si c'est un PDF, on affiche un avertissement car Tesseract ne traite pas directement les PDF
      // Dans une implémentation complète, il faudrait convertir le PDF en images
      if (isPdf) {
        this.logger.warn(
          'Le traitement direct des PDF avec Tesseract peut ne pas fonctionner. Utilisation de la première page uniquement.',
        );
      }

      // Traitement OCR de l'image (ou tentative sur le PDF)
      const result = await worker.recognize(fileBuffer);

      // Sauvegarder les résultats OCR
      fs.writeFileSync(
        path.join(outputDir, 'ocr_results.txt'),
        result.data.text,
      );

      // Terminer le worker
      await worker.terminate();

      return {
        text: result.data.text,
        pages: [result.data],
      };
    } catch (error) {
      this.logger.error(`Erreur OCR: ${error.message}`);
      return { text: '', pages: [] };
    }
  }

  /**
   * Réalise l'analyse Donut via Hugging Face
   */
  private async performDonutAnalysis(fileBuffer: Buffer): Promise<any> {
    try {
      this.logger.log('Début analyse Donut via HuggingFace');

      if (!this.hfModel) {
        throw new Error('Modèle HuggingFace non initialisé');
      }

      // Appeler l'API HuggingFace avec le modèle d'analyse de factures
      const response = await this.hfModel.documentQuestionAnswering({
        model: this.invoiceModel,
        inputs: {
          question: 'Extract all information from this invoice',
          image: fileBuffer, // Passer directement le buffer sans conversion
        },
      });

      return response;
    } catch (error) {
      this.logger.error(`Erreur analyse Donut: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * Sauvegarde les résultats d'analyse
   */
  private saveResults(
    outputDir: string,
    invoiceId: string,
    ocrResults: any,
    donutResults: any,
    combinedResults: any,
  ): void {
    try {
      // Sauvegarder les résultats OCR (déjà fait dans performOcr)

      // Sauvegarder les résultats Donut
      fs.writeFileSync(
        path.join(outputDir, 'donut_results.json'),
        JSON.stringify(donutResults, null, 2),
      );

      // Sauvegarder les résultats combinés
      fs.writeFileSync(
        path.join(outputDir, 'combined_results.json'),
        JSON.stringify(combinedResults, null, 2),
      );

      // Sauvegarder un résumé au format CSV
      if (combinedResults && combinedResults.analyse_csv) {
        const csv = this.generateCsv(invoiceId, combinedResults.analyse_csv);
        fs.writeFileSync(path.join(outputDir, `${invoiceId}.csv`), csv);
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la sauvegarde des résultats: ${error.message}`,
      );
    }
  }

  /**
   * Génère un CSV à partir des données d'analyse
   */
  private generateCsv(invoiceId: string, data: any): string {
    try {
      // En-tête du CSV
      let csv =
        'Invoice ID,Client,Date Facturation,Montant HT,Montant TTC,IBAN,BIC\n';

      // Ligne principale
      csv += `"${invoiceId}","${data.nom_du_client || ''}","${data.date_de_facturation || ''}","${data.montant_total_ht || ''}","${data.montant_total_ttc || ''}","${data.Iban || ''}","${data.BIC || ''}"\n\n`;

      // En-tête des lignes
      csv += 'Désignation,Quantité,Prix Unitaire HT,Prix Unitaire TTC\n';

      // Lignes de facture
      if (data.lignes_de_factures && Array.isArray(data.lignes_de_factures)) {
        data.lignes_de_factures.forEach((ligne) => {
          csv += `"${ligne.designation || ''}","${ligne.quantite || ''}","${ligne.prix_unitaire_ht || ''}","${ligne.prix_unitaire_ttc || ''}"\n`;
        });
      }

      return csv;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération du CSV: ${error.message}`,
      );
      return '';
    }
  }
}
