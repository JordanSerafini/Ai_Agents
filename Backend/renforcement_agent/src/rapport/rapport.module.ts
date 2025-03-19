import { Module, forwardRef } from '@nestjs/common';
import { RapportService } from './rapport.service';
import { RapportController } from './rapport.controller';
import { RagValidatorModule } from '../rag-validator/rag-validator.module';

@Module({
  imports: [forwardRef(() => RagValidatorModule)],
  controllers: [RapportController],
  providers: [RapportService],
  exports: [RapportService],
})
export class RapportModule {}
