import { Controller, Post, Body } from '@nestjs/common';
import { AnalyseService } from '../services/analyse.service';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';

@Controller('analyse')
export class AnalyseController {
  constructor(private readonly analyseService: AnalyseService) {}

  @Post()
  async analyser(@Body() request: AnalyseRequestDto) {
    return this.analyseService.analyser(request);
  }
}
