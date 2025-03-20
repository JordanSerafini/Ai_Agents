import { Module } from '@nestjs/common';
import { EmailSortService } from './email-sort.service';
import { EmailSortController } from './email-sort.controller';

@Module({
  providers: [EmailSortService],
  controllers: [EmailSortController],
  exports: [EmailSortService],
})
export class EmailSortModule {}
