import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  isSidebarOpen = signal<boolean>(true);
  isUserMenuOpen = signal<boolean>(false);
  user = this.authService.currentUser;

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

  menuItems = [
    {
      label: 'Dashboard',
      icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
      route: '/admin'
    },
    {
      label: 'Usuarios',
      icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
      route: '/admin/users'
    },
    {
      label: 'Cursos',
      icon: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z',
      route: '/admin/courses'
    },
  ];

  toggleSidebar(): void {
    this.isSidebarOpen.update(value => !value);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update(value => !value);
  }

  navigateToProfile(): void {
    this.router.navigate(['/admin/profile']);
    this.isUserMenuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  isActiveRoute(route: string): boolean {
    const currentUrl = this.router.url;
    // Para rutas exactas
    if (currentUrl === route) return true;
    // Para rutas que empiezan con el path (para rutas anidadas)
    if (route !== '/admin' && currentUrl.startsWith(route)) return true;
    return false;
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }
}
