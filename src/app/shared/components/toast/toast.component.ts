import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InfoService, InfoMessage } from '../../../core/services/info.service';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html'
})
export class ToastComponent implements OnDestroy {
  message: InfoMessage | null = null;
  private sub?: Subscription;

  constructor(private info: InfoService) {
    this.sub = this.info.messages.subscribe(msg => {
      if (!msg) return;
      this.message = msg;
      if (msg.timeout && msg.timeout > 0) {
        // dismiss after timeout
        timer(msg.timeout).subscribe(() => this.message = null);
      }
    });
  }

  dismiss() {
    this.message = null;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
