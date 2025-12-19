import { Component, signal, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

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
export class TeacherLayoutComponent {
  protected authService = inject(AuthService);
  private router = inject(Router);

  isMobileMenuOpen = signal<boolean>(false);
  isUserMenuOpen = signal<boolean>(false);
  user = this.authService.currentUser;

  menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      route: '/profesor'
    },
    {
      label: 'Mis Cursos',
      route: '/profesor/courses'
    },
    {
      label: 'Calificaciones',
      route: '/profesor/grades'
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



