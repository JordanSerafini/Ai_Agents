import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class RagClientService {
  private readonly logger = new Logger(RagClientService.name);
  private readonly ragServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.ragServiceUrl = this.configService.get<string>(
      'RAG_SERVICE_URL',
      'http://rag-agent:3000',
    );
  }

  async query(query: string): Promise<string> {
    try {
      const { data } = await firstValueFrom(
        this.httpService
          .post(`${this.ragServiceUrl}/rag/query`, { query })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error(`Error querying RAG service: ${error.message}`);
              throw error;
            }),
          ),
      );
      return data;
    } catch (error) {
      this.logger.error(`Failed to query RAG service: ${error.message}`);
      throw error;
    }
  }

  async indexAndQuery(document: any, query: string): Promise<string> {
    try {
      const { data } = await firstValueFrom(
        this.httpService
          .post(`${this.ragServiceUrl}/rag/index-and-query`, {
            document,
            query,
          })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error(
                `Error in index and query RAG service: ${error.message}`,
              );
              throw error;
            }),
          ),
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to index and query RAG service: ${error.message}`,
      );
      throw error;
    }
  }
}
