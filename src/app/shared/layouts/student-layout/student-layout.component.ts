import { Component, signal, inject, HostListener, computed, effect } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BunnyConfigService } from '../../../core/services/bunny-config.service';

interface MenuItem {
  label: string;
  route: string;
}

@Component({
  selector: 'app-student-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './student-layout.component.html',
  
})
export class StudentLayoutComponent {
  protected authService = inject(AuthService);
  private router = inject(Router);
  private bunnyConfigService = inject(BunnyConfigService);

  isMobileMenuOpen = signal<boolean>(false);
  isUserMenuOpen = signal<boolean>(false);
  imageError = signal<boolean>(false);
  user = this.authService.currentUser;

  constructor() {
    // Resetear error al cambiar el usuario
    effect(() => {
      this.user();
      this.imageError.set(false);
    });
  }

  menuItems: MenuItem[] = [
    {
      label: 'Mis Cursos',
      route: '/alumno/courses'
    },
    {
      label: 'Mis Certificados',
      route: '/alumno/certificates'
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
    this.router.navigate(['/alumno/profile']);
    this.closeUserMenu();
  }

  goToReportIssue(): void {
    this.router.navigate(['/alumno/report-issue']);
    this.closeUserMenu();
  }

  logout(): void {
    this.authService.logout();
    this.closeUserMenu();
  }

  isActiveRoute(route: string): boolean {
    return this.router.url === route;
  }

  // URL computada robusta y genérica
  userProfileImageUrl = computed(() => {
    const currentUser = this.user();
    return this.bunnyConfigService.convertStorageToCdnUrl(
      currentUser?.profilePhotoUrl, 
      currentUser?.updatedAt
    );
  });

  onImageError(event: Event): void {
    const url = this.userProfileImageUrl();
    console.warn(`StudentLayout: Error cargando imagen de perfil (${url})`);
    
    // Solo reintentar una vez
    if (!this.imageError()) {
      setTimeout(() => {
        this.imageError.set(false);
      }, 1000);
    }
    
    this.imageError.set(true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      this.closeUserMenu();
    }
  }
}


