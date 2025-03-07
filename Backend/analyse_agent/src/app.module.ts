import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyseModule } from './analyse/analyse.module';
import { RagClientModule } from './services/rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AnalyseModule,
    RagClientModule,
  ],
})
export class AppModule {}
