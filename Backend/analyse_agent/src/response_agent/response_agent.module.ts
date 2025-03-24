import { Module, forwardRef } from '@nestjs/common';
import { ResponseAgentService } from './response_agent.service';
import { ResponseAgentController } from './response_agent.controller';
import { ConfigModule } from '@nestjs/config';
import { AnalyseAgentModule } from 'src/analyse_agent/analyse_agent.module';

@Module({
  imports: [ConfigModule, forwardRef(() => AnalyseAgentModule)],
  controllers: [ResponseAgentController],
  providers: [ResponseAgentService],
  exports: [ResponseAgentService],
})
export class ResponseAgentModule {}
