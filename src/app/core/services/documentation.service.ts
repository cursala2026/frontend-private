import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { UserRole } from '../models/user-role.enum';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { IDocument, DocumentCategory } from '../models/documentation.model';

// este service es temporal falta la tarea 43 pimero
@Injectable({ providedIn: 'root' })
export class DocumentationService {
  private authService = inject(AuthService);

  private readonly _documents = signal<IDocument[]>(MOCK_DOCUMENTS);
  readonly documents = this._documents.asReadonly();

  // filtrado por rol
  readonly filteredDocuments = computed<IDocument[]>(() => {
    const docs = this._documents();
    if (this.authService.hasRole(UserRole.ADMIN)) return docs;
    return docs.filter(d => !d.visibility || d.visibility === 'TODOS' || d.visibility === 'PROFESORES');
  });

  readonly signedContract = signal<IDocument | null>(MOCK_CONTRACT);
  // simula subir un documento al backend (el real seria un POST multipart a /api/v1/file-materials)
  uploadDocument(formData: FormData): Observable<any> {
    const file = formData.get('file') as File | null;
    const nuevo: IDocument = {
      _id: 'tmp-' + Date.now(),
      title: String(formData.get('title') ?? ''),
      filename: file?.name ?? 'archivo',
      category: (formData.get('category') as DocumentCategory) ?? 'OTROS',
      url: '#',
      sizeBytes: file?.size ?? 0,
      visibility: 'PROFESORES',
    };
    // agregamos el doc a la lista y simulamos la demora + respuesta del backend
    this._documents.update(docs => [nuevo, ...docs]);
    return of({ status: 201, data: nuevo }).pipe(delay(800));
  }

  // en el real re-consulta el backend, en el mock ya actualizamos la signal arriba
  refreshDocuments(): void {
    // no operando por ahora 
  }
}

const MB = 1024 * 1024;

const MOCK_CONTRACT: IDocument = {
  _id: 'c1', title: 'Tu contrato firmado', filename: 'contrato-firmado.pdf',
  category: 'OTROS', url: 'https://dev-cursala.b-cdn.net/support-materials/contrato-firmado.pdf',
  sizeBytes: 1.4 * MB, visibility: 'PROFESORES', updatedAt: '2024-05-14',
};


const MOCK_DOCUMENTS: IDocument[] = [
  { _id: '1', title: 'Reglamento Docente', filename: 'reglamento-docente.pdf', category: 'OTROS', url: 'https://dev-cursala.b-cdn.net/support-materials/reglamento-docente.pdf', sizeBytes: 1.2 * MB, visibility: 'PROFESORES' },
  { _id: '2', title: 'Guía del Profesor', filename: 'guia-del-profesor.pptx', category: 'PLANTILLAS', url: 'https://dev-cursala.b-cdn.net/support-materials/guia-del-profesor.pptx', sizeBytes: 3.4 * MB, visibility: 'PROFESORES' },
  { _id: '3', title: 'Logo Cursala', filename: 'logo-cursala.png', category: 'LOGOS', url: 'https://dev-cursala.b-cdn.net/support-materials/logo-cursala.png', sizeBytes: 3.2 * MB, visibility: 'PROFESORES' },
  { _id: '4', title: 'Políticas Institucionales', filename: 'politicas-institucionales.pdf', category: 'OTROS', url: 'https://dev-cursala.b-cdn.net/support-materials/politicas-institucionales.pdf', sizeBytes: 0.87 * MB, visibility: 'PROFESORES' },
];