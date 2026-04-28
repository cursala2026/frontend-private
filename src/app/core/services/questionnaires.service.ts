import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface QuestionOption {
  _id?: string;
  text: string;
  order: number;
}

export interface Question {
  _id?: string;
  type: 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'TEXT';
  questionText: string;
  order: number;
  points: number;
  required: boolean;
  options?: QuestionOption[];
  correctOptionId?: string; // For MULTIPLE_CHOICE
  correctOptionIds?: string[]; // For MULTIPLE_SELECT
  promptType?: 'TEXT' | 'IMAGE' | 'VIDEO';
  promptMediaUrl?: string;
  promptMediaProvider?: 'BUNNY';
}

export interface QuestionnairePosition {
  type: 'BETWEEN_CLASSES' | 'FINAL_EXAM';
  afterClassId?: string;
}

export interface Questionnaire {
  _id?: string;
  courseId: string;
  title: string;
  description?: string;
  isSurvey: boolean; 
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  position: QuestionnairePosition;
  questions: Question[];
  passingScore?: number;
  allowRetries: boolean;
  maxRetries?: number;
  showCorrectAnswers: boolean;
  timeLimitMinutes?: number; // Tiempo límite en minutos para resolver el cuestionario (opcional)
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Answer {
  questionId: string;
  questionType: 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'TEXT';
  selectedOptionId?: string; // For MULTIPLE_CHOICE
  selectedOptionIds?: string[]; // For MULTIPLE_SELECT
  textAnswer?: string;
  isCorrect?: boolean;
  pointsAwarded?: number;
  feedback?: string;
}

export interface QuestionnaireSubmission {
  _id?: string;
  questionnaireId: string;
  courseId: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  profilePhotoUrl?: string;
  attemptNumber: number;
  answers: Answer[];
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  autoGradedScore: number;
  manualGradedScore?: number;
  finalScore?: number;
  gradedBy?: string;
  gradedAt?: Date;
  feedback?: string;
  startedAt: Date;
  submittedAt?: Date;
}

export interface GradeReportEntry {
  studentId: string;
  studentName: string;
  studentEmail: string;
  profilePhotoUrl?: string;
  attemptCount: number;
  bestScore: number | null;
  lastAttempt: Date | null;
  allSubmissions: QuestionnaireSubmission[];
}

@Injectable({
  providedIn: 'root'
})
export class QuestionnairesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/questionnaires`;

  // ==================== QUESTIONNAIRE CRUD ====================

  /**
   * Crear nuevo cuestionario
   */
  createQuestionnaire(questionnaire: Partial<Questionnaire>): Observable<any> {
    return this.http.post(`${this.apiUrl}`, questionnaire);
  }

  /**
   * Actualizar cuestionario existente
   */
  updateQuestionnaire(id: string, questionnaire: Partial<Questionnaire>): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}`, questionnaire);
  }

  /**
   * Eliminar cuestionario
   */
  deleteQuestionnaire(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtener cuestionario por ID
   */
  getQuestionnaireById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  /**
   * Listar cuestionarios de un curso
   */
  getQuestionnairesByCourse(courseId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/course/${courseId}`);
  }

  /**
   * Listar cuestionarios de un profesor
   */
  getQuestionnairesByProfessor(professorId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/professor/${professorId}`);
  }

  // ==================== SUBMISSIONS ====================

  /**
   * Iniciar nuevo envío (para estudiantes)
   */
  startSubmission(questionnaireId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${questionnaireId}/submissions`, {});
  }

  /**
   * Enviar respuestas (para estudiantes)
   */
  submitAnswers(submissionId: string, answers: Answer[]): Observable<any> {
    return this.http.patch(`${this.apiUrl}/submissions/${submissionId}`, { answers });
  }

  /**
   * Calificar preguntas de texto (para profesores)
   */
  gradeTextQuestions(
    submissionId: string,
    gradedAnswers: Array<{ questionId: string; points: number; feedback?: string }>,
    overallFeedback?: string
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/submissions/${submissionId}/grade`, {
      gradedAnswers,
      overallFeedback
    });
  }

  /**
   * Obtener envíos de un estudiante para un cuestionario
   */
  getStudentSubmissions(questionnaireId: string, studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${questionnaireId}/submissions/student/${studentId}`);
  }

  /**
   * Obtener reporte de calificaciones de todos los alumnos
   */
  getGradeReport(questionnaireId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${questionnaireId}/grade-report`);
  }

  /**
   * Obtener un envío específico por ID
   */
  getSubmissionById(submissionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/submissions/${submissionId}`);
  }

  /**
   * Obtener envíos pendientes de calificación
   */
  getPendingGrading(questionnaireId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${questionnaireId}/pending-grading`);
  }

  /**
   * Obtener todos los exámenes pendientes de calificar para el profesor actual
   */
  getPendingGradingByTeacher(): Observable<any> {
    return this.http.get(`${this.apiUrl}/submissions/pending-grading/teacher`);
  }

  /**
   * Resetear intentos de un estudiante para un cuestionario
   */
  resetStudentAttempts(questionnaireId: string, studentId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${questionnaireId}/submissions/student/${studentId}`);
  }

  /**
   * Subir imagen o video para una pregunta (async - retorna 202 inmediatamente)
   */
  uploadQuestionMedia(
    questionnaireId: string,
    questionId: string,
    file: File,
    promptType?: 'IMAGE' | 'VIDEO'
  ): Observable<any> {
    const formData = new FormData();
    formData.append('mediaFile', file);
    if (promptType) {
      formData.append('promptType', promptType);
    }
    // Ya no necesitamos reportProgress ni observe events, el backend procesa en segundo plano
    return this.http.post(
      `${this.apiUrl}/${questionnaireId}/questions/${questionId}/media`,
      formData
    );
  }
}
