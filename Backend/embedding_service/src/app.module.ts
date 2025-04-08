import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmbeddingModule } from './embedding/embedding.module';
import { ChromaModule } from './chroma/chroma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EmbeddingModule,
    ChromaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
