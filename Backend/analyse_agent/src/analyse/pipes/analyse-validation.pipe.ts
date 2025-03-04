import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';

@Injectable()
export class AnalyseValidationPipe implements PipeTransform {
  async transform(
    value: any,
    metadata: ArgumentMetadata,
  ): Promise<AnalyseRequestDto> {
    if (metadata.type !== 'body') {
      return value as AnalyseRequestDto;
    }

    const dto = plainToClass(AnalyseRequestDto, value);
    const errors = await validate(dto);

    if (errors.length > 0) {
      const messages = errors.map((error) => {
        if (!error.constraints) {
          return 'Validation error';
        }
        return Object.values(error.constraints).join(', ');
      });
      throw new BadRequestException(messages);
    }

    return dto;
  }
}
