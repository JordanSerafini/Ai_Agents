import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './search.service';
import { SyncService } from './sync.service';
import { DatabaseModule } from '../database/database.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    forwardRef(() => DatabaseModule),
    ScheduleModule.forRoot(),
    ConfigModule,
  ],
  providers: [],
  exports: [SearchService, SyncService],
})
export class SearchModule {}
