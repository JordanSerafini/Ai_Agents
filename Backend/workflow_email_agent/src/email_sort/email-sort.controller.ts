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
      // Paramètres pour une exécution par lots
      const maxMessages = params?.maxMessages || 50;
      const startIndex = params?.startIndex || 0;

      this.logger.log(
        `Vérification des factures (index: ${startIndex}, max: ${maxMessages} messages)`,
      );

      const result = await this.emailSortService.checkForInvoices(
        maxMessages,
        startIndex,
      );
      await this.emailSortService.disconnect();

      return {
        success: true,
        message: `Vérification terminée. ${result.invoicesFound} factures trouvées et déplacées sur ${result.total} emails analysés.`,
        factures: result.invoicesFound,
        total: result.total,
        nextIndex: startIndex + result.total,
        remaining: result.remaining,
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
