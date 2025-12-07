import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface MenuItem {
  label: string;
  route: string;
  roles: string[]; // Roles que pueden ver este item
}

@Component({
  selector: 'app-student-teacher-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './student-teacher-layout.component.html',
  
})
export class StudentTeacherLayoutComponent {
  protected authService = inject(AuthService);
  private router = inject(Router);

  isMobileMenuOpen = signal<boolean>(false);
  user = this.authService.currentUser;

  menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      route: this.authService.isProfesor() ? '/profesor' : '/alumno',
      roles: ['PROFESOR', 'ALUMNO']
    },
    {
      label: 'Mis Cursos',
      route: this.authService.isProfesor() ? '/profesor/courses' : '/alumno/courses',
      roles: ['PROFESOR', 'ALUMNO']
    },
    {
      label: 'Calificaciones',
      route: this.authService.isProfesor() ? '/profesor/grades' : '/alumno/grades',
      roles: ['PROFESOR', 'ALUMNO']
    }
  ];


  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(value => !value);
  }

  logout(): void {
    this.authService.logout();
  }

  isActiveRoute(route: string): boolean {
    return this.router.url === route;
  }

  getVisibleMenuItems(): MenuItem[] {
    const userRoles = this.authService.getUserRoles();
    return this.menuItems.filter(item =>
      item.roles.some(role => userRoles.includes(role))
    );
  }
}
