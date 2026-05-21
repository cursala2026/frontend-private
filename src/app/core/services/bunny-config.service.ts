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
    const storageZoneName = 'dev-cursala'; // Nombre conocido de la zona

    // Caso 1: Es una URL de Storage de Bunny (ej: https://br.storage.bunnycdn.com/dev-cursala/...)
    if (storageUrl.includes('storage.bunnycdn.com')) {
      try {
        const url = new URL(storageUrl);
        const pathParts = url.pathname.split('/').filter(p => p.length > 0);
        
        // REGLA DE ORO: En el CDN, el archivo siempre está en /folder/archivo.ext
        // Si el backend guardó https://br.storage.bunnycdn.com/dev-cursala/course-images/portada.jpg
        // Queremos llegar a https://dev-cursala.b-cdn.net/course-images/portada.jpg
        
        let remainingPathParts: string[];
        
        // 1. Si la URL contiene el nombre de la zona, tomamos lo que sigue
        const zoneIndex = pathParts.indexOf(storageZoneName);
        if (zoneIndex !== -1) {
          remainingPathParts = pathParts.slice(zoneIndex + 1);
        } else {
          // 2. Si no, pero detectamos que el primer componente es un folder conocido
          const commonFolders = ['course-images', 'course-programs', 'profile-images', 'support-materials'];
          if (commonFolders.includes(pathParts[0])) {
            remainingPathParts = pathParts;
          } else {
            // 3. Fallback: remover solo el primer componente (asumiendo que es la zona)
            remainingPathParts = pathParts.slice(1);
          }
        }

        const cleanPath = remainingPathParts.join('/');
        finalUrl = `https://${this.DEFAULT_CDN_HOST}/${cleanPath}`;
      } catch (e) {
        finalUrl = storageUrl;
      }
    } 
    // Caso 2: Es solo un nombre de archivo o path relativo
    else if (!storageUrl.startsWith('http')) {
      let cleanPath = storageUrl.startsWith('/') ? storageUrl.slice(1) : storageUrl;
      
      // Eliminar el nombre de la zona si está al principio (ej: dev-cursala/course-images/...)
      if (cleanPath.startsWith(`${storageZoneName}/`)) {
        cleanPath = cleanPath.substring(storageZoneName.length + 1);
      }
      
      const pathParts = cleanPath.split('/').filter(p => p.length > 0);
      
      // Si el primer componente NO es el folder esperado, lo agregamos
      if (folder && pathParts[0] !== folder) {
        finalUrl = `https://${this.DEFAULT_CDN_HOST}/${folder}/${pathParts.map(part => encodeURIComponent(decodeURIComponent(part))).join('/')}`;
      } else {
        finalUrl = `https://${this.DEFAULT_CDN_HOST}/${pathParts.map(part => encodeURIComponent(decodeURIComponent(part))).join('/')}`;
      }
    }
    // Caso 3: Ya es una URL completa (CDN correcto, externa, etc.)
    else {
      // Si ya es una URL del CDN correcto, la devolvemos tal cual
      if (storageUrl.includes(this.DEFAULT_CDN_HOST)) {
        finalUrl = storageUrl;
      } else {
        // Si es otra URL completa, intentamos ver si contiene folders conocidos para normalizarla
        const commonFolders = ['course-images', 'course-programs', 'profile-images', 'support-materials'];
        const foundFolder = commonFolders.find(f => storageUrl.includes(`/${f}/`));
        
        if (foundFolder) {
          try {
            const url = new URL(storageUrl);
            const pathParts = url.pathname.split('/').filter(p => p.length > 0);
            const folderIndex = pathParts.indexOf(foundFolder);
            const remainingPathParts = pathParts.slice(folderIndex);
            const cleanPath = remainingPathParts.map(part => encodeURIComponent(decodeURIComponent(part))).join('/');
            finalUrl = `https://${this.DEFAULT_CDN_HOST}/${cleanPath}`;
          } catch (e) {
            finalUrl = storageUrl;
          }
        } else {
          finalUrl = storageUrl;
        }
      }
    }

    // Aplicar timestamp de cache-busting si existe
    if (timestamp) {
      const t = this.getTimestampValue(timestamp);
      if (t) {
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
