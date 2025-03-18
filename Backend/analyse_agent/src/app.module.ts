import { Module } from '@nestjs/common';
import { HuggingFaceModule } from './huggingface/huggingface.module';
import { RagModule } from './RAG/rag.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
@Module({
  imports: [ConfigModule.forRoot(), HuggingFaceModule, RagModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
