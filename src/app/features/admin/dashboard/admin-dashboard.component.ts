import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../core/config/environment';

interface SystemStats {
  totalUsers: number;
  totalCourses: number;
  totalCategories: number;
  totalPromotionalCodes: number;
  activePromotionalCodes: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  
  user = this.authService.currentUser;
  stats = signal<SystemStats | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<any>(`${environment.apiUrl}/adminSecurity/system-stats`).subscribe({
      next: (response) => {
        this.stats.set(response.data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading stats:', err);
        this.error.set('Error al cargar las estadísticas');
        this.loading.set(false);
      }
    });
  }
}
