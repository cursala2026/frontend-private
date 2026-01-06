import { Injectable, inject } from '@angular/core';
import { ClassesService } from './classes.service';
import { VideoUploadProgressService, UploadProgressEvent } from './video-upload-progress.service';
import { InfoService } from './info.service';
import { Subscription, BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class VideoUploadManagerService {
  private classesService = inject(ClassesService);
  private progressService = inject(VideoUploadProgressService);
  private info = inject(InfoService);
  private auth = inject(AuthService);

  private activeUploads = new Map<string, { progressSub?: Subscription; uploadSub?: Subscription; userId?: string }>();
  private progressSubjects = new Map<string, BehaviorSubject<number>>();
  private uploadNames = new Map<string, string | undefined>();
  private uploadVideoNames = new Map<string, string | undefined>();
  private activeUploadsList$ = new BehaviorSubject<Array<{ classId: string; name?: string; percent: number }>>([]);

  // Cola y control por usuario: máximo 2 uploads simultáneas por usuario
  private userQueues = new Map<string, Array<{ classId: string; file: File; originalName?: string }>>();
  private userRunning = new Map<string, Set<string>>();
  private queuedList$ = new BehaviorSubject<Array<{ classId: string; name?: string; videoName?: string; position: number }>>([]);

  startUpload(classId: string, file: File, originalName?: string) {
    if (!classId || !file) return;
    if (this.activeUploads.has(classId)) return; // ya en curso

    const currentUser = this.auth.currentUser ? this.auth.currentUser() : null;
    const userId = currentUser?._id || 'unknown_user';
    const running = this.userRunning.get(userId) || new Set<string>();
    // Si hay menos de 2 en ejecución, iniciar de inmediato
    if (running.size >= 2) {
      // Encolar
      const q = this.userQueues.get(userId) || [];
      q.push({ classId, file, originalName });
      this.userQueues.set(userId, q);
      // registrar nombre del video en la cola
      this.uploadVideoNames.set(classId, originalName || undefined);
      // intentar resolver nombre de la clase aunque esté en cola
      this.classesService.getClassById(classId).subscribe({
        next: (res: any) => {
          const data = res?.data || res;
          const name = data?.name || undefined;
          this.uploadNames.set(classId, name);
          this.updateQueuedList();
        },
        error: () => {
          this.updateQueuedList();
        }
      });
      this.updateQueuedList();
      try { this.info.showInfo('La subida fue encolada. Se iniciará cuando haya espacio libre.'); } catch {}
      return;
    }

    const entry: { progressSub?: Subscription; uploadSub?: Subscription; userId?: string } = { userId };
    this.activeUploads.set(classId, entry);
    // marcar como en ejecución para el usuario
    running.add(classId);
    this.userRunning.set(userId, running);

    // No mostrar toasts informativos de progreso para evitar duplicidad (UI usa barras)

    // Registrar nombre de clase desconocida por ahora y nombre de video si viene
    this.uploadNames.set(classId, undefined);
    this.uploadVideoNames.set(classId, originalName || undefined);
    const subject = new BehaviorSubject<number>(0);
    this.progressSubjects.set(classId, subject);
    this.updateActiveList();

    // Resolver nombre de la clase y actualizar toast/lista cuando esté disponible
    this.classesService.getClassById(classId).subscribe({
        next: (res: any) => {
        const data = res?.data || res;
        const name = data?.name || undefined;
        this.uploadNames.set(classId, name);
        this.updateActiveList();
      },
      error: () => {
        // keep fallback toast
      }
    });

    // Conectar SSE con reconexión exponencial en caso de error
    const maxAttempts = 6;
    const connectWithBackoff = (attempt = 0) => {
      try {
        entry.progressSub = this.progressService.getUploadProgress(classId).subscribe({
          next: (event: UploadProgressEvent) => {
            if (event.error) {
              try { this.info.showError('Error al procesar el video: ' + event.error + (this.uploadNames.get(classId) ? ' - ' + this.uploadNames.get(classId) : '')); } catch {}
              subject.next(0);
              this.cleanup(classId);
            } else {
              subject.next(event.percent);
              this.updateActiveList();
              if (event.percent >= 100) {
                try { this.info.showSuccess('Video procesado exitosamente' + (this.uploadNames.get(classId) ? ' - ' + this.uploadNames.get(classId) : '')); } catch {}
                this.cleanup(classId);
              }
            }
          },
          error: (err) => {
            console.error('Error en SSE de progreso (will attempt reconnect):', err);
            // intentar reconectar con backoff
            entry.progressSub?.unsubscribe();
            if (attempt < maxAttempts) {
              const delay = Math.min(30000, Math.pow(2, attempt) * 1000);
              setTimeout(() => connectWithBackoff(attempt + 1), delay);
            } else {
              try { this.info.showError('No se pudo conectar al progreso del video'); } catch {}
              this.cleanup(classId);
            }
          }
        });
      } catch (err) {
        console.error('No se pudo conectar al stream de progreso (exception):', err);
        if (attempt < maxAttempts) {
          const delay = Math.min(30000, Math.pow(2, attempt) * 1000);
          setTimeout(() => connectWithBackoff(attempt + 1), delay);
        } else {
          try { this.info.showError('No se pudo conectar al progreso del video'); } catch {}
          this.cleanup(classId);
        }
      }
    };

    connectWithBackoff(0);

    // Iniciar subida al backend
    entry.uploadSub = this.classesService.uploadClassVideo(classId, file, originalName).subscribe({
      next: () => {
        // El SSE se encargará de informar el progreso
      },
      error: (err) => {
        console.error('Error subiendo video:', err);
        try { this.info.showError('Error subiendo el video en segundo plano' + (this.uploadNames.get(classId) ? ' - ' + this.uploadNames.get(classId) : '')); } catch {}
        this.cleanup(classId);
      }
    });
  }

  stopUpload(classId: string) {
    this.cleanup(classId);
  }

  /**
   * Observable con la lista de uploads activas y su porcentaje.
   */
  getActiveUploads(): Observable<Array<{ classId: string; name?: string; videoName?: string; percent: number }>> {
    return this.activeUploadsList$.asObservable();
  }

  /**
   * Observable con la lista de uploads encoladas (global, todas las colas)
   */
  getQueuedUploads(): Observable<Array<{ classId: string; name?: string; videoName?: string; position: number }>> {
    return this.queuedList$.asObservable();
  }

  /**
   * Observable del progreso para un upload específico.
   */
  getProgressFor(classId: string): Observable<number> | null {
    const subj = this.progressSubjects.get(classId);
    return subj ? subj.asObservable() : null;
  }

  private cleanup(classId: string) {
    const entry = this.activeUploads.get(classId);
    if (!entry) return;
    const userId = entry.userId;
    try { entry.progressSub?.unsubscribe(); } catch {}
    try { entry.uploadSub?.unsubscribe(); } catch {}
    this.activeUploads.delete(classId);
    const subj = this.progressSubjects.get(classId);
    try { subj?.complete(); } catch {}
    this.progressSubjects.delete(classId);
    this.uploadNames.delete(classId);
    this.uploadVideoNames.delete(classId);
    this.updateActiveList();

    // actualizar lista de encoladas por si este classId estaba en cola
    this.updateQueuedList();

    // Marcar como terminado para el usuario y procesar la cola si existe
    if (userId) {
      const running = this.userRunning.get(userId);
      if (running) {
        running.delete(classId);
        this.userRunning.set(userId, running);
      }
      this.processUserQueue(userId);
    }
  }

  private updateQueuedList() {
    const list: Array<{ classId: string; name?: string; videoName?: string; position: number }> = [];
    // Flatten queues preserving per-user order and provide position index
    for (const [userId, queue] of this.userQueues.entries()) {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        list.push({ classId: item.classId, name: this.uploadNames.get(item.classId), videoName: this.uploadVideoNames.get(item.classId), position: i + 1 });
      }
    }
    this.queuedList$.next(list);
  }

  private processUserQueue(userId: string) {
    const q = this.userQueues.get(userId) || [];
    let running = this.userRunning.get(userId) || new Set<string>();
    while (q.length > 0 && running.size < 2) {
      const next = q.shift()!;
      // iniciar siguiente upload
      this.userQueues.set(userId, q);
      this.startUpload(next.classId, next.file, next.originalName);
      // re-evaluar running tras iniciar
      running = this.userRunning.get(userId) || new Set<string>();
    }
    if ((q.length === 0) && this.userQueues.has(userId)) {
      this.userQueues.delete(userId);
    }
  }

  private updateActiveList() {
    const list: Array<{ classId: string; name?: string; videoName?: string; percent: number }> = [];
    for (const [id, subj] of this.progressSubjects.entries()) {
      list.push({ classId: id, name: this.uploadNames.get(id), videoName: this.uploadVideoNames.get(id), percent: subj.value });
    }
    this.activeUploadsList$.next(list);
  }
}
