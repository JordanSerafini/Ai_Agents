import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from './email_filter/email.module';
import { EmailSortModule } from './email_sort/email-sort.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EmailModule,
    EmailSortModule,
  ],
})
export class AppModule {}
