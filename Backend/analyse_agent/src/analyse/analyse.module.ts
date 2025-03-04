import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyseController } from './controllers/analyse.controller';
import { AnalyseService } from './services/analyse.service';
import { OllamaService } from './services/ollama.service';

@Module({
  imports: [ConfigModule],
  controllers: [AnalyseController],
  providers: [AnalyseService, OllamaService],
  exports: [AnalyseService],
})
export class AnalyseModule {}
