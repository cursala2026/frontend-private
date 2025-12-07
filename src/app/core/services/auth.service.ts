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
   * Si el userInfo.roles son IDs, llama al backend para obtener los códigos y actualiza el user en storage.
   * Devuelve un observable que completa cuando la normalización termina (o inmediatamente si no es necesaria).
   */
  private normalizeRolesIfNeeded(authResult: LoginResponse): Observable<void> {
    const roles = authResult.userInfo?.roles;
    if (!Array.isArray(roles) || roles.length === 0) return of(void 0);
    if (typeof roles[0] === 'string' && /^[0-9a-fA-F]{24}$/.test(roles[0])) {
      const payload = { roleIds: roles };
      return this.http.post<any>(`${this.apiUrl}/getrolesbyids`, payload, {
        headers: { Authorization: `Bearer ${authResult.token}` }
      }).pipe(
        map((resp: any) => resp.data || []),
        map((fetchedRoles: any[]) => {
          const roleCodes = fetchedRoles.map(r => (r.code ? r.code : r));
          const updatedUser = { ...authResult.userInfo, roles: roleCodes } as IUser;
          localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
          this.userSignal.set(updatedUser);
          return void 0;
        })
      );
    }

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
    
    // Si el backend devolvió role IDs (array de strings 24 hex), traducirlos a objetos { code }
    try {
      const roles = authResult.userInfo?.roles;
      if (Array.isArray(roles) && roles.length > 0 && typeof roles[0] === 'string' && /^[0-9a-fA-F]{24}$/.test(roles[0])) {
        // Llamar al endpoint que devuelve roles por id
        const payload = { roleIds: roles };
        // No bloquear el flujo: hacemos la petición y actualizamos el usuario en background
        this.http.post<any>(`${this.apiUrl}/getrolesbyids`, payload, {
          headers: { Authorization: `Bearer ${authResult.token}` }
        }).pipe(map((resp: any) => resp.data)).subscribe({
          next: (fetchedRoles: any[]) => {
            // Convertir a array de códigos o objetos { code }
            const roleCodes = fetchedRoles.map(r => (r.code ? r.code : r));
            const updatedUser = { ...this.userSignal(), roles: roleCodes } as IUser;
            localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
            this.userSignal.set(updatedUser);
          },
          error: () => {
            // Si falla, dejamos los role ids tal cual (no crítico)
          }
        });
      }
    } catch (e) {
      // ignore
    }
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

    // Support roles as objects ({ code: 'ADMIN' }) or strings (either role code 'ADMIN' or role id)
    const DEFAULT_ADMIN_ROLE_ID = '768b59e49b3298289bdbd0fd';

    return user.roles.some((role: any) => {
      if (!role) return false;
      if (typeof role === 'string') {
        // If backend sent role code as string
        if (role.toUpperCase() === roleCode) return true;
        // If backend sent role id, consider default admin id mapping for ADMIN
        if (role === DEFAULT_ADMIN_ROLE_ID && roleCode === UserRole.ADMIN) return true;
        return false;
      }
      if (typeof role === 'object') {
        return role.code === roleCode || role === roleCode;
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

    return user.roles
      .map((role: any) => {
        if (!role) return '';
        if (typeof role === 'string') return role;
        if (typeof role === 'object' && 'code' in role && role.code) return role.code as string;
        return '';
      })
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
