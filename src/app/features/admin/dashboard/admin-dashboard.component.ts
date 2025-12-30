import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user-role.enum';
import { environment } from '../../../core/config/environment';

interface RecentUser {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  roles: string[];
  profilePhotoUrl?: string;
}

interface SystemStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalCourses: number;
  totalCategories: number;
  totalPromotionalCodes: number;
  activePromotionalCodes: number;
  recentUsers: RecentUser[];
  usersByMonth?: Array<{ month: string; count: number }>;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
    if (roles.includes('ADMIN')) return 'bg-brand-primary/10 text-brand-primary';
    if (roles.includes('PROFESOR')) return 'bg-brand-secondary/20 text-brand-secondary-text';
    if (roles.includes('ALUMNO')) return 'bg-brand-primary-dark/10 text-brand-primary-dark';
    return 'bg-gray-100 text-gray-800';
  }

  getRoleLabel(roles: string[]): string {
    if (roles.includes('ADMIN')) return 'Admin';
    if (roles.includes('PROFESOR')) return 'Profesor';
    if (roles.includes('ALUMNO')) return 'Alumno';
    return 'Usuario';
  }

  getMaxCount(): number {
    const usersByMonth = this.stats()?.usersByMonth;
    if (!usersByMonth || usersByMonth.length === 0) return 1;
    return Math.max(...usersByMonth.map(item => item.count), 1);
  }

  getBarHeight(count: number): number {
    const maxCount = this.getMaxCount();
    if (maxCount === 0) return 0;
    return (count / maxCount) * 100;
  }

  hasUsersByMonth(): boolean {
    const usersByMonth = this.stats()?.usersByMonth;
    return !!usersByMonth && usersByMonth.length > 0;
  }

  getUsersByMonth(): Array<{ month: string; count: number }> {
    return this.stats()?.usersByMonth || [];
  }

  getUserPhotoUrl(user: RecentUser): string | null {
    return user.profilePhotoUrl || null;
  }

  getUserInitials(user: RecentUser): string {
    return (user.firstName?.charAt(0) || '') + (user.lastName?.charAt(0) || '');
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement;
    if (fallback) {
      fallback.style.display = 'flex';
    }
  }

  // Exponer UserRole para usar en el template
  UserRole = UserRole;
}
