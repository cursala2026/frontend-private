import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user-role.enum';

/**
 * Factory function que crea un guard para verificar roles específicos
 * @param allowedRoles - Array de roles permitidos
 */
export const createRoleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Verificar autenticación primero
    if (!authService.isAuthenticated()) {
      router.navigate(['/login'], {
        queryParams: { returnUrl: state.url }
      });
      return false;
    }

    // Verificar si el usuario tiene alguno de los roles permitidos
    if (authService.hasAnyRole(allowedRoles)) {
      return true;
    }

    // Si no tiene el rol, redirigir a página de acceso denegado o dashboard
    router.navigate(['/unauthorized']);
    return false;
  };
};

/**
 * Guard específico para rol ADMIN
 */
export const adminGuard: CanActivateFn = createRoleGuard([UserRole.ADMIN]);

/**
 * Guard específico para rol PROFESOR
 */
export const profesorGuard: CanActivateFn = createRoleGuard([UserRole.PROFESOR]);

/**
 * Guard específico para rol ALUMNO
 */
export const alumnoGuard: CanActivateFn = createRoleGuard([UserRole.ALUMNO]);

/**
 * Guard para PROFESOR o ALUMNO (excluye ADMIN)
 */
export const studentOrTeacherGuard: CanActivateFn = createRoleGuard([
  UserRole.PROFESOR,
  UserRole.ALUMNO
]);
