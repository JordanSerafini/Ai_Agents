import { Module } from '@nestjs/common';
import { RagValidatorService } from './rag-validator.service';
import { RagValidatorController } from './rag-validator.controller';
import { HuggingFaceModule } from '../huggingface/huggingface.module';
import { RagModule } from '../RAG/rag.module';

@Module({
  imports: [HuggingFaceModule, RagModule],
  controllers: [RagValidatorController],
  providers: [RagValidatorService],
  exports: [RagValidatorService],
})
export class RagValidatorModule {}
