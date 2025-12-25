import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface Certificate {
  certificateId: string;
  verificationCode: string;
  qrCodeUrl: string;
  studentName: string;
  courseName: string;
  generatedAt: Date;
  generatedBy: string;
}

export interface CertificateCheck {
  exists: boolean;
  certificate: Certificate | null;
}

@Injectable({
  providedIn: 'root'
})
export class CertificateService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/certificate`;

  /**
   * Verifica si existe un certificado para un estudiante y curso
   */
  checkCertificateExists(studentId: string, courseId: string): Observable<{ data: CertificateCheck }> {
    return this.http.get<{ data: CertificateCheck }>(`${this.apiUrl}/check/${studentId}/${courseId}`);
  }

  /**
   * Genera un certificado para un estudiante
   */
  generateCertificate(studentId: string, courseId: string, teacherId: string): Observable<{ data: Certificate }> {
    return this.http.post<{ data: Certificate }>(`${this.apiUrl}/generate`, {
      studentId,
      courseId,
      teacherId
    });
  }

  /**
   * Descarga el certificado en formato PDF
   */
  downloadCertificate(verificationCode: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download/${verificationCode}`, {
      responseType: 'blob'
    });
  }

  /**
   * Obtiene todos los certificados de un estudiante
   */
  getCertificatesByStudent(studentId: string): Observable<{ data: Certificate[] }> {
    return this.http.get<{ data: Certificate[] }>(`${this.apiUrl}/student/${studentId}`);
  }
}

