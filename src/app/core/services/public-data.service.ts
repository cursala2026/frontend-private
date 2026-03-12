import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface PublicData {
  _id: string;
  privacyPolicy: string;
  termsOfService: string;
  certificateLogos?: string[];
  bankAccounts?: Array<{
    _id: string;
    cbu: string;
    alias: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
}

export interface PublicDataResponse {
  status: number;
  message: string;
  data: PublicData[];
}

export interface SinglePublicDataResponse {
  status: number;
  message: string;
  data: PublicData;
}

@Injectable({
  providedIn: 'root'
})
export class PublicDataService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/companySpecificData/company-specific-data`;

  /**
   * Obtiene todos los datos públicos (políticas de privacidad y términos de servicio)
   */
  getAllPublicData(): Observable<PublicDataResponse> {
    return this.http.get<PublicDataResponse>(this.apiUrl);
  }

  /**
   * Actualiza los datos públicos
   */
  updatePublicData(id: string, data: Partial<PublicData>): Observable<SinglePublicDataResponse> {
    return this.http.patch<SinglePublicDataResponse>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Sube un logo institucional para los certificados
   */
  uploadCertificateLogo(id: string, file: File): Observable<SinglePublicDataResponse> {
    const formData = new FormData();
    formData.append('logoFile', file);
    return this.http.post<SinglePublicDataResponse>(`${this.apiUrl}/${id}/certificate-logos`, formData);
  }

  /**
   * Elimina un logo institucional del certificado por su índice
   */
  removeCertificateLogo(id: string, index: number): Observable<SinglePublicDataResponse> {
    return this.http.delete<SinglePublicDataResponse>(`${this.apiUrl}/${id}/certificate-logos/${index}`);
  }
}
