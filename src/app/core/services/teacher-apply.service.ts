import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../config/environment';

// tipos de documento que se suben
export type TeacherDocType = 'photo' | 'cv' | 'signature';

// lo que se manda al backend al postular
export interface ITeacherApplication {
  title: string;
  yearsOfExperience: number;
  bio: string;
  photoUrl: string;
  cvUrl: string;
  signatureUrl: string;
  agreementAccepted: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TeacherService {
  private readonly http = inject(HttpClient);
  // environment.apiUrl ya termina en /api/v1
  private readonly apiUrl = `${environment.apiUrl}/teacher`;

  // sube un archivo (foto, cv o firma) al storage (Bunny via backend) y devuelve la url
  uploadDocument(file: File, type: TeacherDocType): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    return this.http
      .post<{ url: string }>(`${this.apiUrl}/upload-document`, formData)
      .pipe(
        map((res) => res.url),
        catchError((error: HttpErrorResponse) => throwError(() => error))
      );
  }

  // envia la postulacion final
  applyAsTeacher(payload: ITeacherApplication): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/apply`, payload)
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => error)));
  }
}