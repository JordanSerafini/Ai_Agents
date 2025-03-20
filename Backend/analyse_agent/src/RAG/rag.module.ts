import { Module, forwardRef } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { HuggingFaceModule } from '../huggingface/huggingface.module';
import { SqlQueriesModule } from '../sql-queries/sql-queries.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => HuggingFaceModule),
    SqlQueriesModule,
  ],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
