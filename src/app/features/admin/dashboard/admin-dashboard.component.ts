import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../core/config/environment';

interface RecentUser {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  roles: string[];
}

interface SystemStats {
  totalUsers: number;
  totalCourses: number;
  totalCategories: number;
  totalPromotionalCodes: number;
  activePromotionalCodes: number;
  recentUsers: RecentUser[];
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

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;

    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getRoleBadgeClass(roles: string[]): string {
    if (roles.includes('ADMIN')) return 'bg-purple-100 text-purple-800';
    if (roles.includes('PROFESOR')) return 'bg-blue-100 text-blue-800';
    if (roles.includes('ALUMNO')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  }

  getRoleLabel(roles: string[]): string {
    if (roles.includes('ADMIN')) return 'Admin';
    if (roles.includes('PROFESOR')) return 'Profesor';
    if (roles.includes('ALUMNO')) return 'Alumno';
    return 'Usuario';
  }
}
