import { Module, forwardRef } from '@nestjs/common';
import { SqlQueriesService } from './sql-queries.service';
import { RagModule } from '../RAG/rag.module';
import { PredefinedQueriesService } from './predefined-queries.service';
import { SqlQueriesController } from './sql-queries.controller';

@Module({
  imports: [forwardRef(() => RagModule)],
  providers: [SqlQueriesService, PredefinedQueriesService],
  exports: [SqlQueriesService, PredefinedQueriesService],
  controllers: [SqlQueriesController],
})
export class SqlQueriesModule {}
