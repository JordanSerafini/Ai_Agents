import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AnalyseService } from '../services/analyse.service';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';

@Controller('analyse')
export class AnalyseController {
  private readonly logger = new Logger(AnalyseController.name);

  constructor(private readonly analyseService: AnalyseService) {}

  @Post()
  async analyser(@Body() request: AnalyseRequestDto) {
    this.logger.log(
      `Requête reçue: userId=${request.userId}, useHistory=${request.useHistory}, question="${request.question}"`,
    );
    return this.analyseService.analyser(request);
  }
}
