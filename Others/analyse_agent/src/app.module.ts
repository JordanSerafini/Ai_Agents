import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyseModule } from './analyse/analyse.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AnalyseModule,
  ],
})
export class AppModule {}
