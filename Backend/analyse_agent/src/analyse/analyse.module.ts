import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AnalyseController } from './controllers/analyse.controller';
import { AnalyseService } from './services/analyse.service';
import { AnalyseValidationPipe } from './pipes/analyse-validation.pipe';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [AnalyseController],
  providers: [AnalyseService, AnalyseValidationPipe],
})
export class AnalyseModule {}
