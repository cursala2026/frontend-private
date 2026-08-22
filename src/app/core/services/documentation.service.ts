import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError, tap, Observable } from 'rxjs';
import { IDocument } from '../models/documentation.model';
import { AuthService } from './auth.service';
import { environment } from '../config/environment';

export interface ISignedContract {
  _id?: string;
  title: string;
  filename: string;
  url: string;
  updatedAt?: string;
  signedAt?: string;
  status: 'PENDIENTE' | 'FIRMADO' | 'RECHAZADO';
}

@Injectable({
  providedIn: 'root'
})
export class DocumentationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly apiUrl = `${environment.apiUrl}/file-materials`;

  // Estado base reactivo inmutable desde el exterior
  private readonly _documents = signal<IDocument[]>([]);
  public readonly documents = this._documents.asReadonly();

  // Contrato para la vista de profesor
  private readonly _signedContract = signal<ISignedContract | null>(null);
  public readonly signedContract = this._signedContract.asReadonly();

  // Control sustantivo de visibilidad derivado según el rol
  public readonly filteredDocuments = computed(() => {
  const roles = this.authService.getUserRoles() || [];
  const normalizedRoles = roles.map((r: string) => r.trim().toUpperCase());

  let effectiveRole = 'ALUMNO';
  if (normalizedRoles.includes('ADMIN')) {
    effectiveRole = 'ADMIN';
  } else if (normalizedRoles.includes('PROFESOR')) {
    effectiveRole = 'PROFESOR';
  }

  const docs = this.documents();

  if (effectiveRole === 'ADMIN') {
    return docs;
  }

  // Profesores y alumnos solo ven documentos públicos,
  // que es el único control de visibilidad que existe hoy en el backend.
  return docs.filter((doc) => doc.isPublic === true);
});
public getDocuments(): Observable<IDocument[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      tap((response) => {
        // Desempaqueta response.data (estándar de Cursala) o response directo
        const items = Array.isArray(response)
          ? response
          : (Array.isArray(response?.data) ? response.data : (response?.data?.docs || []));
        this._documents.set(items);
      }),
      catchError((error: HttpErrorResponse) => {
        this._documents.set([]);
        return throwError(() => error);
      })
    );
  
  }

  public refreshDocuments(): void {
    this.getDocuments().subscribe();
  }

  public uploadDocument(formData: FormData): Observable<IDocument> {
    return this.http.post<IDocument>(this.apiUrl, formData).pipe(
      tap((newDoc) => {
        this._documents.update((current) => [...current, newDoc]);
      }),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }
}