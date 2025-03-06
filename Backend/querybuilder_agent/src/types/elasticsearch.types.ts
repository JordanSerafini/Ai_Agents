export interface ElasticsearchAggregation {
  terms?: {
    field: string;
    size?: number;
    order?: {
      [key: string]: 'asc' | 'desc';
    };
  };
  avg?: {
    field: string;
  };
  sum?: {
    field: string;
  };
  min?: {
    field: string;
  };
  max?: {
    field: string;
  };
  date_histogram?: {
    field: string;
    calendar_interval: string;
    format?: string;
  };
  range?: {
    field: string;
    ranges: Array<{
      from?: number;
      to?: number;
      key?: string;
    }>;
  };
}
