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
  RagClientService,
} from './services/clients';
import { OpenAIService } from './services/openai.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AnalyseController],
  providers: [
    AnalyseService,
    RouterService,
    AnalyseValidationPipe,
    ReorientationService,
    QueryBuilderClientService,
    ElasticsearchClientService,
    RagClientService,
    OpenAIService,
  ],
  exports: [AnalyseService],
})
export class AnalyseModule {}
