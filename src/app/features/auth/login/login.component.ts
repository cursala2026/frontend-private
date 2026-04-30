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

  loginForm: FormGroup;
  errorMessage = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  // mostrar/ocultar contraseña
  showPassword = signal<boolean>(false);
  // forzar enmascarado manual en dispositivos problemáticos (p. ej. Xiaomi)
  useManualMask = signal<boolean>(false);
  private returnUrl: string = '/dashboard';
  private courseId: string | null = null;

  constructor() {
    // Si ya está autenticado, redirigir al dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
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
    // disable form controls to avoid using [disabled] attribute on form controls
    try { this.loginForm.disable(); } catch (e) { /* ignore */ }
    this.errorMessage.set(null);

    const { username, password } = this.loginForm.value;

    this.authService.login(username, password).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        try { this.loginForm.enable(); } catch (e) { /* ignore */ }

        // Redirigir según el rol del usuario
        this.redirectByRole();
      },
      error: (error) => {
        this.isLoading.set(false);
        try { this.loginForm.enable(); } catch (e) { /* ignore */ }

        // Manejar diferentes tipos de errores
        if (error.status === 401) {
          this.errorMessage.set('Usuario o contraseña incorrectos.');
          //this.info.showError('Usuario o contraseña incorrectos.');
        } else if (error.status === 429) {
          this.errorMessage.set('Demasiados intentos. Por favor, intenta más tarde.');
          //this.info.showError('Demasiados intentos. Por favor, intenta más tarde.');
        } else {
          this.errorMessage.set('Error al iniciar sesión. Por favor, intenta nuevamente.');
          //this.info.showError('Error al iniciar sesión. Por favor, intenta nuevamente.');
        }
      }
    });
  }

  /**
   * Redirige al usuario según su rol
   */
  private redirectByRole(): void {
    if (this.courseId && this.authService.isAlumno()) {
      this.router.navigate(['/alumno/course-detail', this.courseId]);
      return;
    }

    if (this.authService.isAdmin()) {
      this.router.navigate(['/admin']);
    } else if (this.authService.hasRole(UserRole.VENDEDOR)) {
      this.router.navigate(['/vendedor']);
    } else if (this.authService.isProfesor()) {
      this.router.navigate(['/profesor']);
    } else if (this.authService.isAlumno()) {
      this.router.navigate(['/alumno']);
    } else {
      this.router.navigate([this.returnUrl]);
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
