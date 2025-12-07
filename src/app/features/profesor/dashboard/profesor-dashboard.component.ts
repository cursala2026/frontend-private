import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-profesor-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profesor-dashboard.component.html',
  
})
export class ProfesorDashboardComponent {
  private authService = inject(AuthService);
  user = this.authService.currentUser;
}
