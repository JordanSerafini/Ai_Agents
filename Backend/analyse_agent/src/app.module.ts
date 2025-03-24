import { Module } from '@nestjs/common';
import { HuggingFaceModule } from './huggingface/huggingface.module';
import { RagModule } from './RAG/rag.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { SqlQueriesModule } from './sql-queries/sql-queries.module';
import { QueryBuilderModule } from './querybuilder/querybuilder.module';
import { AnalyseAgentModule } from './analyse_agent/analyse_agent.module';
import { ResponseAgentModule } from './response_agent/response_agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HuggingFaceModule,
    RagModule,
    SqlQueriesModule,
    QueryBuilderModule,
    AnalyseAgentModule,
    ResponseAgentModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
