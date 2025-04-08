import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EmbeddingService } from './embedding.service';
import { EmbeddingController } from './embedding.controller';
import { ChromaModule } from '../chroma/chroma.module';

@Module({
  imports: [HttpModule, forwardRef(() => ChromaModule)],
  providers: [EmbeddingService],
  controllers: [EmbeddingController],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
