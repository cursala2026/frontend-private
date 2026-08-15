export type DocumentCategory = 'PLANTILLAS' | 'LOGOS' | 'IMAGENES' | 'OTROS';

export interface IDocument {
  _id: string;
  title: string;
  filename: string;
  category: DocumentCategory;
  url: string;
  sizeBytes: number;
  visibility?: 'PROFESORES' | 'TODOS';
  updatedAt?: string;
}