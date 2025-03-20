import { Module } from '@nestjs/common';
import { InvoiceParserController } from './invoice_parser.controller';
import { InvoiceParserService } from './invoice_parser.service';
import { ConfigModule } from '@nestjs/config';
import { EmailSortService } from '../email_sort/email-sort.service';
import { EmailSortModule } from '../email_sort/email-sort.module';
import { HuggingFaceModule } from '../hugging_face/hugging-face.module';

@Module({
  imports: [ConfigModule, EmailSortModule, HuggingFaceModule],
  controllers: [InvoiceParserController],
  providers: [InvoiceParserService, EmailSortService],
  exports: [InvoiceParserService],
})
export class InvoiceParserModule {}
