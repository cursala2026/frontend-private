import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { VideoUploadProgressComponent } from './shared/components/video-upload-progress/video-upload-progress.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, VideoUploadProgressComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('frontend-private');

  ngOnInit() {
    document.body.classList.add('loaded');
  }
}
