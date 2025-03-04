import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { DatabaseMetadataService } from './services/database-metadata.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: async () => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'technidalle',
        entities: [],
        synchronize: false,
      }),
    }),
  ],
  controllers: [DatabaseController],
  providers: [DatabaseService, DatabaseMetadataService],
  exports: [DatabaseService, DatabaseMetadataService],
})
export class DatabaseModule {}
