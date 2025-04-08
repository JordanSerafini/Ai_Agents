export class AddDocumentDto {
  content: string;
  metadata?: Record<string, any>;
  id?: string;
  collection_name?: string;
}
