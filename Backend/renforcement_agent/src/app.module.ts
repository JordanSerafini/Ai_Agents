import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HuggingFaceModule } from './huggingface/huggingface.module';
import { RagModule } from './RAG/rag.module';
import { RagValidatorModule } from './rag-validator/rag-validator.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    HuggingFaceModule,
    RagModule,
    RagValidatorModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
