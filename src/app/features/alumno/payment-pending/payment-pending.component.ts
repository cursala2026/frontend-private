import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-payment-pending',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payment-pending.component.html'
})
export class PaymentPendingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  externalReference = signal<string | null>(null);
  paymentId = signal<string | null>(null);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.externalReference.set(params['external_reference']);
      this.paymentId.set(params['payment_id'] || params['collection_id']);
    });
  }

  goToCourses(): void {
    this.router.navigate(['/alumno/courses']);
  }

  goToHome(): void {
    this.router.navigate(['/alumno']);
  }
}
