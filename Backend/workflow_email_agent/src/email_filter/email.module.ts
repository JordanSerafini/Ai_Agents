import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailFilterService } from './email-filter.service';
import { EmailController } from './email.controller';

@Module({
  imports: [ConfigModule],
  providers: [EmailFilterService],
  controllers: [EmailController],
  exports: [EmailFilterService],
})
export class EmailModule {}
