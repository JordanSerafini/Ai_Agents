import { Module } from '@nestjs/common';
import { ResponseAgentService } from './response_agent.service';
import { ResponseAgentController } from './response_agent.controller';
import { AnalyseAgentModule } from '../analyse_agent/analyse_agent.module';
import { QueryBuilderModule } from '../querybuilder/querybuilder.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, AnalyseAgentModule, QueryBuilderModule],
  controllers: [ResponseAgentController],
  providers: [ResponseAgentService],
  exports: [ResponseAgentService],
})
export class ResponseAgentModule {}
