import { Component, inject, input, output, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-transfer-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center transition-opacity duration-300"
        (click)="close()">
        <div class="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100"
             (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-lg">
            <h2 class="text-xl font-bold text-white">Pago por Transferencia</h2>
          </div>

          <!-- Body -->
          <div class="px-6 py-6">
            <p class="text-gray-700 mb-4">
              Realiza una transferencia bancaria a la siguiente cuenta. Una vez realizado el pago, envía el comprobante a nuestro soporte.
            </p>

            <!-- Datos bancarios -->
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h3 class="font-semibold text-gray-800 mb-3">Datos para la Transferencia</h3>
              @if (loading()) {
                <p class="text-sm text-gray-600">Cargando datos bancarios...</p>
              } @else if (bankAccount()) {
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="font-medium text-gray-600">Banco:</span>
                    <span class="text-gray-800">Banco Nación</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="font-medium text-gray-600">CBU:</span>
                    <span class="text-gray-800 font-mono">{{ bankAccount()!.cbu }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="font-medium text-gray-600">Alias:</span>
                    <span class="text-gray-800 font-mono">{{ bankAccount()!.alias }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="font-medium text-gray-600">Titular:</span>
                    <span class="text-gray-800">Cursala S.A.</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="font-medium text-gray-600">CUIT:</span>
                    <span class="text-gray-800">00-00000000-0</span>
                  </div>
                </div>
              } @else {
                <p class="text-sm text-red-600">Error al cargar datos bancarios. Intente nuevamente.</p>
              }
            </div>

            <!-- Monto a transferir -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div class="flex justify-between items-center">
                <span class="text-gray-700 font-medium">Monto a transferir:</span>
                <span class="text-2xl font-bold text-blue-600">{{ formatPrice(amount()) }}</span>
              </div>
            </div>

            <!-- Instrucciones -->
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h4 class="font-semibold text-yellow-800 mb-2">Instrucciones:</h4>
              <ol class="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                <li>Realiza la transferencia desde tu cuenta bancaria</li>
                <li>Toma captura del comprobante de pago</li>
                <li>Envía el comprobante a <a href="mailto:soporte@cursala.com.ar" class="underline">soporte@cursala.com.ar</a></li>
                <li>Tu acceso será activado en 24-48 horas hábiles</li>
              </ol>
            </div>

            <!-- Información de contacto -->
            <p class="text-xs text-gray-500 text-center">
              ¿Necesitas ayuda? Contactanos a soporte@cursala.com.ar
            </p>
          </div>

          <!-- Footer -->
          <div class="border-t border-gray-200 px-6 py-4 flex justify-end bg-gray-50 rounded-b-lg">
            <button
              (click)="close()"
              class="cursor-pointer px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    }
  `
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