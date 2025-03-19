import { Module, forwardRef } from '@nestjs/common';
import { RagValidatorService } from './rag-validator.service';
import { RagValidatorController } from './rag-validator.controller';
import { HuggingFaceModule } from '../huggingface/huggingface.module';
import { RagModule } from '../RAG/rag.module';
import { ConfigModule } from '@nestjs/config';
import { RapportModule } from '../rapport/rapport.module';

@Module({
  imports: [
    ConfigModule,
    HuggingFaceModule,
    RagModule,
    forwardRef(() => RapportModule),
  ],
  controllers: [RagValidatorController],
  providers: [RagValidatorService],
  exports: [RagValidatorService],
})
export class RagValidatorModule {}
