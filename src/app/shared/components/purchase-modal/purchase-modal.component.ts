import { Component, inject, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PurchasePaymentService } from '../../../core/services/purchase-payment.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-purchase-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-modal.component.html'
})
export class PurchaseModalComponent {
  private purchasePaymentService = inject(PurchasePaymentService);
  private authService = inject(AuthService);

  isOpen = input.required<boolean>();
  courseId = input.required<string>();
  courseName = input<string>('');
  coursePrice = input<number>(0);
  maxInstallments = input<number>(12);

  onCancel = output<void>();

  // Exponer señales del servicio
  isProcessing = computed(() => this.purchasePaymentService.isProcessing());
  processingError = computed(() => this.purchasePaymentService.processingError());
  currentUser = this.authService.currentUser;

  cancel(): void {
    if (!this.isProcessing()) {
      this.purchasePaymentService.reset();
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
    const result = await this.purchasePaymentService.processCoursePayment({
      courseId: this.courseId(),
      courseName: this.courseName(),
      coursePrice: this.coursePrice(),
      maxInstallments: this.maxInstallments()
    });

    if (result.success && result.initPoint) {
      // Redirigir a Mercado Pago
      window.location.href = result.initPoint;
    }
    // Si hay error, el servicio ya lo maneja
  }
}
