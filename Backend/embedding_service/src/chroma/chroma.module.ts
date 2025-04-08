import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { ChromaService } from './chroma.service';
import { ChromaController } from './chroma.controller';
import { EmbeddingModule } from '../embedding/embedding.module';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ConfigModule, forwardRef(() => EmbeddingModule), HttpModule],
  providers: [ChromaService],
  controllers: [ChromaController],
  exports: [ChromaService],
})
export class ChromaModule implements OnModuleInit {
  constructor(private readonly chromaService: ChromaService) {}

  async onModuleInit() {
    // Initialiser les collections par défaut au démarrage
    await this.chromaService.initializeDefaultCollections();
  }
}
