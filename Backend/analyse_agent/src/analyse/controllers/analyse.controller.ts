import { Controller, Post, Body, Logger, Get } from '@nestjs/common';
import { AnalyseService } from '../services/analyse.service';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { DatabaseMetadataService } from '../services/database-metadata.service';

@Controller('analyse')
export class AnalyseController {
  private readonly logger = new Logger(AnalyseController.name);

  constructor(
    private readonly analyseService: AnalyseService,
    private readonly dbMetadataService: DatabaseMetadataService,
  ) {}

  @Post()
  async analyser(@Body() request: AnalyseRequestDto) {
    this.logger.log(
      `Requête reçue: userId=${request.userId}, useHistory=${request.useHistory}, question="${request.question}"`,
    );
    return this.analyseService.analyser(request);
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'analyse_agent',
    };
  }

  @Get('database-metadata')
  getDatabaseMetadata() {
    return {
      tables: this.dbMetadataService.getAllTables(),
      enums: this.dbMetadataService.getAllEnums(),
      description: this.dbMetadataService.getDatabaseDescription(),
    };
  }
}
