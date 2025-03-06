import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { AnalyseController } from './controllers/analyse.controller';
import { AnalyseService } from './services/analyse.service';
import { RagService } from './services/rag.service';
import { RouterService } from './services/router.service';
import { DatabaseMetadataService } from './services/database-metadata.service';
import { AnalyseValidationPipe } from './pipes/analyse-validation.pipe';
import { ReorientationService } from './services/reorientation.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        node: configService.get('ELASTICSEARCH_NODE') || 'http://elasticsearch:9200',
        auth: {
          username: configService.get('ELASTICSEARCH_USERNAME') || 'elastic',
          password: configService.get('ELASTICSEARCH_PASSWORD') || 'changeme',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AnalyseController],
  providers: [
    AnalyseService,
    RagService,
    RouterService,
    DatabaseMetadataService,
    AnalyseValidationPipe,
    ReorientationService,
  ],
})
export class AnalyseModule {}
