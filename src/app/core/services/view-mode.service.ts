import { Injectable, signal } from '@angular/core';

export type ViewMode = 'admin' | 'profesor';

@Injectable({
  providedIn: 'root'
})
export class ViewModeService {
  // Signal para el modo de vista actual
  private currentViewMode = signal<ViewMode>('admin');

  /**
   * Obtiene el modo de vista actual
   */
  getCurrentViewMode(): ViewMode {
    return this.currentViewMode();
  }

  /**
   * Signal reactivo del modo de vista
   */
  get viewMode() {
    return this.currentViewMode.asReadonly();
  }

  /**
   * Cambia el modo de vista
   */
  setViewMode(mode: ViewMode): void {
    this.currentViewMode.set(mode);
    // Guardar en localStorage para persistir entre recargas
    localStorage.setItem('viewMode', mode);
  }

  /**
   * Inicializa el modo de vista desde localStorage
   */
  initializeViewMode(): void {
    const savedMode = localStorage.getItem('viewMode') as ViewMode;
    if (savedMode && (savedMode === 'admin' || savedMode === 'profesor')) {
      this.currentViewMode.set(savedMode);
    } else {
      this.currentViewMode.set('admin');
    }
  }

  /**
   * Verifica si está en modo profesor
   */
  isProfesorMode(): boolean {
    return this.currentViewMode() === 'profesor';
  }

  /**
   * Verifica si está en modo admin
   */
  isAdminMode(): boolean {
    return this.currentViewMode() === 'admin';
  }
}

