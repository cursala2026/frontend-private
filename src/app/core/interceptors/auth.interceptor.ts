import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';

/**
 * Interceptor HTTP que agrega automáticamente el token JWT
 * a todas las peticiones salientes y maneja errores de autenticación
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Si hay token, clonamos la request y agregamos el header Authorization
  if (token) {
    // Verificar si el token está expirado antes de hacer la petición
    if (authService.checkTokenExpired()) {
      // Token expirado, limpiar sesión
      authService.logout();
      return throwError(() => new HttpErrorResponse({ 
        status: 401, 
        statusText: 'Token expired',
        error: { message: 'Token expirado' }
      }));
    }

    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return next(clonedRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // Si recibimos un 401 (Unauthorized), el token puede estar expirado
        if (error.status === 401) {
          // Verificar si el error es por token expirado
          if (isTokenExpiredError(error)) {
            // Limpiar la sesión automáticamente
            authService.logout();
          }
        }
        return throwError(() => error);
      })
    );
  }

  // Si no hay token, enviamos la request original
  return next(req);
};

/**
 * Verifica si el error es por token expirado
 */
function isTokenExpiredError(error: HttpErrorResponse): boolean {
  // El backend puede devolver diferentes mensajes para token expirado
  const message = error.error?.message || error.message || '';
  const lowerMessage = message.toLowerCase();
  
  return (
    lowerMessage.includes('token expired') ||
    lowerMessage.includes('token expirado') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('no autenticado')
  );
}
