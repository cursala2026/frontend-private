export type DocumentCategory = 'PLANTILLAS' | 'LOGOS' | 'IMAGENES' | 'OTROS';

export interface IDocument {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  filename?: string;
  fileName?: string;
  originalFileName?: string;
  url?: string;
  fileUrl?: string;
  fileSize?: number;
  sizeBytes?: number;
  category?: DocumentCategory | string;
  type?: string;
  visibility?: 'ADMIN' | 'PROFESORES' | 'TODOS';
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}