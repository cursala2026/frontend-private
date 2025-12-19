import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, BehaviorSubject, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../config/environment';
import { LoginRequest, LoginResponse, AuthState } from '../models/auth.interface';
import { IUser } from '../models/user.interface';
import { UserRole } from '../models/user-role.enum';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'token';
  private readonly USER_KEY = 'user';
  private readonly apiUrl = environment.apiUrl;

  // Signals para estado reactivo
  private userSignal = signal<IUser | null>(this.getUserFromStorage());
  private tokenSignal = signal<string | null>(this.getTokenFromStorage());

  // Computed signals
  public isAuthenticated = computed(() => !!this.tokenSignal());
  public currentUser = computed(() => this.userSignal());

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Sincronizar con localStorage al iniciar
    this.initializeAuth();
  }

  /**
   * Inicializa el estado de autenticación desde localStorage
   */
  private initializeAuth(): void {
    const token = this.getTokenFromStorage();
    const user = this.getUserFromStorage();

    if (token && user) {
      this.tokenSignal.set(token);
      this.userSignal.set(user);
    }
  }

  /**
   * Realiza el login del usuario
   */
  login(username: string, password: string): Observable<LoginResponse> {
    const loginData: LoginRequest = {
      user: username,
      password: password
    };

    // El backend envuelve la respuesta en { status, message, data }
    // Extraemos `data` (que contiene { token, userInfo }) antes de setear la sesión
    return this.http.post<any>(`${this.apiUrl}/login`, loginData).pipe(
      map((resp: any) => resp.data as LoginResponse),
      switchMap((response: LoginResponse) => {
        this.setSession(response);
        // Normalizar roles antes de resolver la observable para que la UI pueda redirigir por rol
        // Después de normalizar (observable void) emitimos el `response` original.
        return this.normalizeRolesIfNeeded(response).pipe(
          map(() => response)
        );
      })
    );
  }

  /**
   * Los roles ahora son strings directamente, no necesitan normalización
   */
  private normalizeRolesIfNeeded(authResult: LoginResponse): Observable<void> {
    // Roles ya vienen como strings del backend (e.g., ['ADMIN', 'PROFESOR'])
    return of(void 0);
  }

  /**
   * Guarda la sesión del usuario
   */
  private setSession(authResult: LoginResponse): void {
    localStorage.setItem(this.TOKEN_KEY, authResult.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(authResult.userInfo));

    this.tokenSignal.set(authResult.token);
    this.userSignal.set(authResult.userInfo);
  }

  /**
   * Cierra la sesión del usuario
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);

    this.tokenSignal.set(null);
    this.userSignal.set(null);

    this.router.navigate(['/login']);
  }

  /**
   * Obtiene el token actual
   */
  getToken(): string | null {
    return this.tokenSignal();
  }

  /**
   * Obtiene el token desde localStorage
   */
  private getTokenFromStorage(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Obtiene el usuario desde localStorage
   */
  private getUserFromStorage(): IUser | null {
    const userJson = localStorage.getItem(this.USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  }

  /**
   * Obtiene el usuario actual del backend
   */
  getCurrentUserFromBackend(): Observable<IUser> {
    // El endpoint devuelve { message, user }
    return this.http.get<any>(`${this.apiUrl}/current-user`).pipe(
      map((resp: any) => resp.user as IUser),
      tap(user => {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.userSignal.set(user);
      })
    );
  }

  /**
   * Registra un nuevo usuario en el backend.
   * No inicia sesión automáticamente; retorna la respuesta del backend.
   */
  register(user: Partial<IUser>): Observable<any> {
    // El backend espera un body con los campos del usuario (email, password, firstName, lastName, etc.)
    return this.http.post<any>(`${this.apiUrl}/register`, user).pipe(
      map((resp: any) => resp.data || resp)
    );
  }

  /**
   * Inicia el proceso de restablecimiento de contraseña (envía email con token).
   * Retorna la respuesta del backend (por ejemplo `expiresIn`).
   */
  initiateResetPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-password/initiate`, { email }).pipe(
      map((resp: any) => resp.data || resp)
    );
  }

  /**
   * Completa el restablecimiento de contraseña con el `token` recibido por email.
   */
  completeResetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-password/complete`, { token, newPassword }).pipe(
      map((resp: any) => resp.data || resp)
    );
  }

  /**
   * Verifica si el usuario tiene un rol específico
   */
  hasRole(roleCode: UserRole): boolean {
    const user = this.currentUser();
    if (!user || !user.roles) return false;

    // Roles ahora son strings directamente (e.g., 'ADMIN', 'PROFESOR', 'ALUMNO')
    return user.roles.some((role: any) => {
      if (typeof role === 'string') {
        return role.toUpperCase() === roleCode;
      }
      return false;
    });
  }

  /**
   * Verifica si el usuario tiene alguno de los roles especificados
   */
  hasAnyRole(roleCodes: UserRole[]): boolean {
    return roleCodes.some(roleCode => this.hasRole(roleCode));
  }

  /**
   * Obtiene los códigos de los roles del usuario
   */
  getUserRoles(): string[] {
    const user = this.currentUser();
    if (!user || !user.roles) return [];

    // Roles ahora son strings directamente
    return user.roles
      .map((role: any) => (typeof role === 'string' ? role : ''))
      .filter(Boolean);
  }

  /**
   * Verifica si el usuario tiene una feature específica
   */
  hasFeature(featureName: string): boolean {
    const user = this.currentUser();
    if (!user || !user.features) return false;

    return user.features.some(feature => feature.name === featureName);
  }

  /**
   * Verifica si el usuario es administrador
   */
  isAdmin(): boolean {
    return this.hasRole(UserRole.ADMIN);
  }

  /**
   * Verifica si el usuario es profesor
   */
  isProfesor(): boolean {
    return this.hasRole(UserRole.PROFESOR);
  }

  /**
   * Verifica si el usuario es alumno
   */
  isAlumno(): boolean {
    return this.hasRole(UserRole.ALUMNO);
  }
}
