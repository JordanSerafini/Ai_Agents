import { Module } from '@nestjs/common';
import { OllamaController } from './controllers/ollama.controller';
import { OllamaService } from './services/ollama.service';

@Module({
  controllers: [OllamaController],
  providers: [OllamaService],
  exports: [OllamaService],
})
export class OllamaModule {} 