import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface MercadoPagoPreferenceData {
  items: Array<{
    id: string;
    title: string;
    description: string;
    quantity: number;
    currency_id: string;
    unit_price: number;
  }>;
  payer: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: {
      area_code: string;
      number: string;
    };
    identification?: {
      type: string;
      number: string;
    };
  };
  paymentMethods?: {
    installments?: number;
    excluded_payment_types?: any[];
    excluded_payment_methods?: any[];
  };
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  auto_return?: string;
  externalReference: string;
  notificationUrl?: string;
  metadata?: any;
}

export interface MercadoPagoPreferenceResponse {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
}

export interface PaymentStatus {
  id: string;
  status: string;
  status_detail: string;
  amount: number;
  external_reference: string;
  date_created: string;
  payer: {
    email: string;
    id: string;
  };
}

export interface RegisterPaymentData {
  paymentId: string;
  courseId: string;
  studentEmail: string;
  amount: number;
  externalReference: string;
}

@Injectable({
  providedIn: 'root'
})
export class MercadoPagoPaymentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/payment`;

  /**
   * Crea una preferencia de pago en Mercado Pago
   */
  createPaymentPreference(data: MercadoPagoPreferenceData): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-preference`, data);
  }

  /**
   * Obtiene el estado de un pago
   */
  getPaymentStatus(paymentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/status/${paymentId}`);
  }

  /**
   * Obtiene los detalles completos de un pago
   */
  getPaymentDetails(paymentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/details/${paymentId}`);
  }

  /**
   * Registra un pago exitoso manualmente
   */
  registerSuccessfulPayment(data: RegisterPaymentData): Observable<any> {
    return this.http.post(`${this.apiUrl}/register-success`, data);
  }

  /**
   * Crea una preferencia de pago para un curso (con soporte para códigos promocionales)
   */
  createCoursePaymentPreference(
    courseId: string,
    courseName: string,
    coursePrice: number,
    maxInstallments: number,
    studentFirstName: string,
    studentLastName: string,
    studentEmail: string,
    promotionalCode?: string,
    discountAmount?: number,
    discountType?: string,
    paymentRequestId?: string,
    finalPrice?: number
  ): Observable<any> {
    const timestamp = Date.now();
    // Considerar que existe promo cuando hay un código (incluso si discountAmount es 0)
    const hasPromo = !!promotionalCode;
    const actualPrice = typeof finalPrice === 'number' ? finalPrice : coursePrice;
    
    // External reference incluye código promocional si existe
    let externalReference = `course_${courseId}_${studentEmail}_${timestamp}`;
    if (hasPromo) {
      externalReference += `_PROMO_${promotionalCode}`;
    }

    const preferenceData: MercadoPagoPreferenceData = {
      items: [
        {
          id: courseId,
          title: courseName,
          description: `Acceso completo al curso: ${courseName}`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: actualPrice
        }
      ],
      payer: {
        first_name: studentFirstName,
        last_name: studentLastName,
        email: studentEmail
      },
      paymentMethods: {
        installments: maxInstallments,
        excluded_payment_types: [],
        excluded_payment_methods: []
      },
      backUrls: {
        success: `${window.location.origin}/alumno/payment/success`,
        failure: `${window.location.origin}/alumno/payment/failure`,
        pending: `${window.location.origin}/alumno/payment/pending`
      },
      externalReference: externalReference,
      metadata: {
        ...(hasPromo ? {
          promotionalCode: promotionalCode,
          originalPrice: coursePrice,
          discountAmount: typeof discountAmount === 'number' ? discountAmount : (coursePrice - actualPrice),
          discountType: discountType,
          finalPrice: actualPrice
        } : {}),
        ...(paymentRequestId ? { paymentRequestId } : {})
      }
      // notificationUrl: se omite para que el backend use WEBHOOK_URL (ngrok) automáticamente
    };

    return this.createPaymentPreference(preferenceData);
  }

  /**
   * Obtiene estadísticas de pagos de Mercado Pago
   */
  getPaymentStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`);
  }

  /**
   * Obtiene lista de todos los pagos de Mercado Pago
   */
  getAllPayments(limit: number = 50): Observable<any> {
    return this.http.get(`${this.apiUrl}/all?limit=${limit}`);
  }

  /**
   * Elimina pagos antiguos
   */
  // bulk delete removed per UI change

  /**
   * Elimina un pago específico
   */
  deletePayment(paymentId: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/payment/${paymentId}`);
  }
}
