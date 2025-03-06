import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryBuilderService } from './services/query-builder.service';
import { DatabaseMetadataService } from './services/database-metadata.service';
import { DatabaseService } from './services/database.service';
import { QueryBuilderController } from './controllers/querybuilder.controller';
import { QueryValidatorService } from './services/query-validator.service';
import { QueryConfigService } from './services/query-config.service';
import { QueryExecutorService } from './services/query-executor.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('PG_HOST') || 'localhost',
        port: parseInt(configService.get('PG_PORT') || '5432'),
        username: configService.get('PG_USERNAME') || 'postgres',
        password: configService.get('PG_PASSWORD') || 'postgres',
        database: configService.get('PG_DATABASE') || 'postgres',
        autoLoadEntities: true,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [QueryBuilderController],
  providers: [
    QueryBuilderService,
    DatabaseMetadataService,
    DatabaseService,
    QueryValidatorService,
    QueryConfigService,
    QueryExecutorService,
  ],
  exports: [QueryBuilderService, DatabaseMetadataService],
})
export class QueryBuilderModule {}
