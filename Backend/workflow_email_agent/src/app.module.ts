import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from './email_filter/email.module';
import { EmailSortModule } from './email_sort/email-sort.module';
import { ModelService } from './models_services/models.service';
import { AnalyseInvoiceController } from './models_services/analyse_invoice.controller';
import { MistralController } from './models_services/mistral.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EmailModule,
    EmailSortModule,
  ],
  controllers: [AnalyseInvoiceController, MistralController],
  providers: [ModelService],
})
export class AppModule {}
