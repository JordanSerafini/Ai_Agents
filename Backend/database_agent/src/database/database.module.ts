import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { DatabaseMetadataService } from './services/database-metadata.service';
import { PgConnectionModule } from 'pool_package';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PgConnectionModule,
    forwardRef(() => SearchModule),
  ],
  controllers: [],
  providers: [DatabaseMetadataService, DatabaseService],
  exports: [DatabaseService, DatabaseMetadataService],
})
export class DatabaseModule {}
