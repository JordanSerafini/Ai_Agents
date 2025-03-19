import { Module } from '@nestjs/common';
import { RapportService } from './rapport.service';
import { RapportController } from './rapport.controller';

@Module({
  controllers: [RapportController],
  providers: [RapportService],
  exports: [RapportService],
})
export class RapportModule {}
