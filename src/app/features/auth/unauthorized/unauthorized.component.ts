import { Component } from '@angular/core';

import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [],
  templateUrl: './unauthorized.component.html',
  
})
export class UnauthorizedComponent {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  goBack(): void {
    // Usar logout centralizado para limpiar sesión y redirigir al login
    this.authService.logout();
  }
}
