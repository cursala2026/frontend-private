import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard, profesorGuard, alumnoGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Ruta raíz - redirige al login
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },

  // Rutas públicas
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dispatcher.component').then(m => m.DashboardDispatcherComponent)
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./features/auth/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
  },

  // Rutas de Admin (con sidebar layout)
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./shared/layouts/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'courses',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'roles',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      }
    ]
  },

  // Rutas de Profesor (con navbar layout)
  {
    path: 'profesor',
    canActivate: [authGuard, profesorGuard],
    loadComponent: () => import('./shared/layouts/student-teacher-layout/student-teacher-layout.component').then(m => m.StudentTeacherLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/profesor/dashboard/profesor-dashboard.component').then(m => m.ProfesorDashboardComponent)
      },
      {
        path: 'courses',
        loadComponent: () => import('./features/profesor/dashboard/profesor-dashboard.component').then(m => m.ProfesorDashboardComponent)
      },
      {
        path: 'grades',
        loadComponent: () => import('./features/profesor/dashboard/profesor-dashboard.component').then(m => m.ProfesorDashboardComponent)
      }
    ]
  },

  // Rutas de Alumno (con navbar layout)
  {
    path: 'alumno',
    canActivate: [authGuard, alumnoGuard],
    loadComponent: () => import('./shared/layouts/student-teacher-layout/student-teacher-layout.component').then(m => m.StudentTeacherLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/alumno/dashboard/alumno-dashboard.component').then(m => m.AlumnoDashboardComponent)
      },
      {
        path: 'courses',
        loadComponent: () => import('./features/alumno/dashboard/alumno-dashboard.component').then(m => m.AlumnoDashboardComponent)
      },
      {
        path: 'grades',
        loadComponent: () => import('./features/alumno/dashboard/alumno-dashboard.component').then(m => m.AlumnoDashboardComponent)
      }
    ]
  },

  // Ruta wildcard - redirige al login si no encuentra la ruta
  {
    path: '**',
    redirectTo: '/login'
  }
];
