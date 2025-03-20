import { Controller, Post, Body, Logger } from '@nestjs/common';
import { EmailSortService } from './email-sort.service';

@Controller('email-sort')
export class EmailSortController {
  private readonly logger = new Logger(EmailSortController.name);

  constructor(private readonly emailSortService: EmailSortService) {}

  //* ---------------------------------------------------------------------------------------------------------- Vérification des factures et déplacement vers le dossier "Factures"
  @Post('check-invoices')
  async checkInvoices(@Body() params?: any) {
    this.logger.log('Démarrage de la vérification des factures');

    try {
      // Utiliser la valeur du paramètre maxMessages ou 50 par défaut
      const maxMessages = params?.maxMessages || 50;

      this.logger.log(
        `Vérification des factures (max: ${maxMessages} messages)`,
      );

      await this.emailSortService.checkForInvoices(maxMessages);
      await this.emailSortService.disconnect();

      return {
        success: true,
        message: 'Vérification des factures terminée avec succès',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification des factures: ${error.message}`,
      );
      await this.emailSortService.disconnect();
      return { success: false, message: error.message };
    }
  }
}
