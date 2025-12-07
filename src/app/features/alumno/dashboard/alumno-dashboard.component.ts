import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-alumno-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alumno-dashboard.component.html',
  
})
export class AlumnoDashboardComponent {
  private authService = inject(AuthService);
  user = this.authService.currentUser;
}
