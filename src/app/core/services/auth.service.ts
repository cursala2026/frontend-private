import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, BehaviorSubject, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../config/environment';
import { LoginRequest, LoginResponse, AuthState } from '../models/auth.interface';
import { IUser } from '../models/user.interface';
import { UserRole } from '../models/user-role.enum';

interface JWTPayload {
  _id?: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {
  private readonly TOKEN_KEY = 'token';
  private readonly USER_KEY = 'user';
  private readonly apiUrl = environment.apiUrl;

  // Signals para estado reactivo
  private userSignal = signal<IUser | null>(this.getUserFromStorage());
  private tokenSignal = signal<string | null>(this.getTokenFromStorage());

  // Computed signals
  public isAuthenticated = computed(() => !!this.tokenSignal());
  public currentUser = computed(() => this.userSignal());

  // Monitoreo del token
  private tokenCheckInterval?: any;
  private lastActivityTime = Date.now();
  private readonly ACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos de inactividad
  private readonly TOKEN_CHECK_INTERVAL = 60 * 1000; // Verificar cada minuto
  private readonly WARNING_TIME_BEFORE_EXPIRY = 5 * 60 * 1000; // Avisar 5 minutos antes de expirar
  private activityListeners: (() => void)[] = [];
  private visibilityListener?: () => void;
  private isPageVisible = true;
  private videoCheckInterval?: any;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Sincronizar con localStorage al iniciar
    this.initializeAuth();
    // Iniciar monitoreo del token
    this.startTokenMonitoring();
    // Iniciar detección de actividad
    this.startActivityDetection();
  }

  ngOnDestroy(): void {
    this.stopTokenMonitoring();
    this.stopActivityDetection();
  }

  /**
   * Inicializa el estado de autenticación desde localStorage
   */
  private initializeAuth(): void {
    const token = this.getTokenFromStorage();
    const user = this.getUserFromStorage();

    if (token && user) {
      // Verificar si el token ya está expirado al iniciar
      if (this.isTokenExpired(token)) {
        this.clearSession();
        return;
      }
      this.tokenSignal.set(token);
      this.userSignal.set(user);
    }
  }

  /**
   * Decodifica un token JWT sin verificar la firma
   */
  private decodeToken(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verifica si el token está expirado
   */
  private isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    // exp está en segundos, Date.now() está en milisegundos
    const expirationTime = decoded.exp * 1000;
    return Date.now() >= expirationTime;
  }

  /**
   * Verifica si el token actual está expirado (método público)
   */
  public checkTokenExpired(): boolean {
    return this.isTokenExpired(this.getToken());
  }

  /**
   * Obtiene el tiempo restante del token en milisegundos
   */
  private getTokenTimeRemaining(token: string | null): number {
    if (!token) return 0;
    
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return 0;
    }

    const expirationTime = decoded.exp * 1000;
    return Math.max(0, expirationTime - Date.now());
  }

  /**
   * Verifica si hay videos reproduciéndose en la página
   */
  private hasPlayingVideos(): boolean {
    try {
      const videos = document.querySelectorAll('video');
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        // Verificar si el video está reproduciéndose y no está pausado
        if (!video.paused && !video.ended && video.currentTime > 0) {
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica si el usuario está activo
   * Considera: interacciones recientes, videos reproduciéndose, o página visible
   */
  private isUserActive(): boolean {
    // Si hay videos reproduciéndose, el usuario está activo
    if (this.hasPlayingVideos()) {
      this.lastActivityTime = Date.now(); // Actualizar tiempo de actividad
      return true;
    }

    // Si la página no está visible, considerar inactivo
    if (!this.isPageVisible) {
      return false;
    }

    // Verificar interacciones recientes
    const timeSinceLastActivity = Date.now() - this.lastActivityTime;
    return timeSinceLastActivity < this.ACTIVITY_TIMEOUT;
  }

  /**
   * Inicia la detección de actividad del usuario
   */
  private startActivityDetection(): void {
    // Eventos de interacción del usuario
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const updateActivity = () => {
      this.lastActivityTime = Date.now();
    };

    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
      this.activityListeners.push(() => {
        document.removeEventListener(event, updateActivity);
      });
    });

    // Detectar visibilidad de la página (Page Visibility API)
    const handleVisibilityChange = () => {
      this.isPageVisible = !document.hidden;
      if (this.isPageVisible) {
        // Si la página se vuelve visible, actualizar tiempo de actividad
        this.lastActivityTime = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.visibilityListener = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };

    // Verificar videos periódicamente (cada 30 segundos)
    this.videoCheckInterval = setInterval(() => {
      if (this.hasPlayingVideos()) {
        this.lastActivityTime = Date.now();
      }
    }, 30 * 1000);
  }

  /**
   * Detiene la detección de actividad
   */
  private stopActivityDetection(): void {
    this.activityListeners.forEach(remove => remove());
    this.activityListeners = [];
    
    if (this.visibilityListener) {
      this.visibilityListener();
      this.visibilityListener = undefined;
    }

    if (this.videoCheckInterval) {
      clearInterval(this.videoCheckInterval);
      this.videoCheckInterval = undefined;
    }
  }

  /**
   * Inicia el monitoreo periódico del token
   */
  private startTokenMonitoring(): void {
    // Verificar inmediatamente
    this.checkTokenExpiration();

    // Verificar periódicamente
    this.tokenCheckInterval = setInterval(() => {
      this.checkTokenExpiration();
    }, this.TOKEN_CHECK_INTERVAL);
  }

  /**
   * Detiene el monitoreo del token
   */
  private stopTokenMonitoring(): void {
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = undefined;
    }
  }

  /**
   * Verifica la expiración del token y actúa en consecuencia
   */
  private checkTokenExpiration(): void {
    const token = this.getToken();
    if (!token) {
      return;
    }

    if (this.isTokenExpired(token)) {
      // Token expirado
      const userActive = this.isUserActive();
      
      if (userActive) {
        // Usuario activo: mostrar aviso y luego limpiar
        this.handleExpiredTokenWithWarning();
      } else {
        // Usuario inactivo: limpiar silenciosamente
        this.clearSession();
      }
      return;
    }

    // Verificar si está por expirar pronto
    const timeRemaining = this.getTokenTimeRemaining(token);
    if (timeRemaining > 0 && timeRemaining <= this.WARNING_TIME_BEFORE_EXPIRY) {
      const userActive = this.isUserActive();
      if (userActive) {
        // Mostrar aviso de que el token expirará pronto
        this.warnTokenExpiringSoon(timeRemaining);
      }
    }
  }

  /**
   * Maneja el token expirado cuando el usuario está activo
   */
  private handleExpiredTokenWithWarning(): void {
    // Mostrar mensaje al usuario
    const message = 'Tu sesión ha expirado por seguridad. Serás redirigido al login.';
    alert(message); // Puedes reemplazar esto con un servicio de notificaciones más elegante
    
    // Limpiar sesión y redirigir
    this.clearSession();
  }

  /**
   * Advierte al usuario que el token expirará pronto
   */
  private warnTokenExpiringSoon(timeRemaining: number): void {
    const minutesRemaining = Math.ceil(timeRemaining / (60 * 1000));
    const message = `Tu sesión expirará en ${minutesRemaining} minuto${minutesRemaining > 1 ? 's' : ''}. Por favor, guarda tu trabajo.`;
    
    // Solo mostrar el aviso una vez para no molestar
    if (!(window as any).__tokenWarningShown) {
      (window as any).__tokenWarningShown = true;
      alert(message); // Puedes reemplazar esto con un servicio de notificaciones más elegante
      
      // Resetear la bandera después de un tiempo
      setTimeout(() => {
        (window as any).__tokenWarningShown = false;
      }, this.WARNING_TIME_BEFORE_EXPIRY);
    }
  }

  /**
   * Limpia la sesión del usuario (localStorage y signals)
   */
  private clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);

    this.tokenSignal.set(null);
    this.userSignal.set(null);

    // Redirigir al login solo si no estamos ya ahí
    if (!this.router.url.includes('/login')) {
      this.router.navigate(['/login']);
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

    // Reiniciar el monitoreo del token con el nuevo token
    this.stopTokenMonitoring();
    this.startTokenMonitoring();
    
    // Resetear la bandera de advertencia
    (window as any).__tokenWarningShown = false;
  }

  /**
   * Cierra la sesión del usuario
   */
  logout(): void {
    this.stopTokenMonitoring();
    this.clearSession();
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
