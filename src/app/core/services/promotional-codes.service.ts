import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface PromotionalCode {
  _id?: string;
  code: string;
  name?: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  isGlobal?: boolean;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  usedCount?: number;
  minimumPurchaseAmount?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PromotionalCodesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  getPromotionalCodes(params?: any): Observable<any> {
    return this.http.get(`${this.base}/promotional-codes`, { params });
  }

  getPromotionalCode(id: string): Observable<any> {
    return this.http.get(`${this.base}/promotional-codes/${id}`);
  }

  createPromotionalCode(payload: PromotionalCode): Observable<any> {
    return this.http.post(`${this.base}/promotional-codes`, payload);
  }

  updatePromotionalCode(id: string, payload: Partial<PromotionalCode>): Observable<any> {
    // Usar PATCH directamente — el backend ahora soporta PATCH en esta ruta
    return this.http.patch(`${this.base}/promotional-codes/${id}`, payload);
  }

  deletePromotionalCode(id: string): Observable<any> {
    return this.http.delete(`${this.base}/promotional-codes/${id}`);
  }

  // Validation endpoint used by frontend when needed
  validateCode(code: string, courseId: string, originalPrice: number): Observable<any> {
    return this.http.post(`${this.base}/promotional-codes/validate`, { code, courseId, originalPrice });
  }
}
