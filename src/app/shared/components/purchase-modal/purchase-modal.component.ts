import { Component, signal, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MercadoPagoPaymentService } from '../../../core/services/mercadopago-payment.service';
import { AuthService } from '../../../core/services/auth.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-purchase-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-modal.component.html'
})
export class PurchaseModalComponent {
  private mercadoPagoService = inject(MercadoPagoPaymentService);
  private authService = inject(AuthService);
  private infoService = inject(InfoService);

  isOpen = input.required<boolean>();
  courseId = input.required<string>();
  courseName = input<string>('');
  coursePrice = input<number>(0);
  maxInstallments = input<number>(12);

  onCancel = output<void>();

  isProcessing = signal<boolean>(false);
  processingError = signal<string | null>(null);

  currentUser = this.authService.currentUser;

  cancel(): void {
    if (!this.isProcessing()) {
      this.onCancel.emit();
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  }

  async proceedToPayment(): Promise<void> {
    const user = this.currentUser();
    const courseId = this.courseId();
    const courseName = this.courseName();
    const coursePrice = this.coursePrice();
    const maxInstallments = this.maxInstallments();

    if (!user || !user._id) {
      this.processingError.set('Debes iniciar sesión para realizar la compra');
      return;
    }

    if (!courseId) {
      this.processingError.set('Información del curso inválida');
      return;
    }

    if (!coursePrice || coursePrice <= 0) {
      this.processingError.set('Precio del curso inválido');
      return;
    }

    this.isProcessing.set(true);
    this.processingError.set(null);

    // Extraer nombre y apellido del usuario
    const firstName = user.firstName || 'Usuario';
    const lastName = user.lastName || 'Cursala';

    try {
      // Crear preferencia de pago
      const response = await this.mercadoPagoService.createCoursePaymentPreference(
        courseId,
        courseName,
        coursePrice,
        maxInstallments,
        firstName,
        lastName,
        user.email
      ).toPromise();

      // Verificar respuesta
      if (response?.code === 200 && response?.data) {
        const preferenceData = response.data;
        const initPoint = preferenceData.init_point || preferenceData.sandbox_init_point;

        if (initPoint) {
          // Redirigir a Mercado Pago
          window.location.href = initPoint;
        } else {
          this.processingError.set('No se pudo obtener la URL de pago');
          this.isProcessing.set(false);
        }
      } else {
        this.processingError.set('Error al crear la preferencia de pago');
        this.isProcessing.set(false);
      }
    } catch (error: any) {
      console.error('Error creating payment preference:', error);
      const errorMessage = error?.error?.message || 'Error al procesar el pago. Por favor, intenta nuevamente.';
      this.processingError.set(errorMessage);
      this.isProcessing.set(false);
      this.infoService.showError(errorMessage);
    }
  }
}
