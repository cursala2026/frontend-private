import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { UserRole } from '../models/user-role.enum';
import { IDocument } from '../models/documentation.model';

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