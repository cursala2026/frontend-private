import { Component, inject, input, output, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-transfer-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transfer-modal.component.html'
})
export class TransferModalComponent implements OnInit {
  isOpen = input.required<boolean>();
  amount = input<number>(0);
  onClose = output<void>();

  bankAccount = signal<{ cbu: string; alias: string } | null>(null);
  loading = signal<boolean>(true);

  ngOnInit(): void {
    // Usar datos hardcodeados por ahora, ya que el endpoint requiere permisos de admin
    this.bankAccount.set({
      cbu: '0000000000000000000000',
      alias: 'CURSALA.PAGO'
    });
    this.loading.set(false);
  }

  close(): void {
    this.onClose.emit();
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  }
}