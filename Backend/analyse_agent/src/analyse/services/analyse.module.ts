import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AnalyseService } from './analyse.service';
import { OpenAIService } from './openai.service';
import { MistralService } from './mistral.service';
import { RouterService } from './router.service';
import {
  QueryBuilderClientService,
  ElasticsearchClientService,
  RagClientLocalService,
} from './clients';
import {
  CacheService,
  ConversationService,
  CategorizationService,
  TemporalService,
  FormatterService,
  QueryAnalysisService,
} from './analyse';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    AnalyseService,
    OpenAIService,
    MistralService,
    RouterService,
    QueryBuilderClientService,
    ElasticsearchClientService,
    RagClientLocalService,
    CacheService,
    ConversationService,
    CategorizationService,
    TemporalService,
    FormatterService,
    QueryAnalysisService,
  ],
  exports: [AnalyseService, OpenAIService, MistralService, RouterService],
})
export class AnalyseModule {}
