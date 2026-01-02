import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MercadoPagoPaymentService } from '../../../core/services/mercadopago-payment.service';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payment-success.component.html'
})
export class PaymentSuccessComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private mercadoPagoService = inject(MercadoPagoPaymentService);
  private redirectTimeout?: any;

  loading = signal<boolean>(true);
  paymentVerified = signal<boolean>(false);
  externalReference = signal<string | null>(null);
  paymentId = signal<string | null>(null);
  collectionId = signal<string | null>(null);
  collectionStatus = signal<string | null>(null);
  courseId = signal<string | null>(null);
  redirectCountdown = signal<number>(5);

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

      // Extraer courseId del external_reference (formato: course_ID_timestamp)
      if (externalRef) {
        const parts = externalRef.split('_');
        if (parts.length >= 2) {
          this.courseId.set(parts[1]);
        }
      }

      // Si tenemos el ID del pago, verificar el estado
      const paymentIdToCheck = paymentIdParam || collectionIdParam;
      if (paymentIdToCheck) {
        this.verifyPayment(paymentIdToCheck);
      } else {
        // Si no hay ID de pago, simplemente mostrar mensaje genérico
        this.loading.set(false);
        this.paymentVerified.set(true);
        this.startRedirectCountdown();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.redirectTimeout) {
      clearTimeout(this.redirectTimeout);
    }
  }

  verifyPayment(paymentId: string): void {
    this.mercadoPagoService.getPaymentStatus(paymentId).subscribe({
      next: (response: any) => {
        const paymentData = response?.data;
        if (paymentData && (paymentData.status === 'approved' || paymentData.status === 'authorized')) {
          this.paymentVerified.set(true);
        }
        this.loading.set(false);
        this.startRedirectCountdown();
      },
      error: (error) => {
        console.error('Error verifying payment:', error);
        // Asumir que está bien aunque falle la verificación
        this.paymentVerified.set(true);
        this.loading.set(false);
        this.startRedirectCountdown();
      }
    });
  }

  startRedirectCountdown(): void {
    const interval = setInterval(() => {
      const current = this.redirectCountdown();
      if (current > 0) {
        this.redirectCountdown.set(current - 1);
      } else {
        clearInterval(interval);
        this.redirectToCourse();
      }
    }, 1000);
  }

  redirectToCourse(): void {
    const courseId = this.courseId();
    if (courseId) {
      this.router.navigate(['/alumno/course-detail', courseId]);
    } else {
      this.goToCourses();
    }
  }

  goToCourses(): void {
    this.router.navigate(['/alumno/courses']);
  }

  goToHome(): void {
    this.router.navigate(['/alumno']);
  }
}
