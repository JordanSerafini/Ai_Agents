import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueryBuilderModule } from './querybuilder/querybuilder.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot(), QueryBuilderModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
