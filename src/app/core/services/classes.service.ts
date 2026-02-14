import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface ClassData {
  _id: string;
  name: string;
  description?: string;
  status: string;
  order: number;
  imageUrl?: string;
  videoUrl?: string;
  videoOriginalName?: string;
  videoStatus?: 'ready' | 'processing' | 'error';
  courseId: string;
  supportMaterials?: string[];
  meta?: {
    views: number;
    duration: string;
  };
  linkLive?: string;
  examConfig?: {
    examLink: string;
    examVisible: boolean;
    examStartDate?: Date;
    examEndDate?: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClassWithCourse extends ClassData {
  courseName?: string;
}

export interface CreateClassDto {
  name: string;
  description?: string;
  courseId: string;
  imageFile?: File;
  videoFile?: File;
  supportMaterials?: File[];
  linkLive?: string;
  imageFileId?: string;
  videoFileId?: string;
  supportMaterialIds?: string[];
  videoOriginalName?: string;
}

export interface UpdateClassDto {
  name?: string;
  description?: string;
  imageFile?: File;
  videoFile?: File;
  supportMaterials?: File[];
  linkLive?: string;
  imageFileId?: string;
  videoFileId?: string;
  supportMaterialIds?: string[];
  supportMaterialsToDelete?: string[];
  deleteCurrentVideo?: string;
  deleteCurrentImage?: string;
  videoOriginalName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClassesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/class`;
  private uploadUrl = `${environment.uploadUrl}/class`;

  getClassById(classId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${classId}`);
  }

  getClassesByCourse(courseId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/course/${courseId}/classes`);
  }

  getClassesByTeacherCourses(teacherId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/teacher/${teacherId}/classes`);
  }

  createClass(classData: CreateClassDto): Observable<any> {
    const formData = new FormData();

    formData.append('name', classData.name);
    if (classData.description) formData.append('description', classData.description);
    formData.append('courseId', classData.courseId);

    if (classData.imageFile) {
      formData.append('imageFile', classData.imageFile);
    } else if (classData.imageFileId) {
      formData.append('imageFileId', classData.imageFileId);
    }

    if (classData.videoFile) {
      formData.append('videoFile', classData.videoFile);
    } else if (classData.videoFileId) {
      formData.append('videoFileId', classData.videoFileId);
    }

    // Nombre original del archivo de video (si el frontend lo proporciona)
    if ((classData as any).videoOriginalName) {
      formData.append('videoOriginalName', (classData as any).videoOriginalName);
    }

    if (classData.supportMaterials && classData.supportMaterials.length > 0) {
      classData.supportMaterials.forEach((file) => {
        formData.append('supportMaterials', file);
      });
    } else if (classData.supportMaterialIds && classData.supportMaterialIds.length > 0) {
      formData.append('supportMaterialIds', JSON.stringify(classData.supportMaterialIds));
    }

    // Enviar la lista explícita de materiales a eliminar si existe (create)
    if ((classData as any).supportMaterialsToDelete && (classData as any).supportMaterialsToDelete.length > 0) {
      formData.append('supportMaterialsToDelete', JSON.stringify((classData as any).supportMaterialsToDelete));
    }


    if (classData.linkLive) {
      formData.append('linkLive', classData.linkLive);
    }

    // Usar uploadUrl si hay video, apiUrl en caso contrario
    const url = classData.videoFile ? this.uploadUrl : this.apiUrl;
    // Log temporal: listar contenido de FormData antes de enviar
    // (debug logs removed)
    return this.http.post(url, formData);
  }

  updateClass(classId: string, classData: UpdateClassDto): Observable<any> {
    const formData = new FormData();

    if (classData.name) formData.append('name', classData.name);
    if (classData.description !== undefined) formData.append('description', classData.description);

    if (classData.imageFile) {
      formData.append('imageFile', classData.imageFile);
    } else if (classData.imageFileId) {
      formData.append('imageFileId', classData.imageFileId);
    }

    if (classData.videoFile) {
      formData.append('videoFile', classData.videoFile);
    } else if (classData.videoFileId) {
      formData.append('videoFileId', classData.videoFileId);
    }

    // Nombre original del archivo de video (si el frontend lo proporciona)
    if ((classData as any).videoOriginalName) {
      formData.append('videoOriginalName', (classData as any).videoOriginalName);
    }

    if (classData.supportMaterials && classData.supportMaterials.length > 0) {
      classData.supportMaterials.forEach((file) => {
        formData.append('supportMaterials', file);
      });
    } else if (classData.supportMaterialIds && classData.supportMaterialIds.length > 0) {
      formData.append('supportMaterialIds', JSON.stringify(classData.supportMaterialIds));
    }

    // Incluir lista explícita de materiales a eliminar si viene desde el frontend (update)
    if ((classData as any).supportMaterialsToDelete && (classData as any).supportMaterialsToDelete.length > 0) {
      // Enviar como JSON (un único campo)
      formData.append('supportMaterialsToDelete', JSON.stringify((classData as any).supportMaterialsToDelete));
      // Enviar también como múltiples entradas con sufijo [] por compatibilidad con backends que esperan arrays en FormData
      (classData as any).supportMaterialsToDelete.forEach((name: string) => {
        formData.append('supportMaterialsToDelete[]', name);
      });
    }

    if (classData.linkLive !== undefined) {
      formData.append('linkLive', classData.linkLive);
    }

    if (classData.deleteCurrentVideo) {
      formData.append('deleteCurrentVideo', classData.deleteCurrentVideo);
    }

    if (classData.deleteCurrentImage) {
      formData.append('deleteCurrentImage', classData.deleteCurrentImage);
    }

    // Usar uploadUrl si hay video, apiUrl en caso contrario
    const url = classData.videoFile ? this.uploadUrl : this.apiUrl;
    // Log temporal: listar contenido de FormData antes de enviar
    // (debug logs removed)

    return this.http.patch(`${url}/${classId}`, formData);
  }

  /**
   * Sube un archivo de video para una clase existente en background.
   * Usa el mismo endpoint de `uploadUrl` que `updateClass` cuando incluye video.
   */
  uploadClassVideo(classId: string, videoFile: File, videoOriginalName?: string): Observable<any> {
    const formData = new FormData();
    formData.append('videoFile', videoFile);
    if (videoOriginalName) {
      formData.append('videoOriginalName', videoOriginalName);
    }
    return this.http.patch(`${this.uploadUrl}/${classId}`, formData);
  }

  reorderClasses(reorderData: { id: string; order: number }[], courseId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reorder`, { reorderData, courseId });
  }

  deleteClass(classId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${classId}/delete`);
  }

  toggleClassStatus(classId: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${classId}/status`, {});
  }

  moveClassUp(classId: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${classId}/up`, {});
  }

  moveClassDown(classId: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${classId}/down`, {});
  }

  /**
   * Pide al backend metadata de un video de Bunny Stream (title, etc.).
   * El backend debe exponer un endpoint seguro que llame a la API de Bunny.
   */
  getBunnyVideoMetadata(libraryId: string, videoId: string): Observable<any> {
    // Endpoint backend recomendado: /internal/bunny/video-metadata
    return this.http.get(`/internal/bunny/video-metadata?libraryId=${encodeURIComponent(libraryId)}&videoId=${encodeURIComponent(videoId)}`);
  }
}

