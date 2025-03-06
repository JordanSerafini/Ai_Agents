import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueryBuilderService } from './services/query-builder.service';
import { DatabaseMetadataService } from './services/database-metadata.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
  ],
  providers: [
    QueryBuilderService,
    DatabaseMetadataService,
  ],
  exports: [
    QueryBuilderService,
    DatabaseMetadataService,
  ],
})
export class QueryBuilderModule {} 