import { Module } from '@nestjs/common';
import { ChromaService } from './chroma.service';
import { ChromaController } from './chroma.controller';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [EmbeddingModule],
  providers: [ChromaService],
  controllers: [ChromaController],
  exports: [ChromaService],
})
export class ChromaModule {}
