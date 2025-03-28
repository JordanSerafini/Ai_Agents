import { Module, forwardRef } from '@nestjs/common';
import { HuggingFaceService } from './huggingface.service';
import { HuggingFaceController } from './huggingface.controller';
import { ConfigModule } from '@nestjs/config';
import { RagModule } from '../RAG/rag.module';
import { SqlQueriesModule } from '../sql-queries/sql-queries.module';
import { QueryBuilderModule } from 'src/querybuilder/querybuilder.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => RagModule),
    SqlQueriesModule,
    QueryBuilderModule,
  ],
  controllers: [HuggingFaceController],
  providers: [HuggingFaceService],
  exports: [HuggingFaceService],
})
export class HuggingFaceModule {}
