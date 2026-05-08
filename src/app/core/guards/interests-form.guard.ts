import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user-role.enum';

export const interestsFormGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();

  // Solo aplica a alumnos
  if (!authService.hasRole(UserRole.ALUMNO)) {
    return true;
  }

  // Si ya completó el formulario, puede pasar
  if (user?.hasCompletedInterestsForm === true) {
    return true;
  }

  // Si está intentando acceder al formulario, dejarlo pasar
  if (state.url.includes('/course-interests')) {
    return true;
  }

  // Redirigir al formulario de intereses
  router.navigate(['/alumno/course-interests']);
  return false;
};