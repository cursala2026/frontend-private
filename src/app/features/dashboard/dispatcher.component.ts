import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user-role.enum';

@Component({
  selector: 'app-dashboard-dispatcher',
  standalone: true,
  template: `<p>Redirigiendo...</p>`,
})
export class DashboardDispatcherComponent implements OnInit {
  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Decide destino según roles
    if (this.auth.isAdmin()) {
      this.router.navigate(['/admin']);
      return;
    }

    if (this.auth.hasRole(UserRole.VENDEDOR)) {
      this.router.navigate(['/vendedor']);
      return;
    }

    if (this.auth.isProfesor()) {
      this.router.navigate(['/profesor']);
      return;
    }

    if (this.auth.isAlumno()) {
      this.router.navigate(['/alumno']);
      return;
    }

    // Fallback: si no hay roles reconocidos, navegar a /alumno
    this.router.navigate(['/alumno']);
  }
}
