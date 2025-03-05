import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { SearchModule } from './search/search.module';
import { DatabaseController } from './database/database.controller';
import { SearchService } from './search/search.service';
import { SyncService } from './search/sync.service';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        node:
          configService.get('ELASTICSEARCH_NODE') ||
          'http://elasticsearch:9200',
        auth: {
          username: configService.get('ELASTICSEARCH_USERNAME') || 'elastic',
          password: configService.get('ELASTICSEARCH_PASSWORD') || 'changeme',
        },
        maxRetries: 10,
        requestTimeout: 60000,
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST') || 'redis',
        port: configService.get('REDIS_PORT') || 6379,
        ttl: 3600, // Durée de vie par défaut en secondes (1 heure)
        max: 1000, // Nombre maximum d'éléments en cache
      }),
      inject: [ConfigService],
      isGlobal: true,
    }),
    DatabaseModule,
    SearchModule,
  ],
  controllers: [DatabaseController],
  providers: [SearchService, SyncService],
})
export class AppModule {}
