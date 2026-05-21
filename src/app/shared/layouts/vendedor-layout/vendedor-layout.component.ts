import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BunnyConfigService } from '../../../core/services/bunny-config.service';

@Component({
  selector: 'app-vendedor-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './vendedor-layout.component.html',
  styleUrls: ['./vendedor-layout.component.css']
})
export class VendedorLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private bunnyConfigService = inject(BunnyConfigService);

  isSidebarOpen = signal(false);
  imageError = signal(false);
  user = this.authService.currentUser;

  userProfileImageUrl = computed(() => {
    const currentUser = this.user();
    return this.bunnyConfigService.convertStorageToCdnUrl(
      currentUser?.profilePhotoUrl, 
      currentUser?.updatedAt
    );
  });

  toggleSidebar(): void {
    this.isSidebarOpen.update(v => !v);
  }

  onMenuItemClick(): void {
    if (window.innerWidth < 1024) {
      this.isSidebarOpen.set(false);
    }
  }

  onImageError(): void {
    this.imageError.set(true);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
