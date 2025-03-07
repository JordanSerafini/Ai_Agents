import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RagClientService } from './rag.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
  ],
  providers: [RagClientService],
  exports: [RagClientService],
})
export class RagClientModule {} 