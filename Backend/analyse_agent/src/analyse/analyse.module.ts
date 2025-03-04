import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AnalyseController } from './controllers/analyse.controller';
import { AnalyseService } from './services/analyse.service';
import { RagService } from './services/rag.service';
import { RouterService } from './services/router.service';
import { DatabaseMetadataService } from './services/database-metadata.service';
import { AnalyseValidationPipe } from './pipes/analyse-validation.pipe';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AnalyseController],
  providers: [
    AnalyseService,
    RagService,
    RouterService,
    DatabaseMetadataService,
    AnalyseValidationPipe,
  ],
})
export class AnalyseModule {}
