import { Injectable, inject, signal } from '@angular/core';
import { MercadoPagoPaymentService } from './mercadopago-payment.service';
import { AuthService } from './auth.service';
import { InfoService } from './info.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../config/environment';

export interface PaymentRequest {
  courseId: string;
  courseName: string;
  coursePrice: number;
  maxInstallments: number;
  promotionalCode?: string;
  discountAmount?: number;
  discountType?: string;
  finalPrice?: number;
  paymentRequestId?: string;
}

export interface PaymentResult {
  success: boolean;
  initPoint?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PurchasePaymentService {
  private mercadoPagoService = inject(MercadoPagoPaymentService);
  private authService = inject(AuthService);
  private infoService = inject(InfoService);
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/payment`;

  isProcessing = signal<boolean>(false);
  processingError = signal<string | null>(null);

  /**
   * Procesa el pago de un curso
   */
  async processCoursePayment(request: PaymentRequest): Promise<PaymentResult> {
    const user = this.authService.currentUser();

    // Validaciones
    if (!user || !user._id) {
      const error = 'Debes iniciar sesión para realizar la compra';
      this.processingError.set(error);
      return { success: false, error };
    }

    if (!request.courseId) {
      const error = 'Información del curso inválida';
      this.processingError.set(error);
      return { success: false, error };
    }

    if (!request.coursePrice || request.coursePrice <= 0) {
      const error = 'Precio del curso inválido';
      this.processingError.set(error);
      return { success: false, error };
    }

    this.isProcessing.set(true);
    this.processingError.set(null);

    // Extraer nombre y apellido del usuario
    const firstName = user.firstName || 'Usuario';
    const lastName = user.lastName || 'Cursala';

    try {
      // Crear preferencia de pago (con código promocional si existe)
      const response = await this.mercadoPagoService.createCoursePaymentPreference(
        request.courseId,
        request.courseName,
        request.coursePrice,
        request.maxInstallments,
        firstName,
        lastName,
        user.email,
        request.promotionalCode,
        request.discountAmount,
        request.discountType,
        request.paymentRequestId,
        request.finalPrice
      ).toPromise();

      console.log('Respuesta del backend:', response);

      // Verificar respuesta
      if (response?.status === 200 && response?.data) {
        const preferenceData = response.data;
        // El backend ya retorna el initPoint correcto según el modo (sandbox/production)
        const initPoint = preferenceData.initPoint;

        if (initPoint) {
          console.log('MercadoPago mode:', preferenceData.mode);
          console.log('Redirecting to:', initPoint);
          this.isProcessing.set(false);
          return { success: true, initPoint };
        } else {
          const error = 'No se pudo obtener la URL de pago';
          this.processingError.set(error);
          this.isProcessing.set(false);
          return { success: false, error };
        }
      } else {
        const error = 'Error al crear la preferencia de pago';
        this.processingError.set(error);
        this.isProcessing.set(false);
        return { success: false, error };
      }
    } catch (error: any) {
      console.error('Error creating payment preference:', error);
      const errorMessage = error?.error?.message || 'Error al procesar el pago. Por favor, intenta nuevamente.';
      this.processingError.set(errorMessage);
      this.isProcessing.set(false);
      this.infoService.showError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Valida y crea un payment request en el backend
   * Endpoint backend: POST /payment/requests/validate-create
   * Retorna: { paymentRequestId, finalPrice }
   */
  async validateAndCreatePaymentRequest(request: PaymentRequest): Promise<{ paymentRequestId: string; finalPrice: number } | null> {
    const user = this.authService.currentUser();
    if (!user) {
      this.processingError.set('Debes iniciar sesión para continuar');
      return null;
    }

    const payload: any = {
      courseId: request.courseId,
      courseName: request.courseName,
      coursePrice: request.coursePrice,
      studentName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || request.courseName,
      studentEmail: user.email || undefined,
      promotionalCode: request.promotionalCode
    };

    try {
      const resp: any = await this.http.post(`${this.apiUrl}/requests/validate-create`, payload).toPromise();
      // El backend debería devolver { status: 201, data: { paymentRequestId, finalPrice } }
      if (resp && (resp.status === 201 || resp.status === 200) && resp.data) {
        const data = resp.data;
        return { paymentRequestId: data.paymentRequestId, finalPrice: data.finalPrice };
      }

      // Manejo alternativo: si la respuesta es directa
      if (resp && resp.paymentRequestId && typeof resp.finalPrice === 'number') {
        return { paymentRequestId: resp.paymentRequestId, finalPrice: resp.finalPrice };
      }

      this.processingError.set('Respuesta inválida del servidor al validar el pago');
      return null;
    } catch (err: any) {
      const msg = err?.error?.message || 'Error al validar la solicitud de pago';
      this.processingError.set(msg);
      this.infoService.showError(msg);
      return null;
    }
  }

  /**
   * Resetea el estado del servicio
   */
  reset(): void {
    this.isProcessing.set(false);
    this.processingError.set(null);
  }
}
