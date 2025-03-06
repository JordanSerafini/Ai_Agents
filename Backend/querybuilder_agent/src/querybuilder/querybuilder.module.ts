import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueryBuilderService } from './services/query-builder.service';
import { DatabaseMetadataService } from './services/database-metadata.service';
import { DatabaseService } from './services/database.service';
import { QueryBuilderController } from './controllers/querybuilder.controller';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [QueryBuilderController],
  providers: [QueryBuilderService, DatabaseMetadataService, DatabaseService],
  exports: [QueryBuilderService, DatabaseMetadataService],
})
export class QueryBuilderModule {}
