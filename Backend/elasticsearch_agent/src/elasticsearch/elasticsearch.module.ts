import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule as NestElasticsearchModule } from '@nestjs/elasticsearch';
import { ElasticsearchService } from './services/elasticsearch.service';
import { ElasticsearchController } from './controllers/elasticsearch.controller';
import { ClientOptions } from '@elastic/elasticsearch';

@Module({
  imports: [
    ConfigModule.forRoot(),
    NestElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<ClientOptions> => {
        const username = configService.get<string>('ELASTICSEARCH_USERNAME');
        const password = configService.get<string>('ELASTICSEARCH_PASSWORD');
        const node = configService.get<string>('ELASTICSEARCH_NODE');

        if (!username || !password || !node) {
          throw new Error('Missing required Elasticsearch configuration');
        }

        return {
          node,
          auth: {
            username,
            password,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [ElasticsearchController],
  providers: [ElasticsearchService],
  exports: [ElasticsearchService],
})
export class ElasticsearchModule {}
