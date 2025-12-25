import { Component, signal, inject, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ViewModeService } from '../../../core/services/view-mode.service';
import { UserRole } from '../../../core/models/user-role.enum';

interface MenuItem {
  label: string;
  route: string;
}

@Component({
  selector: 'app-teacher-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './teacher-layout.component.html',
  
})
export class TeacherLayoutComponent implements OnInit {
  protected authService = inject(AuthService);
  private router = inject(Router);
  private viewModeService = inject(ViewModeService);

  isMobileMenuOpen = signal<boolean>(false);
  isUserMenuOpen = signal<boolean>(false);
  user = this.authService.currentUser;

  ngOnInit(): void {
    // Asegurar que el modo de vista esté inicializado
    this.viewModeService.initializeViewMode();
  }

  // Verificar si el usuario es admin
  get isAdmin(): boolean {
    return this.authService.hasRole(UserRole.ADMIN);
  }

  menuItems: MenuItem[] = [
    {
      label: 'Mis Cursos',
      route: '/profesor/courses'
    },
    {
      label: 'Mis Clases',
      route: '/profesor/classes'
    },
    {
      label: 'Mis Cuestionarios',
      route: '/profesor/questionnaires'
    },
    {
      label: 'Mis Alumnos',
      route: '/profesor/students'
    }
  ];


  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(value => !value);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update(value => !value);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  goToProfile(): void {
    this.router.navigate(['/profesor/profile']);
    this.closeUserMenu();
  }

  switchToAdminMode(): void {
    this.viewModeService.setViewMode('admin');
    this.router.navigate(['/admin']);
    this.closeUserMenu();
  }

  logout(): void {
    this.authService.logout();
    this.closeUserMenu();
  }

  isActiveRoute(route: string): boolean {
    return this.router.url === route;
  }

  // Getter para construir la URL completa de la imagen de perfil
  get userProfileImageUrl(): string | null {
    const currentUser = this.user();
    if (!currentUser?.profilePhotoUrl) return null;
    
    const photoUrl = currentUser.profilePhotoUrl;
    
    // Si ya es una URL completa, devolverla tal cual
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return photoUrl;
    }
    
    // Si solo es el nombre del archivo, construir la URL de Bunny CDN
    // Codificar el nombre del archivo para manejar caracteres especiales
    const encodedFileName = encodeURIComponent(photoUrl);
    return `https://cursala.b-cdn.net/profile-images/${encodedFileName}`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      this.closeUserMenu();
    }
  }
}



