import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../config/environment';

// urls que devuelve el backend luego de subir los archivos
export interface ITeacherUploadUrls {
  photo?: string;
  cv?: string;
  signature?: string;
}

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
  private readonly apiUrl = environment.apiUrl;

  // sube los 3 archivos juntos (photo, cv, signature) en un solo request y devuelve sus urls
  uploadDocuments(files: { photo?: File; cv?: File; signature?: File }): Observable<ITeacherUploadUrls> {
    const formData = new FormData();
    if (files.photo) formData.append('photo', files.photo);
    if (files.cv) formData.append('cv', files.cv);
    if (files.signature) formData.append('signature', files.signature);

    return this.http
      .post<{ data?: { urls?: ITeacherUploadUrls } }>(`${this.apiUrl}/user/teacher/apply/upload`, formData)
      .pipe(
        map((res) => res?.data?.urls ?? {}),
        catchError((error: HttpErrorResponse) => throwError(() => error))
      );
  }

  // envia la postulacion final
  applyAsTeacher(payload: ITeacherApplication): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/teacher/apply`, payload)
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => error)));
  }
}
