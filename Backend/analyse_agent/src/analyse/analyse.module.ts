import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AnalyseController } from './controllers/analyse.controller';
import { AnalyseService } from './services/analyse.service';
import { RagService } from './services/rag.service';
import { RouterService } from './services/router.service';
import { DatabaseMetadataService } from './services/database-metadata.service';
import { AnalyseValidationPipe } from './pipes/analyse-validation.pipe';
import { ReorientationService } from './services/reorientation.service';
import { QueryBuilderService } from './services/query-builder.service';
import { QueryBuilderController } from './controllers/query-builder.controller';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AnalyseController, QueryBuilderController],
  providers: [
    AnalyseService,
    RagService,
    RouterService,
    DatabaseMetadataService,
    AnalyseValidationPipe,
    ReorientationService,
    QueryBuilderService,
  ],
})
export class AnalyseModule {}
