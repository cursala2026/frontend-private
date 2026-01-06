import { Component, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoUploadManagerService } from '../../../core/services/video-upload-manager.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-video-upload-progress',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (uploads().length > 0 || queued().length > 0) {
      <div class="fixed right-4 bottom-4 w-80 z-50 space-y-3">
        @if (uploads().length > 0) {
          <div class="space-y-2">
            @for (u of uploads(); track u.classId) {
              <div class="bg-white/95 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg p-3 shadow-lg flex items-center gap-3">
                <div class="shrink-0">
                  <div class="w-10 h-10 rounded-full border-4 border-dashed border-blue-300 dark:border-slate-600 animate-spin" role="status" aria-label="Subiendo video"></div>
                </div>
                <div class="flex-1">
                  <div class="text-sm font-semibold">Subiendo: {{ u.name || ('Clase ' + u.classId) }}</div>
                  @if (u.videoName) {
                    <div class="text-xs text-slate-600 dark:text-slate-300 truncate">Archivo: {{ u.videoName }}</div>
                  }
                </div>
              </div>
            }
          </div>
        }

        @if (queued().length > 0) {
          <div class="bg-white/95 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg p-2 shadow-lg">
            <div class="text-xs font-semibold mb-2">En cola</div>
            @for (q of queued(); track q.classId) {
              <div class="flex items-center gap-2 py-1">
                <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3" />
                </svg>
                <div class="text-xs truncate">{{ q.name || ('Clase ' + q.classId) }} <span class="text-slate-400">(#{{ q.position }})</span></div>
              </div>
            }
          </div>
        }
      </div>
    }
  `
})
export class VideoUploadProgressComponent implements OnDestroy {
  uploads = signal<Array<{ classId: string; name?: string; videoName?: string; percent: number }>>([]);
  queued = signal<Array<{ classId: string; name?: string; videoName?: string; position: number }>>([]);
  private sub?: Subscription;
  private queuedSub?: Subscription;

  constructor(private manager: VideoUploadManagerService) {
    this.sub = this.manager.getActiveUploads().subscribe(list => this.uploads.set(list));
    this.queuedSub = this.manager.getQueuedUploads().subscribe(list => this.queued.set(list));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.queuedSub?.unsubscribe();
  }
}
