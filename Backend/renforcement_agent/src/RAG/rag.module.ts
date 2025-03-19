import { Module, forwardRef } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { HuggingFaceModule } from '../huggingface/huggingface.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [forwardRef(() => HuggingFaceModule), ConfigModule],
  providers: [RagService],
  controllers: [RagController],
  exports: [RagService],
})
export class RagModule {}
