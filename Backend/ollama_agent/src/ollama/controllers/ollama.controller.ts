import { Body, Controller, Post } from '@nestjs/common';
import { OllamaService } from '../services/ollama.service';
import { GenerateRequestDto } from '../dto/generate-request.dto';
import { GenerateResponseDto } from '../dto/generate-response.dto';

@Controller('ollama')
export class OllamaController {
  constructor(private readonly ollamaService: OllamaService) {}

  @Post('generate')
  async generate(@Body() request: GenerateRequestDto): Promise<GenerateResponseDto> {
    const response = await this.ollamaService.generateResponse(request.prompt);
    return { response };
  }
} 