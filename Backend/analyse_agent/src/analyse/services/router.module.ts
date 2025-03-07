import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RouterService } from './router.service';
import {
  RouterConfigService,
  QueryBuilderService,
  ElasticsearchService,
  RagService,
  WorkflowService,
} from './router';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
  ],
  providers: [
    RouterService,
    RouterConfigService,
    QueryBuilderService,
    ElasticsearchService,
    RagService,
    WorkflowService,
  ],
  exports: [
    RouterService,
  ],
})
export class RouterModule {} 