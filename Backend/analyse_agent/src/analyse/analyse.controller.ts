import { Controller, Post, Body } from '@nestjs/common';
import { AnalyseService } from './analyse.service';

@Controller('analyse')
export class AnalyseController {
  constructor(private readonly analyseService: AnalyseService) {}

  @Post('analyser')
  async analyserRequete(@Body('requete') requete: string) {
    return this.analyseService.analyserRequete(requete);
  }
}
