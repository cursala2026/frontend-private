import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../config/environment';
import { AuthService } from './auth.service';

export interface QuestionMediaUploadProgressEvent {
  percent: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class QuestionMediaUploadProgressService {
  private apiUrl = `${environment.apiUrl}/questionnaires`;
  private authService = inject(AuthService);

  /**
   * Conecta al endpoint SSE para recibir actualizaciones de progreso de subida de media de pregunta
   * @param questionnaireId - ID del cuestionario
   * @param questionId - ID de la pregunta
   * @returns Observable que emite eventos de progreso
   */
  getUploadProgress(questionnaireId: string, questionId: string): Observable<QuestionMediaUploadProgressEvent> {
    const subject = new Subject<QuestionMediaUploadProgressEvent>();
    const token = this.authService.getToken();

    // EventSource no soporta headers personalizados, así que pasamos el token como query param
    const url = token
      ? `${this.apiUrl}/${questionnaireId}/questions/${questionId}/media-upload-progress?token=${encodeURIComponent(token)}`
      : `${this.apiUrl}/${questionnaireId}/questions/${questionId}/media-upload-progress`;

    const eventSource = new EventSource(url, {
      withCredentials: true
    });

    let lastReceivedPercent = -1;

    eventSource.onmessage = (event) => {
      try {
        // Ignorar heartbeats (líneas que empiezan con :)
        if (event.data.trim().startsWith(':')) {
          return;
        }

        const data = JSON.parse(event.data);

        if (data.error) {
          subject.next({ percent: 0, error: data.error });
          subject.complete();
          eventSource.close();
        } else if (typeof data.percent === 'number') {
          // Solo procesar si el porcentaje cambió (evitar duplicados)
          if (data.percent !== lastReceivedPercent) {
            lastReceivedPercent = data.percent;
            subject.next({ percent: data.percent });

            // Si llegó al 100%, completar y cerrar después de un delay
            if (data.percent >= 100) {
              setTimeout(() => {
                subject.complete();
                eventSource.close();
              }, 2000);
            }
          }
        }
      } catch (error) {
        // No cerrar la conexión por errores de parsing, podría ser un heartbeat
      }
    };

    eventSource.onerror = (error) => {
      // Solo cerrar si es un error fatal (readyState === 2)
      if (eventSource.readyState === EventSource.CLOSED) {
        subject.error(error);
        eventSource.close();
      }
      // Si readyState === 0 (CONNECTING) o 1 (OPEN), podría ser un error temporal
    };

    // Retornar observable y asegurar limpieza al desuscribirse
    return new Observable(observer => {
      const subscription = subject.subscribe(observer);

      return () => {
        subscription.unsubscribe();
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
      };
    });
  }
}
