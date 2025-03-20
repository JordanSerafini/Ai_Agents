import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from './email_filter/email.module';
import { EmailSortModule } from './email_sort/email-sort.module';
import { InvoiceParserModule } from './invoice_parser/invoice_parser.module';
import { HuggingFaceModule } from './hugging_face/hugging-face.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EmailModule,
    EmailSortModule,
    InvoiceParserModule,
    HuggingFaceModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
