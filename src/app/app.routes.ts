import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard, vendedorGuard, profesorGuard, alumnoGuard, profesorOrAdminInProfesorModeGuard } from './core/guards/role.guard';
import { interestsFormGuard } from './core/guards/interests-form.guard';
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
  {
    path: 'certificate/:verificationCode',
    loadComponent: () => import('./features/public/certificate-view/certificate-view.component').then(m => m.CertificateViewComponent)
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
        loadComponent: () => import('./features/admin/users/users.component').then(m => m.UsersComponent)
      },
      {
        path: 'courses',
        loadComponent: () => import('./features/admin/courses/courses.component').then(m => m.CoursesComponent)
      },
      {
        path: 'bank-accounts',
        loadComponent: () => import('./features/admin/bank-accounts/bank-accounts.component').then(m => m.BankAccountsComponent)
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/admin/categories/categories.component').then(m => m.AdminCategoriesComponent)
      },
      {
        path: 'public-data',
        loadComponent: () => import('./features/admin/public-data/public-data.component').then(m => m.PublicDataComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'promotional-codes',
        loadComponent: () => import('./features/admin/promotional-codes/promotional-codes.component').then(m => m.PromotionalCodesComponent)
      },
      {
        path: 'roles',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'support-tickets',
        loadComponent: () => import('./features/admin/support-tickets/support-tickets.component').then(m => m.SupportTicketsComponent)
      }
    ]
  },

  // Rutas de Vendedor (con sidebar layout simple)
  {
    path: 'vendedor',
    canActivate: [authGuard, vendedorGuard],
    loadComponent: () => import('./shared/layouts/vendedor-layout/vendedor-layout.component').then(m => m.VendedorLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full'
      },
      {
        path: 'users',
        loadComponent: () => import('./features/vendedor/users/vendedor-users.component').then(m => m.VendedorUsersComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      }
    ]
  },

  // Rutas de Profesor (con navbar layout)
  {
    path: 'profesor',
    canActivate: [authGuard, profesorOrAdminInProfesorModeGuard],
    loadComponent: () => import('./shared/layouts/teacher-layout/teacher-layout.component').then(m => m.TeacherLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/profesor/dashboard/profesor-dashboard.component').then(m => m.ProfesorDashboardComponent)
      },
      {
        path: 'courses',
        loadComponent: () => import('./features/profesor/courses/teacher-courses.component').then(m => m.TeacherCoursesComponent)
      },
      {
        path: 'courses/:courseId/edit',
        loadComponent: () => import('./features/profesor/courses/course-edit/course-edit.component').then(m => m.CourseEditComponent)
      },
      {
        path: 'classes',
        loadComponent: () => import('./features/profesor/classes/teacher-classes.component').then(m => m.TeacherClassesComponent)
      },
      {
        path: 'classes/new',
        loadComponent: () => import('./features/profesor/classes/class-edit/class-edit.component').then(m => m.TeacherClassEditComponent)
      },
      {
        path: 'classes/:id/edit',
        loadComponent: () => import('./features/profesor/classes/class-edit/class-edit.component').then(m => m.TeacherClassEditComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'students',
        loadComponent: () => import('./features/profesor/students/teacher-students.component').then(m => m.TeacherStudentsComponent)
      },
      {
        path: 'questionnaires',
        loadComponent: () => import('./features/profesor/questionnaires/teacher-questionnaires.component').then(m => m.TeacherQuestionnairesComponent)
      },
      {
        path: 'questionnaires/new',
        loadComponent: () => import('./features/profesor/questionnaires/questionnaire-edit/questionnaire-edit.component').then(m => m.QuestionnaireEditComponent)
      },
      {
        path: 'questionnaires/:id/edit',
        loadComponent: () => import('./features/profesor/questionnaires/questionnaire-edit/questionnaire-edit.component').then(m => m.QuestionnaireEditComponent)
      },
      {
        path: 'questionnaires/:id/results',
        loadComponent: () => import('./features/profesor/questionnaires/questionnaire-results/questionnaire-results.component').then(m => m.QuestionnaireResultsComponent)
      },
      {
        path: 'course-interests',
        loadComponent: () => import('./modules/alumno/components/course-interests/course-interests')
          .then(m => m.CourseInterestsComponent)
      },
      {
        path: 'report-issue',
        loadComponent: () => import('./features/report-issue/report-issue.component').then(m => m.ReportIssueComponent)
      }
    ]
  },

  // Rutas de Alumno (con navbar layout)
  {
  path: 'alumno',
  canActivate: [authGuard, alumnoGuard],
  loadComponent: () => import('./shared/layouts/student-layout/student-layout.component')
    .then(m => m.StudentLayoutComponent),
  children: [
    {
      path: '',
      canActivate: [interestsFormGuard], // ← agregá esto
      loadComponent: () => import('./features/alumno/dashboard/alumno-dashboard.component')
        .then(m => m.AlumnoDashboardComponent)
    },
    // ... resto de rutas
  ]
  },

  // Ruta wildcard - redirige al login si no encuentra la ruta
  {
    path: '**',
    redirectTo: '/login'
  }
];
