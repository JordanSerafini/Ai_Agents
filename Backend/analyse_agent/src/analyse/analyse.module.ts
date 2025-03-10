import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AnalyseController } from './controllers/analyse.controller';
import { AnalyseService } from './services/analyse.service';
import { RouterService } from './services/router.service';
import { AnalyseValidationPipe } from './pipes/analyse-validation.pipe';
import { ReorientationService } from './services/reorientation.service';
import {
  QueryBuilderClientService,
  ElasticsearchClientService,
  RagClientLocalService,
} from './services/clients';
import { OpenAIService } from './services/openai.service';
import { MistralService } from './services/mistral.service';
import { RagClientModule } from '../services/rag.module';
import {
  CacheService,
  ConversationService,
  CategorizationService,
  TemporalService,
  FormatterService,
  QueryAnalysisService,
} from './services/analyse';
import {
  RouterConfigService,
  QueryBuilderService,
  ElasticsearchService,
  RagService,
  WorkflowService,
} from './services/router';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RagClientModule,
  ],
  controllers: [AnalyseController],
  providers: [
    AnalyseService,
    RouterService,
    AnalyseValidationPipe,
    ReorientationService,
    QueryBuilderClientService,
    ElasticsearchClientService,
    RagClientLocalService,
    OpenAIService,
    MistralService,
    CacheService,
    ConversationService,
    CategorizationService,
    TemporalService,
    FormatterService,
    QueryAnalysisService,
    RouterConfigService,
    QueryBuilderService,
    ElasticsearchService,
    RagService,
    WorkflowService,
  ],
  exports: [AnalyseService],
})

export class AnalyseModule {}
