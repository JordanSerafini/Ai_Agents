import { Module } from '@nestjs/common';
import { QueryBuilderModule } from './querybuilder/querybuilder.module';
import { ConfigModule } from '@nestjs/config';
import { RagClientModule } from './services/rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueryBuilderModule,
    RagClientModule,
  ],
})
export class AppModule {}
