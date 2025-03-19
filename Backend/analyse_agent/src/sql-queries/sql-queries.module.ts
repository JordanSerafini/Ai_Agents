import { Module, forwardRef } from '@nestjs/common';
import { SqlQueriesService } from './sql-queries.service';
import { PredefinedQueriesService } from './predefined-queries.service';
import { RagModule } from '../RAG/rag.module';

@Module({
  imports: [forwardRef(() => RagModule)],
  providers: [SqlQueriesService, PredefinedQueriesService],
  exports: [SqlQueriesService, PredefinedQueriesService],
})
export class SqlQueriesModule {}
