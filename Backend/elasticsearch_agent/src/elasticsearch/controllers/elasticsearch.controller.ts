import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Logger,
} from '@nestjs/common';
import { ElasticsearchService } from '../services/elasticsearch.service';
import {
  SearchDto,
  IndexDto,
  DeleteDto,
  BulkIndexDto,
} from '../dto/search.dto';
import {
  SearchResponseDto,
  IndexResponseDto,
  DeleteResponseDto,
  BulkIndexResponseDto,
} from '../dto/response.dto';

@Controller('elasticsearch')
export class ElasticsearchController {
  private readonly logger = new Logger(ElasticsearchController.name);

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  @Post('search')
  async search(@Body() searchDto: SearchDto): Promise<SearchResponseDto> {
    this.logger.log(`Search request received: ${searchDto.query}`);
    return this.elasticsearchService.search(searchDto);
  }

  @Post('index')
  async index(@Body() indexDto: IndexDto): Promise<IndexResponseDto> {
    this.logger.log(`Index request received for index: ${indexDto.index}`);
    return this.elasticsearchService.index(indexDto);
  }

  @Delete('index/:id')
  async delete(
    @Param('id') id: string,
    @Body() deleteDto: DeleteDto,
  ): Promise<DeleteResponseDto> {
    this.logger.log(
      `Delete request received for index: ${deleteDto.index}, id: ${id}`,
    );
    return this.elasticsearchService.delete({ ...deleteDto, id });
  }

  @Post('bulk')
  async bulkIndex(
    @Body() bulkIndexDto: BulkIndexDto,
  ): Promise<BulkIndexResponseDto> {
    this.logger.log(
      `Bulk index request received for index: ${bulkIndexDto.index}, documents: ${bulkIndexDto.documents.length}`,
    );
    return this.elasticsearchService.bulkIndex(bulkIndexDto);
  }

  @Get('health')
  async checkHealth() {
    this.logger.log('Health check request received');
    return this.elasticsearchService.checkHealth();
  }

  @Post('ensure-index/:index')
  async ensureIndex(@Param('index') index: string) {
    this.logger.log(`Ensure index request received for index: ${index}`);
    const result = await this.elasticsearchService.ensureIndex(index);
    return {
      status: result ? 'ok' : 'error',
      index,
    };
  }

  // Nouveaux endpoints pour la gestion des alias
  @Post('alias/:indexName/:aliasName')
  async addAlias(
    @Param('indexName') indexName: string,
    @Param('aliasName') aliasName: string,
  ) {
    return this.elasticsearchService.manageIndexAlias(
      indexName,
      aliasName,
      'add',
    );
  }

  @Delete('alias/:indexName/:aliasName')
  async removeAlias(
    @Param('indexName') indexName: string,
    @Param('aliasName') aliasName: string,
  ) {
    return this.elasticsearchService.manageIndexAlias(
      indexName,
      aliasName,
      'remove',
    );
  }

  @Post('index-with-alias')
  async createIndexWithAlias(
    @Body() body: { indexName: string; aliasName: string; mappings: any },
  ) {
    return this.elasticsearchService.createIndexWithAlias(
      body.indexName,
      body.aliasName,
      body.mappings,
    );
  }

  @Post('reindex')
  async reindex(@Body() body: { sourceIndex: string; targetIndex: string }) {
    return this.elasticsearchService.reindex(
      body.sourceIndex,
      body.targetIndex,
    );
  }
}
