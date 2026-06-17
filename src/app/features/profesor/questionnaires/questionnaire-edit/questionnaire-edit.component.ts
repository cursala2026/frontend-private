import { Component, OnInit, inject, signal, ChangeDetectorRef, ViewChildren, QueryList, input, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  QuestionnairesService,
  Questionnaire,
  Question,
  QuestionOption
} from '../../../../core/services/questionnaires.service';
import { ClassesService } from '../../../../core/services/classes.service';
import { CourseEventsService } from '../../../../core/services/course-events.service';
import { InfoService } from '../../../../core/services/info.service';
import { QuestionItemComponent } from '../question-item/question-item.component';
import { GradingHelpModalComponent } from '../../../../shared/components/grading-help-modal/grading-help-modal.component';

interface ClassData {
  _id: string;
  name: string;
  order: number;
}

@Component({
  selector: 'app-questionnaire-edit',
  standalone: true,
  imports: [ReactiveFormsModule, QuestionItemComponent, GradingHelpModalComponent],
  templateUrl: './questionnaire-edit.component.html'
})
export class QuestionnaireEditComponent implements OnInit {
  public lastSavePayload: any = null;
  private fb = inject(FormBuilder);
  private questionnairesService = inject(QuestionnairesService);
  private classesService = inject(ClassesService);
  private infoService = inject(InfoService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private courseEvents = inject(CourseEventsService);

  @ViewChildren(QuestionItemComponent) questionItems!: QueryList<QuestionItemComponent>;

  questionnaireForm!: FormGroup;
  isEditMode = false;
  questionnaireId = '';

  classes = signal<ClassData[]>([]);
  questionnaires = signal<Questionnaire[]>([]);
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  hasUnsavedDraft = signal<boolean>(false);
  loadingClasses = signal<boolean>(false);
  preselectedCourseId = signal<string | null>(null);
  preselectedCourseName = signal<string>('');

  externalCourseId = input<string | null | undefined>();
  externalCourseName = input<string | null | undefined>();

  mediaPreviews = signal<{ [questionIndex: number]: string }>({});
  showGradingHelp = signal(false);
  hasSubmissions = signal<boolean>(false);

  // ==========================================
  // CONTROL: Prevención de Cierre (Profesor)
  // ==========================================
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.questionnaireForm?.dirty && !this.saving()) {
      $event.returnValue = true;
    }
  }

  // ==========================================
  // CONTROL: Savepoints Locales (Borrador)
  // ==========================================
  private getDraftKey(): string {
    const cid = this.preselectedCourseId() || 'nocourse';
    const qid = this.questionnaireId || 'new';
    return `cursala_admin_draft_${cid}_${qid}`;
  }

  private saveDraftToLocal(): void {
    if (this.questionnaireForm && this.questionnaireForm.dirty) {
      const draft = this.questionnaireForm.getRawValue();
      localStorage.setItem(this.getDraftKey(), JSON.stringify(draft));
    }
  }

  public checkForDraft(): void {
    const saved = localStorage.getItem(this.getDraftKey());
    if (saved) {
      this.hasUnsavedDraft.set(true);
    }
  }

  public restoreDraftFromLocal(): void {
    const saved = localStorage.getItem(this.getDraftKey());
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        
        while (this.questions.length) {
          this.questions.removeAt(0);
        }
        
        if (draft.questions && Array.isArray(draft.questions)) {
          draft.questions.forEach((q: any) => {
            this.addQuestionFromData(q);
          });
        }

        this.questionnaireForm.patchValue(draft, { emitEvent: false });
        this.questionnaireForm.markAsDirty(); 
        
        this.hasUnsavedDraft.set(false);
        this.infoService.showSuccess('Borrador recuperado con éxito');
      } catch (e) {
        console.error('Error recuperando borrador:', e);
      }
    }
  }

  public discardDraft(): void {
    this.clearAdminDraft();
    this.hasUnsavedDraft.set(false);
    this.infoService.showInfo('Borrador descartado. Comenzando desde cero.');
  }

  private clearAdminDraft(): void {
    localStorage.removeItem(this.getDraftKey());
  }

  ngOnInit(): void {
    this.initForm();

    const extIdRaw = this.externalCourseId?.();
    const extNameRaw = this.externalCourseName?.();

    if (typeof extIdRaw === 'string' && extIdRaw) {
      const extId = extIdRaw;
      this.preselectedCourseId.set(extId);
      this.questionnaireForm.patchValue({ courseId: extId }, { emitEvent: false });
      if (typeof extNameRaw === 'string' && extNameRaw) {
        this.preselectedCourseName.set(extNameRaw);
      }
      this.loadClassesByCourse(extId);
      this.loadQuestionnairesByCourse(extId);
    } else {
      const courseIdFromQuery = this.route.snapshot.queryParamMap.get('courseId');
      const courseNameFromQuery = this.route.snapshot.queryParamMap.get('courseName');
      const isSurveyFromQuery = this.route.snapshot.queryParamMap.get('isSurvey');
      
      if (isSurveyFromQuery === 'true') {
        this.questionnaireForm.patchValue({ isSurvey: true });
      }

      if (courseIdFromQuery) {
        this.preselectedCourseId.set(courseIdFromQuery);
        this.questionnaireForm.patchValue({ courseId: courseIdFromQuery });
        if (courseNameFromQuery) {
          this.preselectedCourseName.set(courseNameFromQuery);
        }
        this.loadClassesByCourse(courseIdFromQuery);
        this.loadQuestionnairesByCourse(courseIdFromQuery);
      }
    }

    try {
      const navState: any = this.router.getCurrentNavigation?.()?.extras?.state;
      if (navState) {
        if (navState.courseId && !this.preselectedCourseId()) {
          this.preselectedCourseId.set(navState.courseId);
          this.questionnaireForm.patchValue({ courseId: navState.courseId });
        }
        if (navState.courseName && !this.preselectedCourseName()) {
          this.preselectedCourseName.set(navState.courseName);
        }
      }
    } catch (e) {}

    this.route.params.subscribe(params => {
      if (params['id'] && params['id'] !== 'new') {
        this.isEditMode = true;
        this.questionnaireId = params['id'];
        this.loadQuestionnaire();
      } else {
        setTimeout(() => this.checkForDraft(), 300);
        this.loading.set(false);
      }
    });

    try {
      this.courseEvents.onQuestionnaireReset().subscribe((qid) => {
        if (this.isEditMode && qid === this.questionnaireId) {
          this.hasSubmissions.set(false);
          try { this.cdr.detectChanges(); } catch (e) {}
        }
      });
    } catch (e) {}
  }

  openGradingHelp(): void {
    this.showGradingHelp.set(true);
  }

  closeGradingHelp(): void {
    this.showGradingHelp.set(false);
  }

  initForm(): void {
    this.questionnaireForm = this.fb.group({
      courseId: ['', Validators.required],
      title: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', Validators.maxLength(1000)],
      isSurvey: [false],
      status: ['ACTIVE', Validators.required],
      positionType: ['BETWEEN_CLASSES', Validators.required],
      afterClassId: [''],
      passingScore: [null, [Validators.min(0), Validators.max(100)]],
      allowRetries: [true],
      maxRetries: [null, Validators.min(1)],
      showCorrectAnswers: [true],
      timeLimitMinutes: [null, [Validators.min(1), Validators.max(1440)]],
      questions: this.fb.array([])
    });

    this.addQuestion();

    this.questionnaireForm.get('allowRetries')?.valueChanges.subscribe(allowRetries => {
      const maxRetriesControl = this.questionnaireForm.get('maxRetries');
      if (allowRetries) {
        maxRetriesControl?.enable();
      } else {
        maxRetriesControl?.disable();
      }
    });

    this.questionnaireForm.get('status')?.valueChanges.subscribe(status => {
      this.updateStatusBasedValidators(status);
    });

    this.questionnaireForm.get('positionType')?.valueChanges.subscribe((posType) => {
      this.updateAfterClassValidators(posType);
    });

    this.questionnaireForm.get('isSurvey')?.valueChanges.subscribe((isSurvey) => {
      const positionTypeControl = this.questionnaireForm.get('positionType');
      if (isSurvey) {
        positionTypeControl?.setValue('FINAL_EXAM', { emitEvent: false });
        positionTypeControl?.disable({ emitEvent: false });
        this.updateAfterClassValidators('FINAL_EXAM');
      } else {
        positionTypeControl?.enable({ emitEvent: false });
      }
      this.questions.controls.forEach(qGroup => qGroup.updateValueAndValidity());
    });

    this.updateStatusBasedValidators(this.questionnaireForm.get('status')?.value);

    this.questionnaireForm.valueChanges.subscribe(() => {
      if (!this.saving()) {
        this.saveDraftToLocal();
      }
    });
  }

  get questions(): FormArray {
    return this.questionnaireForm.get('questions') as FormArray;
  }

  loadQuestionnairesByCourse(courseId: string | null | undefined): void {
    if (!courseId) {
      this.questionnaires.set([]);
      return;
    }
    this.questionnairesService.getQuestionnairesByCourse(courseId).subscribe({
      next: (response) => {
        const questionnairesData = response?.data || [];
        this.questionnaires.set(questionnairesData);
      },
      error: (error) => {
        console.error('Error loading questionnaires:', error);
        this.questionnaires.set([]);
      }
    });
  }

  getAvailableClassesForQuestionnaire(): ClassData[] {
    const allClasses = this.classes();
    const courseQuestionnaires = this.questionnaires();
    const currentQuestionnaireId = this.questionnaireId;
    
    const classesWithQuestionnaires = new Set(
      courseQuestionnaires
        .filter(q => 
          q._id !== currentQuestionnaireId &&
          q.position?.type === 'BETWEEN_CLASSES' && 
          q.position?.afterClassId
        )
        .map(q => q.position!.afterClassId!)
    );
    
    return allClasses.filter(classItem => !classesWithQuestionnaires.has(classItem._id));
  }

  loadClassesByCourse(courseId: string | null | undefined): void {
    if (!courseId) {
      this.classes.set([]);
      this.loadingClasses.set(false);
      return;
    }
    this.loadingClasses.set(true);

    this.classesService.getClassesByCourse(courseId).subscribe({
      next: (response) => {
        const classesData = response?.data || [];
        this.classes.set(classesData.sort((a: ClassData, b: ClassData) => a.order - b.order));
        this.loadingClasses.set(false);
      },
      error: (error) => {
        console.error('Error loading classes:', error);
        this.infoService.showError('Error al cargar las clases');
        this.loadingClasses.set(false);
      }
    });
  }

  loadQuestionnaire(): void {
    this.questionnairesService.getQuestionnaireById(this.questionnaireId).subscribe({
      next: (response) => {
        const questionnaire: Questionnaire = response?.data;
        this.populateForm(questionnaire);
        
        setTimeout(() => this.checkForDraft(), 500);

        this.questionnairesService.hasSubmissions(this.questionnaireId).subscribe({
          next: (resp) => {
            let has = false;
            try {
              if (typeof resp === 'boolean') {
                has = resp;
              } else if (resp && typeof resp === 'object') {
                if (resp.data && typeof resp.data.hasSubmissions === 'boolean') {
                  has = resp.data.hasSubmissions;
                } else if (typeof resp.hasSubmissions === 'boolean') {
                  has = resp.hasSubmissions;
                } else if (resp.data && typeof resp.data.count === 'number') {
                  has = resp.data.count > 0;
                } else if (typeof resp.count === 'number') {
                  has = resp.count > 0;
                }
              }
            } catch (e) {
              has = false;
            }
            this.hasSubmissions.set(!!has);
          },
          error: (err) => {
            console.warn('No se pudo verificar si el cuestionario tiene envíos', err);
            this.hasSubmissions.set(false);
          }
        });

        if (!this.preselectedCourseName()) {
          const maybeName = (response?.data && ((response.data as any).courseName || (response.data as any).course?.name));
          if (maybeName) {
            this.preselectedCourseName.set(maybeName);
          }
        }

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading questionnaire:', error);
        this.infoService.showError('Error al cargar el cuestionario');
        this.router.navigate(['/profesor/questionnaires']);
      }
    });
  }

  populateForm(questionnaire: Questionnaire): void {
    this.loadClassesByCourse(questionnaire.courseId);
    this.loadQuestionnairesByCourse(questionnaire.courseId);

    while (this.questions.length) {
      this.questions.removeAt(0);
    }

    this.questionnaireForm.patchValue({
      courseId: questionnaire.courseId,
      title: questionnaire.title,
      description: questionnaire.description || '',
      isSurvey: questionnaire.isSurvey || false,
      status: questionnaire.status,
      positionType: questionnaire.position?.type || '',
      afterClassId: questionnaire.position?.afterClassId || '',
      passingScore: questionnaire.passingScore,
      allowRetries: questionnaire.allowRetries,
      maxRetries: questionnaire.maxRetries,
      showCorrectAnswers: questionnaire.showCorrectAnswers,
      timeLimitMinutes: questionnaire.timeLimitMinutes || null
    });

    questionnaire.questions.forEach(question => {
      this.addQuestionFromData(question);
    });
    
    setTimeout(() => {
      this.questions.controls.forEach((questionGroup, index) => {
        if (questionGroup.get('type')?.value === 'MULTIPLE_CHOICE') {
          const correctOptionIdControl = questionGroup.get('correctOptionId');
          const originalCorrectOptionId = questionGroup.get('originalCorrectOptionId')?.value;
          
          if (originalCorrectOptionId && correctOptionIdControl) {
            const optionsArray = questionGroup.get('options') as FormArray;
            const correctIndex = optionsArray.controls.findIndex((opt: any) => {
              const optId = opt.get('_id')?.value;
              return optId && optId.toString() === originalCorrectOptionId.toString();
            });
            
            if (correctIndex >= 0 && correctOptionIdControl.value !== correctIndex.toString()) {
              correctOptionIdControl.setValue(correctIndex.toString(), { emitEvent: false });
              this.cdr.detectChanges();
            }
          }
        }
      });
    }, 200);
  }

  createQuestionGroup(question?: Question): FormGroup {
    const group = this.fb.group({
      _id: [question?._id || undefined],
      type: [question?.type || 'MULTIPLE_CHOICE', Validators.required],
      questionText: [question?.questionText || '', [Validators.required, Validators.maxLength(1000)]],
      points: [question?.points || (this.questionnaireForm?.get('isSurvey')?.value ? 0 : 10), [Validators.required, Validators.min(0)]],
      required: [question?.required ?? true],
      options: this.fb.array([]),
      correctOptionId: [''], 
      correctOptionIds: this.fb.control<string[]>([]), 
      originalCorrectOptionId: [question?.correctOptionId || null], 
      originalCorrectOptionIds: this.fb.control<string[]>(question?.correctOptionIds || []), 
      
      scaleMin: [question?.scaleMin ?? 1],
      scaleMax: [question?.scaleMax ?? 10],
      scaleMinLabel: [question?.scaleMinLabel || ''],
      scaleMaxLabel: [question?.scaleMaxLabel || ''],

      promptType: [question?.promptType || 'TEXT'],
      promptMediaUrl: [question?.promptMediaUrl || ''],
      promptMediaProvider: [question?.promptMediaProvider || 'BUNNY']
    });

    group.setValidators(this.questionGroupValidator.bind(this));

    const optionsArray = group.get('options') as FormArray;
    optionsArray.valueChanges.subscribe(() => {
      group.updateValueAndValidity({ onlySelf: true });
    });

    if (question && (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_SELECT') && question.options) {
      question.options.forEach(opt => {
        optionsArray.push(this.createOptionGroup(opt));
      });
      
      if (question.type === 'MULTIPLE_CHOICE' && question.correctOptionId) {
        const correctOptionIdStr = question.correctOptionId.toString();
        if (correctOptionIdStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(correctOptionIdStr)) {
          const correctIndex = question.options.findIndex(
            (opt: any) => opt._id?.toString() === correctOptionIdStr
          );
          
          if (correctIndex >= 0) {
            group.patchValue({ originalCorrectOptionId: correctOptionIdStr }, { emitEvent: false });
            const correctOptionIdControl = group.get('correctOptionId');
            if (correctOptionIdControl) {
              correctOptionIdControl.setValue(correctIndex.toString(), { emitEvent: false });
              setTimeout(() => {
                correctOptionIdControl.setValue(correctIndex.toString(), { emitEvent: false });
                this.cdr.detectChanges(); 
              }, 100);
            }
          } else {
            const parsedIndex = parseInt(correctOptionIdStr);
            if (!isNaN(parsedIndex) && parsedIndex >= 0) {
              group.get('correctOptionId')?.setValue(parsedIndex.toString(), { emitEvent: false });
            } else {
              group.get('correctOptionId')?.setValue(correctOptionIdStr, { emitEvent: false });
            }
          }
        } else {
          const parsedIndex = parseInt(correctOptionIdStr);
          if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            group.get('correctOptionId')?.setValue(parsedIndex.toString(), { emitEvent: false });
          } else {
            group.get('correctOptionId')?.setValue(correctOptionIdStr, { emitEvent: false });
          }
        }
      }
      
      if (question.type === 'MULTIPLE_SELECT' && question.correctOptionIds) {
        const correctOptionIds = question.correctOptionIds;
        const indices: string[] = [];
        
        correctOptionIds.forEach((optionId: any) => {
          const optionIdStr = optionId.toString();
          if (optionIdStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(optionIdStr)) {
            const idx = question.options?.findIndex(
              (opt: any) => opt._id?.toString() === optionIdStr
            );
            if (idx !== undefined && idx >= 0) {
              indices.push(idx.toString());
            }
          } else {
            indices.push(optionIdStr);
          }
        });
        
        group.patchValue({ 
          originalCorrectOptionIds: correctOptionIds,
          correctOptionIds: indices 
        }, { emitEvent: false });
      }
    } else if (!question || question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_SELECT') {
      const optionsArray = group.get('options') as FormArray;
      for (let i = 0; i < 4; i++) {
        optionsArray.push(this.createOptionGroup());
      }
    }

    return group;
  }

  private questionGroupValidator(control: AbstractControl): ValidationErrors | null {
    const isDraft = this.questionnaireForm?.get('status')?.value === 'DRAFT';
    const isSurvey = this.questionnaireForm?.get('isSurvey')?.value === true; 

    if (isDraft) {
      return null; 
    }

    const type = control.get('type')?.value;
    const options = control.get('options') as FormArray | null;
    const errors: any = {};

    if (type === 'MULTIPLE_CHOICE' || type === 'MULTIPLE_SELECT') {
      if (!options || options.length < 2) {
        errors.optionsCount = 'Debe haber al menos 2 opciones';
      }

      if (options) {
        const emptyIndexes: number[] = [];
        for (let i = 0; i < options.length; i++) {
          const txtCtrl = options.at(i).get('text');
          const txtVal = txtCtrl?.value;
          if (!txtVal || (typeof txtVal === 'string' && txtVal.trim() === '')) {
            emptyIndexes.push(i);
          }
        }
        if (emptyIndexes.length) {
          errors.optionTextEmpty = `Hay ${emptyIndexes.length} opción(es) sin texto`;
        }
      }

      if (!isSurvey) {
        if (type === 'MULTIPLE_CHOICE') {
          const correct = control.get('correctOptionId')?.value;
          if (correct === null || correct === undefined || correct === '') {
            errors.noCorrect = 'Selecciona una opción correcta';
          }
        }

        if (type === 'MULTIPLE_SELECT') {
          const corrects = control.get('correctOptionIds')?.value || [];
          if (!Array.isArray(corrects) || corrects.length === 0) {
            errors.noCorrect = 'Selecciona al menos una opción correcta';
          }
        }
      }
    }

    return Object.keys(errors).length ? errors : null;
  }

  private updateAfterClassValidators(posType: string | null) {
    const afterClassControl = this.questionnaireForm.get('afterClassId');
    if (!afterClassControl) return;

    const isDraft = this.questionnaireForm.get('status')?.value === 'DRAFT';
    if (isDraft) {
      afterClassControl.clearValidators();
      afterClassControl.updateValueAndValidity({ onlySelf: true });
      return;
    }

    if (posType === 'BETWEEN_CLASSES') {
      afterClassControl.setValidators([Validators.required]);
      afterClassControl.enable({ emitEvent: false });
    } else {
      afterClassControl.clearValidators();
      afterClassControl.setValue('', { emitEvent: false });
      afterClassControl.disable({ emitEvent: false });
    }
    afterClassControl.updateValueAndValidity({ onlySelf: true });
  }

  public updateStatusBasedValidators(status: string): void {
    const isDraft = status === 'DRAFT';
    const positionTypeCtrl = this.questionnaireForm?.get('positionType');
    const afterClassCtrl = this.questionnaireForm?.get('afterClassId');

    if (isDraft) {
      positionTypeCtrl?.clearValidators();
      afterClassCtrl?.clearValidators();
    } else {
      positionTypeCtrl?.setValidators([Validators.required]);
      if (positionTypeCtrl?.value === 'BETWEEN_CLASSES') {
        afterClassCtrl?.setValidators([Validators.required]);
      } else {
        afterClassCtrl?.clearValidators();
      }
    }
    
    positionTypeCtrl?.updateValueAndValidity({ emitEvent: false });
    afterClassCtrl?.updateValueAndValidity({ emitEvent: false });

    this.questions?.controls.forEach(qGroup => {
      qGroup.updateValueAndValidity({ onlySelf: true });
    });
    
    this.questionnaireForm?.updateValueAndValidity({ emitEvent: false });
  }

  createOptionGroup(option?: QuestionOption): FormGroup {
    const groupConfig: any = {
      text: [option?.text || '', [Validators.required, Validators.maxLength(500)]],
      order: [option?.order || 0]
    };
    if (option && option._id) {
      groupConfig._id = [option._id];
    }
    return this.fb.group(groupConfig);
  }

  addQuestion(): void {
    if (this.isEditMode && this.hasSubmissions()) {
      this.infoService.showError('Este cuestionario ya tiene envíos; no se puede agregar nuevas preguntas.');
      return;
    }
    this.questions.push(this.createQuestionGroup());
  }

  addQuestionFromData(question: Question): void {
    this.questions.push(this.createQuestionGroup(question));
  }

  removeQuestion(index: number): void {
    if (this.isEditMode && this.hasSubmissions()) {
      this.infoService.showError('Este cuestionario ya tiene envíos; no se pueden eliminar preguntas.');
      return;
    }
    const isDraft = this.questionnaireForm?.get('status')?.value === 'DRAFT';
    if (this.questions.length > 1 || isDraft) {
      this.questions.removeAt(index);
    } else {
      this.infoService.showError('Debe haber al menos una pregunta');
    }
  }

  onSubmit(): void {
    this.autoFillEmptyOptionTexts();

    if (this.questionnaireForm.invalid) {
      this.questionnaireForm.markAllAsTouched();
      this.infoService.showError('Por favor, completa todos los campos requeridos');
      return;
    }

    const isDraft = this.questionnaireForm.get('status')?.value === 'DRAFT';
    const isSurvey = this.questionnaireForm.get('isSurvey')?.value === true;
    
    if (!isDraft && !isSurvey) {
      for (let i = 0; i < this.questions.length; i++) {
        const question = this.questions.at(i);
        const type = question.get('type')?.value;
        
        if (type === 'MULTIPLE_CHOICE') {
          if (!question.get('correctOptionId')?.value) {
            this.infoService.showError(`Debes seleccionar la respuesta correcta para la pregunta ${i + 1}`);
            return;
          }
        }
        
        if (type === 'MULTIPLE_SELECT') {
          const correctOptionIds = question.get('correctOptionIds')?.value || [];
          if (correctOptionIds.length === 0) {
            this.infoService.showError(`Debes seleccionar al menos una respuesta correcta para la pregunta ${i + 1}`);
            return;
          }
        }
      }
    } 

    this.saving.set(true);

    const formValue = this.questionnaireForm.getRawValue();
    
    const questions: Question[] = formValue.questions.map((q: any, index: number) => {
      const question: any = {
        type: q.type,
        questionText: q.questionText,
        order: index,
        points: q.points,
        required: q.required,
        promptType: q.promptType || 'TEXT',
        promptMediaUrl: q.promptMediaUrl || undefined,
        promptMediaProvider: q.promptMediaProvider || undefined,
        scaleMin: q.scaleMin,
        scaleMax: q.scaleMax,
        scaleMinLabel: q.scaleMinLabel,
        scaleMaxLabel: q.scaleMaxLabel
      };

      if (q.type === 'MULTIPLE_CHOICE') {
        if (q._id) {
          question._id = q._id;
        }
        question.options = q.options.map((opt: any, optIndex: number) => {
          const o: any = { text: opt.text, order: optIndex };
          if (opt._id) {
            o._id = opt._id;
          }
          return o;
        });

        if (q.correctOptionId !== null && q.correctOptionId !== undefined && q.correctOptionId !== '') {
          const correctOptionIdStr = q.correctOptionId.toString();
          if (correctOptionIdStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(correctOptionIdStr)) {
            const idx = q.options.findIndex((opt: any) => opt._id?.toString() === correctOptionIdStr);
            if (idx >= 0) {
              question.correctOptionId = idx.toString();
            } else {
              const parsedIndex = parseInt(correctOptionIdStr);
              question.correctOptionId = !isNaN(parsedIndex) && parsedIndex >= 0 ? correctOptionIdStr : '0';
            }
          } else {
            question.correctOptionId = correctOptionIdStr;
          }
        } else {
          question.correctOptionId = '0';
        }
      }

      if (q.type === 'MULTIPLE_SELECT') {
        if (q._id) {
          question._id = q._id;
        }
        question.options = q.options.map((opt: any, optIndex: number) => {
          const o: any = { text: opt.text, order: optIndex };
          if (opt._id) {
            o._id = opt._id;
          }
          return o;
        });

        const selectedValues = q.correctOptionIds || [];
        const correctOptionIds: string[] = [];

        selectedValues.forEach((val: any) => {
          const valStr = val.toString();
          if (valStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(valStr)) {
            const idx = q.options.findIndex((opt: any) => opt._id?.toString() === valStr);
            if (idx >= 0) {
              correctOptionIds.push(idx.toString());
            }
          } else {
            correctOptionIds.push(valStr);
          }
        });

        question.correctOptionIds = correctOptionIds;
      }

      return question;
    });

    const cleanedQuestions = questions.map(q => {
      if (q.promptMediaUrl && q.promptMediaUrl.startsWith('blob:')) {
        const { promptMediaUrl, promptMediaProvider, ...rest } = q;
        return rest;
      }
      return q;
    });

    const questionnaireData: Partial<Questionnaire> = {
      courseId: formValue.courseId,
      title: formValue.title,
      description: formValue.description,
      status: formValue.status,
      isSurvey: formValue.isSurvey,
      ...(formValue.positionType ? {
        position: {
          type: formValue.positionType,
          afterClassId: (formValue.positionType === 'BETWEEN_CLASSES' && formValue.afterClassId) ? formValue.afterClassId : undefined
        }
      } : {}),
      ...(this.isEditMode && this.hasSubmissions() ? {} : { questions: cleanedQuestions }),
      passingScore: isSurvey ? 0 : (formValue.passingScore || 0),
      allowRetries: formValue.allowRetries,
      maxRetries: formValue.allowRetries ? formValue.maxRetries : undefined,
      showCorrectAnswers: formValue.showCorrectAnswers,
      timeLimitMinutes: formValue.timeLimitMinutes || undefined
    };

    try { (this as any).lastSavePayload = questionnaireData; } catch (e) { }

    const request = this.isEditMode
      ? this.questionnairesService.updateQuestionnaire(this.questionnaireId, questionnaireData)
      : this.questionnairesService.createQuestionnaire(questionnaireData);

    request.subscribe({
      next: (response) => {
        const savedQuestionnaire = response?.data;
        this.clearAdminDraft();

        const hasPendingUploads = this.questionItems?.some((qc: QuestionItemComponent) => !!qc.pendingFile);

        if (savedQuestionnaire && hasPendingUploads) {
          if (!this.isEditMode) {
            this.questionnaireId = savedQuestionnaire._id;
            this.isEditMode = true;
          }
          this.startChildrenPendingUploads(savedQuestionnaire, formValue.courseId);
        } else {
          this.infoService.showSuccess(
            this.isEditMode ? 'Cuestionario actualizado exitosamente' : 'Cuestionario creado exitosamente'
          );
          try { this.courseEvents.emitCourseReload(formValue.courseId); } catch (e) {}
          this.router.navigate(['/profesor/questionnaires'], {
            queryParams: { courseId: formValue.courseId }
          });
        }
      },
      error: (error) => {
        console.error('Error saving questionnaire:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error al guardar el cuestionario';
        this.infoService.showError(errorMsg);
        this.saving.set(false);
      }
    });
  }

  private autoFillEmptyOptionTexts(): void {
    for (let i = 0; i < this.questions.length; i++) {
      const questionGroup = this.questions.at(i);
      const options = questionGroup.get('options') as FormArray | null;
      if (!options) continue;
      for (let j = 0; j < options.length; j++) {
        const opt = options.at(j);
        const textCtrl = opt.get('text');
        if (!textCtrl) continue;
        const val = textCtrl.value;
        if (!val || (typeof val === 'string' && val.trim() === '')) {
          textCtrl.setValue(`Opción ${j + 1}`, { emitEvent: false });
        }
        textCtrl.markAsTouched();
      }
      questionGroup.updateValueAndValidity({ onlySelf: true });
    }
  }

  cancel(): void {
    this.clearAdminDraft();
    this.router.navigate(['/profesor/questionnaires']);
  }

  removeMedia(questionIndex: number): void {
    const question = this.questions.at(questionIndex);
    question.patchValue({
      promptType: 'TEXT',
      promptMediaUrl: '',
      promptMediaProvider: 'BUNNY'
    });
    this.infoService.showSuccess('Archivo multimedia eliminado');
  }

  getMediaPreview(questionIndex: number): string | null {
    const question = this.questions.at(questionIndex);
    const promptMediaUrl = question.value.promptMediaUrl;
    const localPreview = this.mediaPreviews()[questionIndex];

    return localPreview || promptMediaUrl || null;
  }

  private async startChildrenPendingUploads(questionnaire: Questionnaire, courseId: string) {
    const children = this.questionItems?.toArray() || [];
    const tasks: Promise<boolean>[] = [];

    questionnaire.questions.forEach((q: any, idx: number) => {
      const child = children[idx];
      if (child && typeof child.startPendingUpload === 'function' && q && q._id) {
        const questionControl = this.questions.at(idx);
        questionControl.patchValue({ _id: q._id });
        tasks.push(child.startPendingUpload(q._id, this.questionnaireId));
      }
    });

    if (tasks.length === 0) {
      this.infoService.showSuccess('Cuestionario creado exitosamente');
      this.router.navigate(['/profesor/questionnaires'], { queryParams: { courseId } });
      return;
    }

    this.infoService.showInfo(`Subiendo ${tasks.length} archivo(s) multimedia...`);
    const results = await Promise.allSettled(tasks);
    const hasErrors = results.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false));
    this.saving.set(false);
    if (hasErrors) {
      this.infoService.showError('Cuestionario creado, pero algunos archivos multimedia no se pudieron subir');
    } else {
      this.infoService.showSuccess('Cuestionario creado exitosamente con todos los archivos multimedia');
    }
    this.router.navigate(['/profesor/questionnaires'], { queryParams: { courseId } });
  }

  finishPendingUploads(hasErrors: boolean, courseId: string): void {
    this.saving.set(false);
    
    if (hasErrors) {
      this.infoService.showError('Cuestionario creado, pero algunos archivos multimedia no se pudieron subir');
    } else {
      this.infoService.showSuccess('Cuestionario creado exitosamente con todos los archivos multimedia');
    }
    
    this.router.navigate(['/profesor/questionnaires'], {
      queryParams: { courseId }
    });
  }
}