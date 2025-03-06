import { Controller, Post, Body } from '@nestjs/common';
import { OllamaService } from '../services/ollama.service';
import { GenerateRequestDto } from '../dto/generate-request.dto';

@Controller('generate')
export class OllamaController {
  constructor(private readonly ollamaService: OllamaService) {}

  @Post()
  async generate(@Body() request: GenerateRequestDto) {
    return this.ollamaService.generate(request);
  }
}
