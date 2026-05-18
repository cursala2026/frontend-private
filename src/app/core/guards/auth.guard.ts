import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard que verifica si el usuario está autenticado
 * Si no está autenticado, redirige al login
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Si no está autenticado, redirigir al login solo si no estamos ya en una ruta de auth
  const isAuthRoute = state.url.includes('/login') || state.url.includes('/register') || state.url.includes('/reset-password');
  
  if (!isAuthRoute) {
    // Guardar la URL intentada para redirigir después del login
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  return false;
};
