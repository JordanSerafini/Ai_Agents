import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HuggingFaceModule } from './huggingface/huggingface.module';
import { RagModule } from './RAG/rag.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot(), HuggingFaceModule, RagModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
