import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UsersService } from '../services/users.service';
import { UserRole } from '../models/user-role.enum';
import { map, of, catchError } from 'rxjs';

export const interestsFormGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const usersService = inject(UsersService);
  const router = inject(Router);

  const user = authService.currentUser();
  
  if (!user) {
    return true; 
  }

  // Solo aplica a alumnos
  if (!authService.hasRole(UserRole.ALUMNO)) {
    return true;
  }

  // 1. Verificación rápida por Signal
  const hasCompletedSignal = user?.hasCompletedInterestsForm === true ||
                              (user as any)?.meta?.hasCompletedInterestsForm === true ||
                              (user as any)?.meta?.hasCompletedInterests === true ||
                              (user as any)?.interests?.length > 0;

  if (hasCompletedSignal) {
    if (state.url.includes('/course-interests')) {
      return router.createUrlTree(['/alumno']);
    }
    return true;
  }

  // 2. Consulta al backend con tolerancia a errores (si da 404, dejamos pasar)
  return usersService.getInterestStatus(user._id).pipe(
    map((response: any) => {
      const hasCompletedBackend = response?.data?.hasCompleted === true;
      if (hasCompletedBackend) {
        return state.url.includes('/course-interests') ? router.createUrlTree(['/alumno']) : true;
      }
      return state.url.includes('/course-interests') ? true : router.createUrlTree(['/alumno', 'course-interests']);
    }),
    catchError(() => {
      // En caso de error (404 o red), permitimos el acceso por defecto para no bloquear al usuario
      return of(true);
    })
  );
};