import { Component, signal, OnInit, inject } from '@angular/core';
import { PasswordFieldComponent } from '../../../shared/components/password-field/password-field.component';
import { NgOptimizedImage } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { InfoService } from '../../../core/services/info.service';
import { UserRole } from '../../../core/models/user-role.enum';
import { environment } from '../../../core/config/environment';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterModule, NgOptimizedImage, PasswordFieldComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private info = inject(InfoService);

  loginForm!: FormGroup;
  errorMessage = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  // mostrar/ocultar contraseña
  showPassword = signal<boolean>(false);
  // forzar enmascarado manual en dispositivos problemáticos (p. ej. Xiaomi)
  useManualMask = signal<boolean>(false);
  private returnUrl: string = '/dashboard';
  private courseId: string | null = null;

  constructor() {
    // Si ya está autenticado y el token es válido, redirigir
    if (this.authService.isAuthenticated()) {
      if (this.authService.checkTokenExpired()) {
        this.authService.logout();
      } else {
        const user = this.authService.currentUser();
        if (user) {
          const callbackUrl: string | undefined = this.route.snapshot.queryParams['callbackUrl'];
          if (callbackUrl) {
            const token = localStorage.getItem('token') || localStorage.getItem('access_token');
            const isProduction = window.location.hostname.endsWith('cursala.com.ar');
            const publicBaseUrl = isProduction ? 'https://cursala.com.ar' : 'http://localhost:3002';
            const targetUrl = callbackUrl.startsWith('http') ? callbackUrl : `${publicBaseUrl}${callbackUrl}`;

            const urlObj = new URL(targetUrl);
            if (token) {
              urlObj.searchParams.set('token', token);
            }
            window.location.href = urlObj.toString();
            return;
          }
          this.router.navigate(['/dashboard']);
          return;
        }
      }
    }

    // Obtener parámetros de los query params
    this.courseId = this.route.snapshot.queryParams['courseId'] || null;
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';

    // Si venimos desde registro, mostrar mensaje de éxito
    if (this.route.snapshot.queryParams['registered'] === '1') {
      this.info.showSuccess('Registro exitoso. Por favor inicia sesión.');
    }

    // Inicializar formulario
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });

    // Detectar dispositivos que necesitan enmascarado manual (ej: ciertos Xiaomi/MIUI)
    try {
      this.useManualMask.set(this.detectManualMaskNeeded());
    } catch (e) {
      this.useManualMask.set(false);
    }
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  /**
   * Detecta user agents conocidos por mostrar texto/controles nativos problemáticos
   * y devuelve true si se debe aplicar enmascarado manual (usar `type=text` + CSS).
   */
  private detectManualMaskNeeded(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = (navigator.userAgent || navigator.vendor || '').toLowerCase();

    // Heurísticos: Xiaomi / Redmi / MIUI suelen contener estas marcas en el UA.
    if (/xiaomi|redmi|miui|mi\s|mi-/i.test(ua)) return true;

    // Fallback: Android + Chrome + manufacturer hints
    if (/android/.test(ua) && /chrome/.test(ua) && /mi|xiaomi|redmi/.test(ua)) return true;

    return false;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.errorMessage.set('Por favor, completa todos los campos correctamente.');
      return;
    }
    this.isLoading.set(true);
    try { this.loginForm.disable(); } catch (e) { /* ignore */ }
    this.errorMessage.set(null);

    const { username, password } = this.loginForm.value;

    this.authService.login(username, password).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        try { this.loginForm.enable(); } catch (e) { /* ignore */ }

        // 1. Verificar si venía con callbackUrl
        const callbackUrl: string | undefined = this.route.snapshot.queryParams['callbackUrl'];
        if (callbackUrl) {
          const token = localStorage.getItem('token') || localStorage.getItem('access_token');
          const isProduction = window.location.hostname.endsWith('cursala.com.ar');
          const publicBaseUrl = isProduction ? 'https://cursala.com.ar' : 'http://localhost:3002';
          const targetUrl = callbackUrl.startsWith('http') ? callbackUrl : `${publicBaseUrl}${callbackUrl}`;

          const urlObj = new URL(targetUrl);
          if (token) {
            urlObj.searchParams.set('token', token);
          }
          window.location.href = urlObj.toString();
          return;
        }

        // 2. Si no hay callbackUrl, sigue el flujo estándar por rol
        this.redirectByRole();
      },
      error: (error) => {
        this.isLoading.set(false);
        try { this.loginForm.enable(); } catch (e) { /* ignore */ }

        if (error.status === 401) {
          this.errorMessage.set('Usuario o contraseña incorrectos.');
        } else if (error.status === 429) {
          this.errorMessage.set('Demasiados intentos. Por favor, intenta más tarde.');
        } else {
          this.errorMessage.set(`Error al iniciar sesión (${error.status || 'Conexión'}). Por favor, intenta nuevamente.`);
        }
      }
    });
  }

  /**
   * Redirige al usuario según su rol
   */
  private redirectByRole(): void {
    const isAdmin = this.authService.isAdmin();
    const isVendedor = this.authService.hasRole(UserRole.VENDEDOR);
    const isProfesor = this.authService.isProfesor();
    const isAlumno = this.authService.isAlumno();
    const roles = this.authService.getUserRoles();

    if (this.courseId && isAlumno) {
      this.router.navigate(['/alumno/course-detail', this.courseId]);
      return;
    }

    if (isAdmin) {
      this.router.navigate(['/admin']);
    } else if (isVendedor) {
      this.router.navigate(['/vendedor']);
    } else if (isProfesor) {
      this.router.navigate(['/profesor']);
    } else if (isAlumno) {
      this.router.navigate(['/alumno']);
    } else {
      this.redirectByFirstRole(roles);
    }
  }

  /**
   * Intenta redirigir al primer rol disponible
   */
  private redirectByFirstRole(roles: string[]): void {
    if (roles && roles.length > 0) {
      const firstRole = roles[0].toLowerCase();
      this.router.navigate([`/${firstRole}`]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  goToPublicFrontend(): void {
    window.location.href = environment.publicFrontend;
  }

  /**
   * Verifica si un campo del formulario tiene errores
   */
  hasError(fieldName: string, errorType: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.hasError(errorType) && (field.dirty || field.touched));
  }
}