import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception personnalisée pour les erreurs du QueryBuilder
 */
export class QueryBuilderException extends HttpException {
  constructor(message: string) {
    super(
      {
        status: HttpStatus.BAD_REQUEST,
        error: message,
        type: 'QUERY_BUILDER',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
