export class SearchRequestDto {
  index: string;
  query: any;
  sort?: any[];
  from?: number;
  size?: number;
  search_after?: any[];
}
