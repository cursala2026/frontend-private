import { Component, inject, input, output, computed, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { PurchasePaymentService } from '../../../core/services/purchase-payment.service';
import { PromotionalCodesService } from '../../../core/services/promotional-codes.service';
import { AuthService } from '../../../core/services/auth.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-purchase-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './purchase-modal.component.html'
})
export class PurchaseModalComponent {
  private purchasePaymentService = inject(PurchasePaymentService);
  private promotionalCodesService = inject(PromotionalCodesService);
  private authService = inject(AuthService);
  private infoService = inject(InfoService);

  isOpen = input.required<boolean>();
  courseId = input.required<string>();
  courseName = input<string>('');
  coursePrice = input<number>(0);
  maxInstallments = input<number>(12);

  onCancel = output<void>();
  onTransferSelected = output<void>();

  // Estado del método de pago seleccionado
  selectedPaymentMethod = signal<'mercadopago' | 'transfer' | null>(null);

  // Estado de código promocional
  promoCode = signal<string>('');
  promoValidating = signal<boolean>(false);
  promoValid = signal<boolean>(false);
  promoError = signal<string | null>(null);
  promoData = signal<{ discountAmount: number; finalPrice: number; discountType: string } | null>(null);
  // ID del paymentRequest reservado por el backend (si aplica)
  promoRequestId = signal<string | null>(null);

  // Exponer señales del servicio
  isProcessing = computed(() => this.purchasePaymentService.isProcessing());
  processingError = computed(() => this.purchasePaymentService.processingError());
  currentUser = this.authService.currentUser;

  // Precio final considerando descuento
  finalPrice = computed(() => {
    const promo = this.promoData();
    return promo ? promo.finalPrice : this.coursePrice();
  });

  selectPaymentMethod(method: 'mercadopago' | 'transfer'): void {
    this.selectedPaymentMethod.set(method);
  }

  cancel(): void {
    if (!this.isProcessing()) {
      this.purchasePaymentService.reset();
      this.selectedPaymentMethod.set(null);
      this.resetPromoCode();
      this.onCancel.emit();
    }
  }

  validatePromoCode(): void {
    const code = this.promoCode().trim();
    if (!code) {
      this.promoError.set('Por favor ingresa un código promocional');
      return;
    }

    this.promoValidating.set(true);
    this.promoError.set(null);

    this.promotionalCodesService.validateCode(code, this.courseId(), this.coursePrice()).subscribe({
      next: (response: any) => {
        // La API devuelve la data dentro de response.data
        const validationData = response.data || response;
        const isValid = validationData.isValid;

        if (isValid) {
          this.promoValid.set(true);
          // Normalizar código a mayúsculas en la UI
          this.promoCode.set(code.toUpperCase());

          // Calcular precio final y descuento
          const original = this.coursePrice();
          let final: number;
          let discountAmount: number;

          // Priorizar finalPrice de la respuesta
          if (typeof validationData.finalPrice === 'number') {
            final = validationData.finalPrice;
            discountAmount = original - final;
          }
          // Si viene discountAmount directo
          else if (typeof validationData.discountAmount === 'number') {
            discountAmount = validationData.discountAmount;
            final = Math.max(0, original - discountAmount);
          }
          // Calcular basado en discountValue y tipo del código promocional
          else if (validationData.promotionalCode && typeof validationData.promotionalCode.discountValue === 'number') {
            if (validationData.promotionalCode.discountType === 'FIXED') {
              discountAmount = validationData.promotionalCode.discountValue;
              final = Math.max(0, original - discountAmount);
            } else {
              // PERCENTAGE
              discountAmount = Math.round((original * validationData.promotionalCode.discountValue) / 100);
              final = Math.max(0, original - discountAmount);
            }
          }
          // Si no hay descuento
          else {
            final = original;
            discountAmount = 0;
          }

          this.promoData.set({
            discountAmount: discountAmount,
            finalPrice: final,
            discountType: validationData.promotionalCode?.discountType || 'PERCENTAGE'
          });

          this.infoService.showSuccess(`¡Código aplicado! Ahorrás ${this.formatPrice(discountAmount)}`);

          // Intentar reservar/validar la payment request en backend para obtener finalPrice y paymentRequestId
          (async () => {
            try {
              const validation = await this.purchasePaymentService.validateAndCreatePaymentRequest({
                courseId: this.courseId(),
                courseName: this.courseName(),
                coursePrice: this.coursePrice(),
                maxInstallments: this.maxInstallments(),
                promotionalCode: this.promoCode()
              } as any);
              if (validation) {
                // Guardar el paymentRequestId para usarlo luego
                this.promoRequestId.set(validation.paymentRequestId || null);
                const finalFromServer = typeof validation.finalPrice === 'number' ? validation.finalPrice : final;
                const computedDiscount = this.coursePrice() - finalFromServer;
                this.promoData.set({
                  discountAmount: computedDiscount,
                  finalPrice: finalFromServer,
                  discountType: response.discountType || 'PERCENTAGE'
                });
              }
            } catch (e) {
              // No bloquear la experiencia si falla la reserva; ya mostramos el descuento localmente
              console.warn('No se pudo reservar paymentRequest en backend al aplicar código', e);
            }
          })();
        } else {
          this.promoValid.set(false);
          this.promoError.set(validationData.message || response.message || 'El código promocional no es válido o ha expirado');
        }
        this.promoValidating.set(false);
      },
      error: (err) => {
        console.error('Error validating promo code:', err);
        this.promoValid.set(false);
        const errorMsg = err?.error?.message || err?.message;
        if (errorMsg?.toLowerCase().includes('expired') || errorMsg?.toLowerCase().includes('expirado')) {
          this.promoError.set('Este código promocional ha expirado');
        } else if (errorMsg?.toLowerCase().includes('not found') || errorMsg?.toLowerCase().includes('no encontrado')) {
          this.promoError.set('Código promocional no encontrado');
        } else if (errorMsg?.toLowerCase().includes('already used') || errorMsg?.toLowerCase().includes('ya usado')) {
          this.promoError.set('Este código ya ha sido utilizado');
        } else {
          this.promoError.set(errorMsg || 'No se pudo validar el código. Intenta nuevamente');
        }
        this.promoValidating.set(false);
      }
    });
  }

  resetPromoCode(): void {
    this.promoCode.set('');
    this.promoValid.set(false);
    this.promoError.set(null);
    this.promoData.set(null);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  }

  async proceedToPayment(): Promise<void> {
    const promo = this.promoData();

    // Si ya reservamos un paymentRequest al aplicar el código, reutilizarlo
    let validation: { paymentRequestId?: string; finalPrice?: number } | null = null;
    if (this.promoValid() && this.promoRequestId()) {
      validation = { paymentRequestId: this.promoRequestId() ?? undefined, finalPrice: this.promoData()?.finalPrice };
    } else {
      // Primero validar/crear payment request en el backend para obtener finalPrice
      const validationRequest = {
        courseId: this.courseId(),
        courseName: this.courseName(),
        coursePrice: this.coursePrice(),
        maxInstallments: this.maxInstallments(),
        promotionalCode: this.promoValid() ? this.promoCode().trim().toUpperCase() : undefined
      };

      validation = await this.purchasePaymentService.validateAndCreatePaymentRequest(validationRequest as any);
      if (!validation) {
        // El servicio ya puso el error en el estado
        return;
      }
      // Guardar si vino un paymentRequestId
      if (validation.paymentRequestId) {
        this.promoRequestId.set(validation.paymentRequestId);
      }
    }

    if (!validation) {
      return;
    }

    const final = typeof validation.finalPrice === 'number' ? validation.finalPrice : (promo?.finalPrice ?? this.coursePrice());
    const discountAmount = this.coursePrice() - final;

    // Actualizar el estado local del promo para que la UI muestre el precio aplicado
    this.promoValid.set(true);
    this.promoData.set({
      discountAmount: typeof promo?.discountAmount === 'number' ? promo!.discountAmount : discountAmount,
      finalPrice: final,
      discountType: promo?.discountType || 'PERCENTAGE'
    });

    const result = await this.purchasePaymentService.processCoursePayment({
      courseId: this.courseId(),
      courseName: this.courseName(),
      coursePrice: this.coursePrice(),
      maxInstallments: this.maxInstallments(),
      promotionalCode: this.promoValid() ? this.promoCode().trim().toUpperCase() : undefined,
      discountAmount: typeof promo?.discountAmount === 'number' ? promo!.discountAmount : discountAmount,
      discountType: promo?.discountType,
      finalPrice: final,
      paymentRequestId: validation.paymentRequestId
    });

    if (result.success && result.initPoint) {
      window.location.href = result.initPoint;
    }
    // Si hay error, el servicio ya lo maneja
  }

  proceedWithTransfer(): void {
    this.onTransferSelected.emit();
  }
}
