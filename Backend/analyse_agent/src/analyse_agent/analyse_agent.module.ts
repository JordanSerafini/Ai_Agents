import { Module } from '@nestjs/common';
import { AnalyseAgentService } from './analyse_agent.service';
import { QueryBuilderModule } from '../querybuilder/querybuilder.module';
import { HuggingFaceModule } from '../huggingface/huggingface.module';

@Module({
  imports: [QueryBuilderModule, HuggingFaceModule],
  providers: [AnalyseAgentService],
  exports: [AnalyseAgentService],
})
export class AnalyseAgentModule {}
