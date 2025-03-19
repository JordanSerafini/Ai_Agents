import { Module, forwardRef } from '@nestjs/common';
import { HuggingFaceService } from './huggingface.service';
import { HuggingFaceController } from './huggingface.controller';
import { ConfigModule } from '@nestjs/config';
import { RagModule } from '../RAG/rag.module';

@Module({
  imports: [ConfigModule, forwardRef(() => RagModule)],
  controllers: [HuggingFaceController],
  providers: [HuggingFaceService],
  exports: [HuggingFaceService],
})
export class HuggingFaceModule {}
