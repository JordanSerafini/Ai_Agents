import { Module, forwardRef } from '@nestjs/common';
import { HuggingFaceService } from './huggingface.service';
import { ConfigModule } from '@nestjs/config';
import { RagModule } from '../RAG/rag.module';

@Module({
  imports: [ConfigModule, forwardRef(() => RagModule)],
  controllers: [],
  providers: [HuggingFaceService],
  exports: [HuggingFaceService],
})
export class HuggingFaceModule {}
