import { Component, inject, input, output, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromotionalCodesService } from '../../../core/services/promotional-codes.service';
import { InfoService } from '../../../core/services/info.service';
import { BankAccountService } from '../../../core/services/bank-account.service';

@Component({
  selector: 'app-transfer-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transfer-modal.component.html'
})
export class TransferModalComponent implements OnInit {
  private promotionalCodesService = inject(PromotionalCodesService);
  private infoService = inject(InfoService);
  private bankAccountService = inject(BankAccountService);

  isOpen = input.required<boolean>();
  amount = input<number>(0);
  courseId = input<string>('');
  onClose = output<void>();
  onPromoApplied = output<{ code: string; discountAmount: number; finalPrice: number; discountType: string }>();

  bankAccount = signal<{ cbu: string; alias: string } | null>(null);
  loading = signal<boolean>(true);

  // Estado de código promocional
  promoCode = signal<string>('');
  promoValidating = signal<boolean>(false);
  promoValid = signal<boolean>(false);
  promoError = signal<string | null>(null);
  promoData = signal<{ discountAmount: number; finalPrice: number; discountType: string } | null>(null);

  // Precio final considerando descuento
  finalAmount = computed(() => {
    const promo = this.promoData();
    return promo ? promo.finalPrice : this.amount();
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.bankAccountService.getPublicStudentBankAccounts().subscribe({
      next: (res) => {
        const list = res?.data || [];
        const first = list.length ? list[0] : null;
        if (first) {
          this.bankAccount.set({ cbu: first.cbu, alias: first.alias });
        } else {
          this.bankAccount.set(null);
          this.infoService.showError('Error al cargar datos bancarios. Intente nuevamente.');
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error fetching public bank accounts:', err);
        this.infoService.showError('Error al cargar datos bancarios. Intente nuevamente.');
        this.bankAccount.set(null);
        this.loading.set(false);
      }
    });
  }

  close(): void {
    this.resetPromoCode();
    this.onClose.emit();
  }

  validatePromoCode(): void {
    const code = this.promoCode().trim();
    if (!code) {
      this.promoError.set('Ingresa un código promocional');
      return;
    }

    if (!this.courseId()) {
      this.promoError.set('Error: ID de curso no disponible');
      return;
    }

    this.promoValidating.set(true);
    this.promoError.set(null);

    this.promotionalCodesService.validateCode(code, this.courseId(), this.amount()).subscribe({
      next: (response: any) => {
        if (response.isValid) {
          this.promoValid.set(true);
          // Normalizar código a mayúsculas en la UI
          this.promoCode.set(code.toUpperCase());
          const original = this.amount();
          const discountAmount = typeof response.discountAmount === 'number' ? response.discountAmount : undefined;
          let final = typeof response.finalPrice === 'number' ? response.finalPrice : undefined;
          if (final === undefined) {
            if (typeof discountAmount === 'number') {
              final = Math.max(0, original - discountAmount);
            } else if (typeof response.discountValue === 'number') {
              if (response.discountType === 'FIXED') {
                final = Math.max(0, original - response.discountValue);
              } else {
                final = Math.max(0, original - (original * response.discountValue) / 100);
              }
            } else {
              final = original;
            }
          }
          const promoInfo = {
            discountAmount: discountAmount ?? (original - final),
            finalPrice: final,
            discountType: response.discountType || 'PERCENTAGE'
          };
          this.promoData.set(promoInfo);
          this.onPromoApplied.emit({ code: code.toUpperCase(), ...promoInfo });
          this.infoService.showSuccess('¡Código aplicado correctamente!');
        } else {
          this.promoValid.set(false);
          this.promoError.set(response.message || 'Código inválido');
        }
        this.promoValidating.set(false);
      },
      error: (err) => {
        console.error('Error validating promo code:', err);
        this.promoValid.set(false);
        this.promoError.set(err?.error?.message || 'Error al validar el código');
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
}