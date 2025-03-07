import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { RagClientModule } from './services/rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ElasticsearchModule,
    RagClientModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
