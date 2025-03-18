import { Module } from '@nestjs/common';
import { HuggingFaceService } from './huggingface.service';
import { HuggingFaceController } from './huggingface.controller';
import { ConfigModule } from '@nestjs/config';
import { RagModule } from '../RAG/rag.module';
import { SqlQueriesModule } from '../sql-queries/sql-queries.module';

@Module({
  imports: [ConfigModule, RagModule, SqlQueriesModule],
  controllers: [HuggingFaceController],
  providers: [HuggingFaceService],
  exports: [HuggingFaceService],
})
export class HuggingFaceModule {}
