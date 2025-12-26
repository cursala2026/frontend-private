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
  externalReference: string;
  notificationUrl?: string;
  metadata?: any;
}

export interface MercadoPagoPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
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
  private apiUrl = `${environment.apiUrl}/payment/payments`;

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
   * Crea una preferencia de pago para un curso
   */
  createCoursePaymentPreference(
    courseId: string,
    courseName: string,
    coursePrice: number,
    maxInstallments: number,
    studentFirstName: string,
    studentLastName: string,
    studentEmail: string
  ): Observable<any> {
    const timestamp = Date.now();
    const externalReference = `course_${courseId}_${timestamp}`;

    const preferenceData: MercadoPagoPreferenceData = {
      items: [
        {
          id: courseId,
          title: courseName,
          description: `Acceso completo al curso: ${courseName}`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: coursePrice
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
        success: `${window.location.origin}/alumno/payment/success?external_reference=${externalReference}`,
        failure: `${window.location.origin}/alumno/payment/failure?external_reference=${externalReference}`,
        pending: `${window.location.origin}/alumno/payment/pending?external_reference=${externalReference}`
      },
      externalReference: externalReference,
      notificationUrl: `${environment.apiUrl}/payment/payments/webhook`
    };

    return this.createPaymentPreference(preferenceData);
  }
}
