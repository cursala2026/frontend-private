import { Injectable } from '@angular/core';
import { environment } from '../config/environment';

@Injectable({
  providedIn: 'root'
})
export class BunnyConfigService {
  // Hostname base del CDN tomado del environment
  private readonly DEFAULT_CDN_HOST = environment.bunnyCdnHost || 'cursala.b-cdn.net';

  /**
   * Genera una URL de Pull Zone (CDN) a partir de una de Storage Zone de Bunny.
   * @param storageUrl URL de origen o nombre de archivo
   * @param timestamp Opcional para evitar caché (cache-busting)
   * @param folder Carpeta por defecto si es solo un nombre de archivo
   */
  convertStorageToCdnUrl(
    storageUrl: string | undefined | null, 
    timestamp?: number | string | Date,
    folder: string = 'profile-images'
  ): string | null {
    if (!storageUrl) return null;
    
    let finalUrl: string;

    // Caso 1: Es una URL de Storage de Bunny
    if (storageUrl.includes('storage.bunnycdn.com')) {
      try {
        const url = new URL(storageUrl);
        const pathParts = url.pathname.split('/').filter(p => p.length > 0);
        
        if (pathParts.length >= 2) {
          const storageZoneName = pathParts[0];
          const remainingPath = pathParts.slice(1).join('/');
          finalUrl = `https://${storageZoneName}.b-cdn.net/${remainingPath}`;
        } else {
          finalUrl = storageUrl;
        }
      } catch (e) {
        finalUrl = storageUrl;
      }
    } 
    // Caso 2: Es solo un nombre de archivo o path relativo
    else if (!storageUrl.startsWith('http')) {
      let cleanPath = storageUrl.startsWith('/') ? storageUrl.slice(1) : storageUrl;
      
      // Si el path ya empieza con el nombre de la carpeta, no lo duplicamos
      if (cleanPath.startsWith(`${folder}/`)) {
        cleanPath = cleanPath.replace(`${folder}/`, '');
      }
      
      // Codificar solo el nombre del archivo, no la ruta completa si tuviera subcarpetas
      const pathParts = cleanPath.split('/');
      const encodedPath = pathParts.map(part => encodeURIComponent(part)).join('/');
      finalUrl = `https://${this.DEFAULT_CDN_HOST}/${folder}/${encodedPath}`;
    }
    // Caso 3: Ya es una URL completa (posiblemente de CDN)
    else {
      finalUrl = storageUrl;
    }

    // Aplicar timestamp de cache-busting si existe
    if (timestamp) {
      const t = this.getTimestampValue(timestamp);
      if (t) {
        // Evitar duplicar el signo ? o usar & si ya hay parámetros
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl += `${separator}t=${t}`;
      }
    }
    
    return finalUrl;
  }

  /**
   * Helper para obtener un timestamp numérico a partir de varios formatos
   */
  private getTimestampValue(timestamp: any): number | null {
    if (!timestamp) return null;
    const t = timestamp instanceof Date ? timestamp.getTime() : 
              typeof timestamp === 'string' ? new Date(timestamp).getTime() : 
              Number(timestamp);
    return isNaN(t) ? null : t;
  }

  /**
   * Genera URL para imágenes de cursos
   */
  getCourseImageUrl(imageUrl: string | undefined | null): string {
    return this.convertStorageToCdnUrl(imageUrl, undefined, 'course-images') || '';
  }

  /**
   * Genera URL para materiales de apoyo
   */
  getSupportMaterialUrl(fileName: string | undefined | null): string {
    return this.convertStorageToCdnUrl(fileName, undefined, 'support-materials') || '';
  }
}
