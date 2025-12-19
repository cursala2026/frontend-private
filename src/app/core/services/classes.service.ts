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
}

@Injectable({
  providedIn: 'root'
})
export class ClassesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/class`;

  getClassById(classId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${classId}`);
  }

  getClassesByCourse(courseId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/course/${courseId}/classes`);
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
    
    if (classData.supportMaterials && classData.supportMaterials.length > 0) {
      classData.supportMaterials.forEach((file) => {
        formData.append('supportMaterials', file);
      });
    } else if (classData.supportMaterialIds && classData.supportMaterialIds.length > 0) {
      formData.append('supportMaterialIds', JSON.stringify(classData.supportMaterialIds));
    }
    
    if (classData.linkLive) {
      formData.append('linkLive', classData.linkLive);
    }

    return this.http.post(this.apiUrl, formData);
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
    
    if (classData.supportMaterials && classData.supportMaterials.length > 0) {
      classData.supportMaterials.forEach((file) => {
        formData.append('supportMaterials', file);
      });
    } else if (classData.supportMaterialIds && classData.supportMaterialIds.length > 0) {
      formData.append('supportMaterialIds', JSON.stringify(classData.supportMaterialIds));
    }
    
    if (classData.linkLive !== undefined) {
      formData.append('linkLive', classData.linkLive);
    }

    return this.http.patch(`${this.apiUrl}/${classId}`, formData);
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
}

