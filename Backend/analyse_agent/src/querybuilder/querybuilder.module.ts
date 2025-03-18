import { Module } from '@nestjs/common';
import { QueryBuilderService } from './querybuilder.service';
import { QueryBuilderController } from './querybuilder.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [QueryBuilderController],
  providers: [QueryBuilderService],
  exports: [QueryBuilderService],
})
export class QueryBuilderModule {}
