import { Component, signal, inject, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ViewModeService } from '../../../core/services/view-mode.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private viewModeService = inject(ViewModeService);
  private platformId = inject(PLATFORM_ID);

  isSidebarOpen = signal<boolean>(false);
  isUserMenuOpen = signal<boolean>(false);
  user = this.authService.currentUser;

  private resizeListener?: () => void;

  constructor() {
    // Detectar si es móvil y ajustar el sidebar
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = window.innerWidth < 1024; // lg breakpoint en Tailwind
      this.isSidebarOpen.set(!isMobile);

      // Crear listener para cambios de tamaño de ventana
      this.resizeListener = () => {
        const mobile = window.innerWidth < 1024;
        if (!mobile) {
          // En desktop, abrir el sidebar
          this.isSidebarOpen.set(true);
        } else {
          // En móvil, cerrar el sidebar
          this.isSidebarOpen.set(false);
        }
      };

      window.addEventListener('resize', this.resizeListener);
    }
  }

  ngOnInit(): void {
    // Asegurar que el modo de vista esté inicializado
    this.viewModeService.initializeViewMode();
  }

  ngOnDestroy(): void {
    // Limpiar el event listener al destruir el componente
    if (this.resizeListener && isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeListener);
    }
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
    {
      label: 'Categorías',
      icon: 'M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z',
      route: '/admin/categories'
    },
    {
      label: 'Datos Bancarios',
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      route: '/admin/bank-accounts'
    },
    {
      label: 'Datos Públicos',
      icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      route: '/admin/public-data'
    },
    {
      label: 'Códigos Promocionales',
      icon: 'M5 13c0 3.87 3.13 7 7 7s7-3.13 7-7-3.13-7-7-7S5 9.13 5 13zm7-9c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2z',
      route: '/admin/promotional-codes'
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

  switchToProfesorMode(): void {
    this.viewModeService.setViewMode('profesor');
    this.isUserMenuOpen.set(false);
    this.router.navigate(['/profesor']);
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
