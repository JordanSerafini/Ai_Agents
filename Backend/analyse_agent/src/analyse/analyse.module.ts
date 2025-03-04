import { Module } from '@nestjs/common';
import { AnalyseService } from './analyse.service';
import { AnalyseController } from './analyse.controller';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI),
  ],
  controllers: [AnalyseController],
  providers: [AnalyseService],
  exports: [AnalyseService],
})
export class AnalyseModule {} 