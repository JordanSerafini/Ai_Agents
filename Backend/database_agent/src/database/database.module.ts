import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { DatabaseMetadataService } from './services/database-metadata.service';
import { PgConnectionModule } from 'pool_package';
import { DatabaseController } from './database.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PgConnectionModule,
  ],
  controllers: [DatabaseController],
  providers: [DatabaseMetadataService, DatabaseService],
  exports: [DatabaseService, DatabaseMetadataService],
})
export class DatabaseModule {}
