import { Module } from '@nestjs/common';
import { QueryBuilderModule } from './querybuilder/querybuilder.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot(), QueryBuilderModule],
})
export class AppModule {}
