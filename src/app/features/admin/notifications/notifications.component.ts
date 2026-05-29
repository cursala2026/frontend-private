import { Component, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NotificationsService } from './notifications.service';
import { CourseStartComponent } from './course-start/course-start.component';
import { NoEnrollmentComponent } from './no-enrollment/no-enrollment.component';

@Component({
    selector: 'app-notifications',
    templateUrl: './notifications.component.html',
    standalone: true,
    imports: [ReactiveFormsModule, CourseStartComponent, NoEnrollmentComponent]
})
export class NotificationsComponent {
    constructor(private notificationsService: NotificationsService) {}
    activeTab = signal<'course' | 'no-enrollment'>('course');

    setActiveTab(tab: 'course' | 'no-enrollment') {
        this.activeTab.set(tab);
    }
}
