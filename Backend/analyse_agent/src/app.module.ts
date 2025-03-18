import { Module } from '@nestjs/common';
import { HuggingFaceModule } from './huggingface/huggingface.module';
import { RagModule } from './RAG/rag.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { SqlQueriesModule } from './sql-queries/sql-queries.module';
import { QueryBuilderModule } from './querybuilder/querybuilder.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    HuggingFaceModule,
    RagModule,
    SqlQueriesModule,
    QueryBuilderModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
