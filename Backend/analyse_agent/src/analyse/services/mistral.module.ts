import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MistralService } from './mistral.service';

@Module({
  imports: [ConfigModule],
  providers: [MistralService],
  exports: [MistralService],
})
export class MistralModule {} 