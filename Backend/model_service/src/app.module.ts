import { Module } from '@nestjs/common';
import { EmbeddingController } from './mistral_model/embedding.controller';

@Module({
  imports: [],
  controllers: [EmbeddingController],
})
export class AppModule {}
