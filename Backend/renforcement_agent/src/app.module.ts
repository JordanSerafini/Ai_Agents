import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HuggingFaceModule } from './huggingface/huggingface.module';
import { RagModule } from './RAG/rag.module';
import { RagValidatorModule } from './rag-validator/rag-validator.module';
import { RapportModule } from './rapport/rapport.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HuggingFaceModule,
    RagModule,
    RagValidatorModule,
    RapportModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
