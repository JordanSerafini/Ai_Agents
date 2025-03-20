import { Module } from '@nestjs/common';
import { HuggingFaceService } from './hugging-face.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [HuggingFaceService],
  exports: [HuggingFaceService],
})
export class HuggingFaceModule {}
