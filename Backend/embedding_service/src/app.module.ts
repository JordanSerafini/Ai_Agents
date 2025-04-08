import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingModule } from './embedding/embedding.module';
import { ChromaModule } from './chroma/chroma.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
    EmbeddingModule,
    ChromaModule,
  ],
})
export class AppModule {}
