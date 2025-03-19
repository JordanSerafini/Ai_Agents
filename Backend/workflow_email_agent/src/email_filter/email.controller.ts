import { Controller, Post, Get } from '@nestjs/common';
import { EmailFilterService } from './email-filter.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailFilterService: EmailFilterService) {}

  @Get('load')
  async loadEmails() {
    const result = await this.emailFilterService.loadEmails();
    return {
      message: `Chargement des emails terminé`,
      total: result.total,
      emails: result.emails,
    };
  }

  @Post('filter-unsubscribe')
  async filterEmails() {
    const result = await this.emailFilterService.filterAndDeleteEmails();
    return {
      message: 'Filtrage et suppression des emails terminé',
      deleted: result.deleted,
    };
  }
}
