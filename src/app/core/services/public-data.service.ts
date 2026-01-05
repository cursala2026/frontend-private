import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface PublicData {
  _id: string;
  privacyPolicy: string;
  termsOfService: string;
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
}
