import { Component, OnInit, OnDestroy } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-vendedor-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './vendedor-layout.component.html',
  styleUrls: ['./vendedor-layout.component.css']
})
export class VendedorLayoutComponent implements OnInit, OnDestroy {
  isSidebarOpen = false; // Cerrado por defecto en móvil

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebarOnMobile(): void {
    // En móvil, cerrar sidebar al hacer click en un enlace
    if (window.innerWidth < 1024) {
      this.isSidebarOpen = false;
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
