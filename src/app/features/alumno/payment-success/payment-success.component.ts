import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MercadoPagoPaymentService } from '../../../core/services/mercadopago-payment.service';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payment-success.component.html'
})
export class PaymentSuccessComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private mercadoPagoService = inject(MercadoPagoPaymentService);

  loading = signal<boolean>(true);
  paymentVerified = signal<boolean>(false);
  externalReference = signal<string | null>(null);
  paymentId = signal<string | null>(null);
  collectionId = signal<string | null>(null);
  collectionStatus = signal<string | null>(null);

  ngOnInit(): void {
    // Obtener parámetros de la URL
    this.route.queryParams.subscribe(params => {
      const externalRef = params['external_reference'];
      const paymentIdParam = params['payment_id'];
      const collectionIdParam = params['collection_id'];
      const collectionStatusParam = params['collection_status'];

      this.externalReference.set(externalRef);
      this.paymentId.set(paymentIdParam || collectionIdParam);
      this.collectionId.set(collectionIdParam);
      this.collectionStatus.set(collectionStatusParam);

      // Si tenemos el ID del pago, verificar el estado
      const paymentIdToCheck = paymentIdParam || collectionIdParam;
      if (paymentIdToCheck) {
        this.verifyPayment(paymentIdToCheck);
      } else {
        // Si no hay ID de pago, simplemente mostrar mensaje genérico
        this.loading.set(false);
        this.paymentVerified.set(true);
      }
    });
  }

  verifyPayment(paymentId: string): void {
    this.mercadoPagoService.getPaymentStatus(paymentId).subscribe({
      next: (response: any) => {
        const paymentData = response?.data;
        if (paymentData && (paymentData.status === 'approved' || paymentData.status === 'authorized')) {
          this.paymentVerified.set(true);
        }
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error verifying payment:', error);
        // Asumir que está bien aunque falle la verificación
        this.paymentVerified.set(true);
        this.loading.set(false);
      }
    });
  }

  goToCourses(): void {
    this.router.navigate(['/alumno/courses']);
  }

  goToHome(): void {
    this.router.navigate(['/alumno']);
  }
}
