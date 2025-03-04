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
export class AnalyseValidationPipe implements PipeTransform<any> {
  async transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') {
      return value;
    }

    const dto = plainToClass(AnalyseRequestDto, value);
    const errors = await validate(dto);

    if (errors.length > 0) {
      const messages = errors.map((error) =>
        Object.values(error.constraints).join(', '),
      );
      throw new BadRequestException(messages);
    }

    return dto;
  }
}
