import { Component, signal, inject, HostListener, OnInit, OnDestroy, computed, effect } from '@angular/core';

import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { interval, Subscription, filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { BunnyConfigService } from '../../../core/services/bunny-config.service';
import { ViewModeService } from '../../../core/services/view-mode.service';
import { QuestionnairesService } from '../../../core/services/questionnaires.service';
import { UserRole } from '../../../core/models/user-role.enum';

interface MenuItem {
  label: string;
  route: string;
}

interface PendingExam {
  submissionId: string;
  questionnaireId: string;
  questionnaireTitle: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  submittedAt: Date;
}

@Component({
  selector: 'app-teacher-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './teacher-layout.component.html',
  
})
export class TeacherLayoutComponent implements OnInit, OnDestroy {
  protected authService = inject(AuthService);
  private router = inject(Router);
  private viewModeService = inject(ViewModeService);
  private questionnairesService = inject(QuestionnairesService);
  private bunnyConfigService = inject(BunnyConfigService);

  isMobileMenuOpen = signal<boolean>(false);
  isUserMenuOpen = signal<boolean>(false);
  imageError = signal<boolean>(false);
  user = this.authService.currentUser;

  constructor() {
    // Resetear error al cambiar el usuario
    effect(() => {
      this.user();
      this.imageError.set(false);
    });
  }

  // Notificaciones deshabilitadas temporalmente
  // pendingExams = signal<PendingExam[]>([]);
  // pendingExamsCount = signal<number>(0);
  // private refreshSubscription?: Subscription;
  // private routerSubscription?: Subscription;
  // private visibilityChangeListener?: () => void;
  // private isTabVisible = true;

  ngOnInit(): void {
    // Asegurar que el modo de vista esté inicializado
    this.viewModeService.initializeViewMode();

    // Notificaciones de exámenes pendientes deshabilitadas temporalmente
    // this.loadPendingExams();
    // this.setupVisibilityListener();
    // this.refreshSubscription = interval(60000).subscribe(() => {
    //   if (this.isTabVisible) {
    //     this.loadPendingExams();
    //   }
    // });
    // this.routerSubscription = this.router.events
    //   .pipe(filter(event => event instanceof NavigationEnd))
    //   .subscribe(() => {
    //     this.loadPendingExams();
    //   });
    // window.addEventListener('exam-graded', () => {
    //   this.loadPendingExams();
    // });
  }

  // Notificaciones deshabilitadas temporalmente
  // private setupVisibilityListener(): void {
  //   this.visibilityChangeListener = () => {
  //     this.isTabVisible = !document.hidden;
  //     if (this.isTabVisible) {
  //       this.loadPendingExams();
  //     }
  //   };
  //   document.addEventListener('visibilitychange', this.visibilityChangeListener);
  // }

  ngOnDestroy(): void {
    // this.refreshSubscription?.unsubscribe();
    // this.routerSubscription?.unsubscribe();
    // if (this.visibilityChangeListener) {
    //   document.removeEventListener('visibilitychange', this.visibilityChangeListener);
    // }
  }

  // loadPendingExams(): void {
  //   this.questionnairesService.getPendingGradingByTeacher().subscribe({
  //     next: (response: any) => {
  //       const exams = response?.data || [];
  //       this.pendingExams.set(Array.isArray(exams) ? exams : []);
  //       this.pendingExamsCount.set(this.pendingExams().length);
  //     },
  //     error: (error) => {
  //       console.error('Error loading pending exams:', error);
  //       this.pendingExams.set([]);
  //       this.pendingExamsCount.set(0);
  //     }
  //   });
  // }

  // goToPendingExams(): void {
  //   this.router.navigate(['/profesor/students']);
  // }

  // Verificar si el usuario es admin
  get isAdmin(): boolean {
    return this.authService.hasRole(UserRole.ADMIN);
  }

  menuItems: MenuItem[] = [
    {
      label: 'Mis Cursos',
      route: '/profesor/courses'
    },
    {
      label: 'Mis Clases',
      route: '/profesor/classes'
    },
    {
      label: 'Mis Cuestionarios',
      route: '/profesor/questionnaires'
    },
    {
      label: 'Mis Alumnos',
      route: '/profesor/students'
    }
  ];


  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(value => !value);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update(value => !value);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  goToProfile(): void {
    this.router.navigate(['/profesor/profile']);
    this.closeUserMenu();
  }

  goToReportIssue(): void {
    this.router.navigate(['/profesor/report-issue']);
    this.closeUserMenu();
  }

  switchToAdminMode(): void {
    this.viewModeService.setViewMode('admin');
    this.router.navigate(['/admin']);
    this.closeUserMenu();
  }

  logout(): void {
    this.authService.logout();
    this.closeUserMenu();
  }

  isActiveRoute(route: string): boolean {
    return this.router.url === route;
  }

  // URL computada robusta y genérica
  userProfileImageUrl = computed(() => {
    const currentUser = this.user();
    return this.bunnyConfigService.convertStorageToCdnUrl(
      currentUser?.profilePhotoUrl, 
      currentUser?.updatedAt
    );
  });

  onImageError(event: Event): void {
    const url = this.userProfileImageUrl();
    console.warn(`TeacherLayout: Error cargando imagen de perfil (${url})`);
    this.imageError.set(true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      this.closeUserMenu();
    }
  }
}



