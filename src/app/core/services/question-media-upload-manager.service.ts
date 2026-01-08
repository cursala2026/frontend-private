import { Injectable, inject } from '@angular/core';
import { QuestionnairesService } from './questionnaires.service';
import { InfoService } from './info.service';
import { QuestionMediaUploadProgressService } from './question-media-upload-progress.service';
import { Subscription, BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';

export interface UploadCompletedEvent {
  uploadId: string;
  questionnaireId: string;
  questionId: string;
}

@Injectable({ providedIn: 'root' })
export class QuestionMediaUploadManagerService {
  private questionnairesService = inject(QuestionnairesService);
  private info = inject(InfoService);
  private auth = inject(AuthService);
  private progressService = inject(QuestionMediaUploadProgressService);

  private uploadCompletedSubject = new Subject<UploadCompletedEvent>();
  public uploadCompleted$ = this.uploadCompletedSubject.asObservable();

  private activeUploads = new Map<string, { uploadSub?: Subscription; progressSub?: Subscription; userId?: string; questionnaireId?: string; questionId?: string }>();
  private progressSubjects = new Map<string, BehaviorSubject<number>>();
  private uploadNames = new Map<string, string | undefined>();
  private uploadFileNames = new Map<string, string | undefined>();
  private activeUploadsList$ = new BehaviorSubject<Array<{ uploadId: string; questionText?: string; fileName?: string; percent: number }>>([]);

  // Cola y control por usuario: máximo 2 uploads simultáneas por usuario
  private userQueues = new Map<string, Array<{ uploadId: string; questionnaireId: string; questionId: string; file: File; promptType: 'IMAGE' | 'VIDEO'; questionText?: string }>>();
  private userRunning = new Map<string, Set<string>>();
  private queuedList$ = new BehaviorSubject<Array<{ uploadId: string; questionText?: string; fileName?: string; position: number }>>([]);

  startUpload(
    questionnaireId: string,
    questionId: string,
    file: File,
    promptType: 'IMAGE' | 'VIDEO',
    questionText?: string
  ): { uploadId: string; started: boolean } {
    // debug logs removed

    if (!questionnaireId || !questionId || !file) {
      return { uploadId: '', started: false };
    }

    const uploadId = `${questionnaireId}_${questionId}`;
    // debug logs removed

    if (this.activeUploads.has(uploadId)) {
      return { uploadId, started: false }; // ya en curso
    }

    const currentUser = this.auth.currentUser ? this.auth.currentUser() : null;
    const userId = currentUser?._id || 'unknown_user';
    const running = this.userRunning.get(userId) || new Set<string>();

    // Si hay menos de 2 en ejecución, iniciar de inmediato
    if (running.size >= 2) {
      // Encolar
      const q = this.userQueues.get(userId) || [];
      q.push({ uploadId, questionnaireId, questionId, file, promptType, questionText });
      this.userQueues.set(userId, q);
      // registrar nombre del archivo en la cola
      this.uploadFileNames.set(uploadId, file.name);
      this.uploadNames.set(uploadId, questionText);
      this.updateQueuedList();
      try { this.info.showInfo('La subida fue encolada. Se iniciará cuando haya espacio libre.'); } catch {}
      return { uploadId, started: false };
    }

    const entry: { uploadSub?: Subscription; progressSub?: Subscription; userId?: string; questionnaireId?: string; questionId?: string } = {
      userId,
      questionnaireId,
      questionId
    };
    this.activeUploads.set(uploadId, entry);
    // marcar como en ejecución para el usuario
    running.add(uploadId);
    this.userRunning.set(userId, running);

    // Registrar nombres
    this.uploadNames.set(uploadId, questionText);
    this.uploadFileNames.set(uploadId, file.name);
    const subject = new BehaviorSubject<number>(0);
    this.progressSubjects.set(uploadId, subject);
    this.updateActiveList();

    // Conectar SSE para progreso en tiempo real
    // debug logs removed
    entry.progressSub = this.progressService.getUploadProgress(questionnaireId, questionId).subscribe({
      next: (event) => {
        // debug logs removed
        if (event.error) {
          try {
            this.info.showError('Error al procesar el archivo multimedia: ' + event.error + (this.uploadNames.get(uploadId) ? ' - ' + this.uploadNames.get(uploadId) : ''));
          } catch {}
          subject.next(0);
          this.cleanup(uploadId);
        } else {
          subject.next(event.percent);
          this.updateActiveList();
          if (event.percent >= 100) {
            try {
              this.info.showSuccess('Archivo multimedia procesado exitosamente' + (this.uploadNames.get(uploadId) ? ' - ' + this.uploadNames.get(uploadId) : ''));
            } catch {}
            // Emitir evento de completado antes de limpiar
            this.uploadCompletedSubject.next({ uploadId, questionnaireId, questionId });
            this.cleanup(uploadId);
          }
        }
      },
      error: (err) => {
        console.error('Error en SSE de progreso:', err);
        try {
          this.info.showError('No se pudo conectar al progreso del archivo multimedia');
        } catch {}
        this.cleanup(uploadId);
      }
    });

    // Iniciar subida al backend (retorna 202 Accepted inmediatamente)
    entry.uploadSub = this.questionnairesService.uploadQuestionMedia(questionnaireId, questionId, file, promptType).subscribe({
      next: (response) => {
        // backend response handled via SSE
      },
      error: (err) => {
        console.error('Error subiendo archivo multimedia:', err);
        try {
          this.info.showError('Error subiendo el archivo multimedia' + (this.uploadNames.get(uploadId) ? ' - ' + this.uploadNames.get(uploadId) : ''));
        } catch {}
        this.cleanup(uploadId);
      }
    });

    return { uploadId, started: true };
  }

  stopUpload(uploadId: string) {
    this.cleanup(uploadId);
  }

  /**
   * Observable con la lista de uploads activas y su porcentaje.
   */
  getActiveUploads(): Observable<Array<{ uploadId: string; questionText?: string; fileName?: string; percent: number }>> {
    return this.activeUploadsList$.asObservable();
  }

  /**
   * Observable con la lista de uploads encoladas (global, todas las colas)
   */
  getQueuedUploads(): Observable<Array<{ uploadId: string; questionText?: string; fileName?: string; position: number }>> {
    return this.queuedList$.asObservable();
  }

  /**
   * Observable del progreso para un upload específico.
   */
  getProgressFor(uploadId: string): Observable<number> | null {
    const subj = this.progressSubjects.get(uploadId);
    return subj ? subj.asObservable() : null;
  }

  private cleanup(uploadId: string) {
    const entry = this.activeUploads.get(uploadId);
    if (!entry) return;
    const userId = entry.userId;
    try { entry.uploadSub?.unsubscribe(); } catch {}
    try { entry.progressSub?.unsubscribe(); } catch {}
    this.activeUploads.delete(uploadId);
    const subj = this.progressSubjects.get(uploadId);
    try { subj?.complete(); } catch {}
    this.progressSubjects.delete(uploadId);
    this.uploadNames.delete(uploadId);
    this.uploadFileNames.delete(uploadId);
    this.updateActiveList();

    // actualizar lista de encoladas por si este uploadId estaba en cola
    this.updateQueuedList();

    // Marcar como terminado para el usuario y procesar la cola si existe
    if (userId) {
      const running = this.userRunning.get(userId);
      if (running) {
        running.delete(uploadId);
        this.userRunning.set(userId, running);
      }
      this.processUserQueue(userId);
    }
  }

  private updateQueuedList() {
    const list: Array<{ uploadId: string; questionText?: string; fileName?: string; position: number }> = [];
    // Flatten queues preserving per-user order and provide position index
    for (const [userId, queue] of this.userQueues.entries()) {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        list.push({
          uploadId: item.uploadId,
          questionText: this.uploadNames.get(item.uploadId),
          fileName: this.uploadFileNames.get(item.uploadId),
          position: i + 1
        });
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
      this.startUpload(next.questionnaireId, next.questionId, next.file, next.promptType, next.questionText);
      // re-evaluar running tras iniciar
      running = this.userRunning.get(userId) || new Set<string>();
    }
    if ((q.length === 0) && this.userQueues.has(userId)) {
      this.userQueues.delete(userId);
    }
  }

  private updateActiveList() {
    const list: Array<{ uploadId: string; questionText?: string; fileName?: string; percent: number }> = [];
    for (const [id, subj] of this.progressSubjects.entries()) {
      list.push({
        uploadId: id,
        questionText: this.uploadNames.get(id),
        fileName: this.uploadFileNames.get(id),
        percent: subj.value
      });
    }
    this.activeUploadsList$.next(list);
  }
}
