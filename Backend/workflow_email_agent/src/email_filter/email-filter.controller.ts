import { Controller, Post, Param, ParseIntPipe } from '@nestjs/common';
import { EmailFilterService } from './email-filter.service';

@Controller('email')
export class EmailFilterController {
  constructor(private readonly emailFilterService: EmailFilterService) {}

  @Post('test/:uid')
  async testDeleteEmail(@Param('uid', ParseIntPipe) uid: number) {
    const success = await this.emailFilterService.testDeleteSingleEmail(uid);
    return { success, uid };
  }
} 