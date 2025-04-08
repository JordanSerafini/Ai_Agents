import { Module, forwardRef } from '@nestjs/common';
import { ChromaService } from './chroma.service';
import { ChromaController } from './chroma.controller';
import { EmbeddingModule } from '../embedding/embedding.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, forwardRef(() => EmbeddingModule)],
  providers: [ChromaService],
  controllers: [ChromaController],
  exports: [ChromaService],
})
export class ChromaModule {}
