import { Injectable, inject, signal } from '@angular/core';
import { MercadoPagoPaymentService } from './mercadopago-payment.service';
import { AuthService } from './auth.service';
import { InfoService } from './info.service';

export interface PaymentRequest {
  courseId: string;
  courseName: string;
  coursePrice: number;
  maxInstallments: number;
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
      // Crear preferencia de pago
      const response = await this.mercadoPagoService.createCoursePaymentPreference(
        request.courseId,
        request.courseName,
        request.coursePrice,
        request.maxInstallments,
        firstName,
        lastName,
        user.email
      ).toPromise();

      console.log('Respuesta del backend:', response);

      // Verificar respuesta
      if (response?.status === 200 && response?.data) {
        const preferenceData = response.data;
        const initPoint = preferenceData.initPoint || preferenceData.sandboxInitPoint;

        if (initPoint) {
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
   * Resetea el estado del servicio
   */
  reset(): void {
    this.isProcessing.set(false);
    this.processingError.set(null);
  }
}
