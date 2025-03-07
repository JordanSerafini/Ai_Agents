import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DocumentModule } from './document/document.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DocumentModule,
    RagModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
