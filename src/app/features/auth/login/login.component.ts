import { Component, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { InfoService } from '../../../core/services/info.service';
import { environment } from '../../../core/config/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgOptimizedImage],
  templateUrl: './login.component.html',
  
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  // mostrar/ocultar contraseña
  showPassword = signal<boolean>(false);
  private returnUrl: string = '/dashboard';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private info: InfoService
  ) {
    // Si ya está autenticado, redirigir al dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }

    // Obtener URL de retorno de los query params
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
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
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
          this.info.showError('Usuario o contraseña incorrectos.');
        } else if (error.status === 429) {
          this.errorMessage.set('Demasiados intentos. Por favor, intenta más tarde.');
          this.info.showError('Demasiados intentos. Por favor, intenta más tarde.');
        } else {
          this.errorMessage.set('Error al iniciar sesión. Por favor, intenta nuevamente.');
          this.info.showError('Error al iniciar sesión. Por favor, intenta nuevamente.');
        }
      }
    });
  }

  /**
   * Redirige al usuario según su rol
   */
  private redirectByRole(): void {
    if (this.authService.isAdmin()) {
      this.router.navigate(['/admin']);
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
