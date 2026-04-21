import { Component, OnInit, inject, signal, ChangeDetectorRef, ViewChildren, QueryList, input } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, ReactiveFormsModule, QuestionItemComponent, GradingHelpModalComponent],
  templateUrl: './questionnaire-edit.component.html'
})
export class QuestionnaireEditComponent implements OnInit {
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
  questionnaires = signal<Questionnaire[]>([]); // Questionnaires of the selected course
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  loadingClasses = signal<boolean>(false);
  preselectedCourseId = signal<string | null>(null); // CourseId from query params
  preselectedCourseName = signal<string>(''); // Name of the preselected course

  // Allow optional external inputs (when parent/launcher provides them instead of navigating)
  externalCourseId = input<string | null | undefined>();
  externalCourseName = input<string | null | undefined>();

  // Media upload tracking
  // Media upload tracking is handled by each QuestionItem child
  mediaPreviews = signal<{ [questionIndex: number]: string }>({});
  // Grading help modal visibility
  showGradingHelp = signal(false);
  // pendingMediaFiles removed: each QuestionItem handles its own pending upload

  ngOnInit(): void {
    this.initForm();

    // Check for preselected courseId from query params (only in create mode)
    // Priority: external inputs passed via `input()` from a parent component
    const extIdRaw = this.externalCourseId?.();
    const extNameRaw = this.externalCourseName?.();

    if (typeof extIdRaw === 'string' && extIdRaw) {
      // Parent provided an id (and maybe a name) — use id and load related data
      const extId = extIdRaw;
      this.preselectedCourseId.set(extId);
      this.questionnaireForm.patchValue({ courseId: extId }, { emitEvent: false });
      if (typeof extNameRaw === 'string' && extNameRaw) {
        this.preselectedCourseName.set(extNameRaw);
      }
      this.loadClassesByCourse(extId);
      this.loadQuestionnairesByCourse(extId);
    } else {
      // Fallback to query params (existing behavior)
      const courseIdFromQuery = this.route.snapshot.queryParamMap.get('courseId');
      const courseNameFromQuery = this.route.snapshot.queryParamMap.get('courseName');
      if (courseIdFromQuery) {
        this.preselectedCourseId.set(courseIdFromQuery);
        this.questionnaireForm.patchValue({ courseId: courseIdFromQuery });
        // Use the course name from query params (should always be provided)
        if (courseNameFromQuery) {
          this.preselectedCourseName.set(courseNameFromQuery);
        }
        // Load classes for the preselected course
        this.loadClassesByCourse(courseIdFromQuery);
        // Load questionnaires to filter available classes
        this.loadQuestionnairesByCourse(courseIdFromQuery);
      }
    }

    // Also accept courseName/courseId passed via navigation state (navigationExtras.state)
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
    } catch (e) {
      // ignore - getCurrentNavigation may be undefined or throw in some contexts
    }

    // Check if edit mode
    this.route.params.subscribe(params => {
      if (params['id'] && params['id'] !== 'new') {
        this.isEditMode = true;
        this.questionnaireId = params['id'];
        // In edit mode, load the questionnaire data
        this.loadQuestionnaire();
      } else {
        // In create mode, we expect courseId and courseName to be provided
        this.loading.set(false);
      }
    });
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

    // Add at least one question by default
    this.addQuestion();

    // Subscribe to allowRetries changes to enable/disable maxRetries
    this.questionnaireForm.get('allowRetries')?.valueChanges.subscribe(allowRetries => {
      const maxRetriesControl = this.questionnaireForm.get('maxRetries');
      if (allowRetries) {
        maxRetriesControl?.enable();
      } else {
        maxRetriesControl?.disable();
      }
    });

    // Subscribe to positionType changes to conditionally require afterClassId
    this.questionnaireForm.get('positionType')?.valueChanges.subscribe((posType) => {
      this.updateAfterClassValidators(posType);
    });
    // apply initial validators for afterClassId
    this.updateAfterClassValidators(this.questionnaireForm.get('positionType')?.value);
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
    const currentQuestionnaireId = this.questionnaireId; // Current questionnaire being edited
    
    // Get class IDs that already have a questionnaire after them (excluding current questionnaire if editing)
    const classesWithQuestionnaires = new Set(
      courseQuestionnaires
        .filter(q => 
          q._id !== currentQuestionnaireId && // Exclude current questionnaire if editing
          q.position?.type === 'BETWEEN_CLASSES' && 
          q.position?.afterClassId
        )
        .map(q => q.position!.afterClassId!)
    );
    
    // Filter out classes that already have questionnaires after them
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

        // If we don't have the course name yet, try to get it from the response
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
    // Load classes for the course first
    this.loadClassesByCourse(questionnaire.courseId);
    // Load questionnaires to filter available classes
    this.loadQuestionnairesByCourse(questionnaire.courseId);

    // Clear existing questions
    while (this.questions.length) {
      this.questions.removeAt(0);
    }

    // Populate form
    this.questionnaireForm.patchValue({
      courseId: questionnaire.courseId,
      title: questionnaire.title,
      description: questionnaire.description || '',
      isSurvey: questionnaire.isSurvey || false,
      status: questionnaire.status,
      positionType: questionnaire.position.type,
      afterClassId: questionnaire.position.afterClassId || '',
      passingScore: questionnaire.passingScore,
      allowRetries: questionnaire.allowRetries,
      maxRetries: questionnaire.maxRetries,
      showCorrectAnswers: questionnaire.showCorrectAnswers,
      timeLimitMinutes: questionnaire.timeLimitMinutes || null
    });

    // Add questions
    questionnaire.questions.forEach(question => {
      this.addQuestionFromData(question);
    });
    
    // After all questions are added, ensure correctOptionId values are set
    setTimeout(() => {
      this.questions.controls.forEach((questionGroup, index) => {
        if (questionGroup.get('type')?.value === 'MULTIPLE_CHOICE') {
          const correctOptionIdControl = questionGroup.get('correctOptionId');
          const originalCorrectOptionId = questionGroup.get('originalCorrectOptionId')?.value;
          
          if (originalCorrectOptionId && correctOptionIdControl) {
            // Find the index of the option with the original ObjectId
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
      type: [question?.type || 'MULTIPLE_CHOICE', Validators.required],
      questionText: [question?.questionText || '', [Validators.required, Validators.maxLength(1000)]],
      points: [question?.points || 10, [Validators.required, Validators.min(1)]],
      required: [question?.required ?? true],
      options: this.fb.array([]),
      correctOptionId: [''], // This will store the index as string for the radio button (MULTIPLE_CHOICE)
      correctOptionIds: this.fb.control<string[]>([]), // This will store array of indices for checkboxes (MULTIPLE_SELECT)
      originalCorrectOptionId: [question?.correctOptionId || null], // Store original ObjectId from backend
      originalCorrectOptionIds: this.fb.control<string[]>(question?.correctOptionIds || []), // Store original ObjectIds for MULTIPLE_SELECT
      promptType: [question?.promptType || 'TEXT'],
      promptMediaUrl: [question?.promptMediaUrl || ''],
      promptMediaProvider: [question?.promptMediaProvider || 'BUNNY']
    });

    // Attach a validator that enforces options count and correct answer presence
    group.setValidators(this.questionGroupValidator.bind(this));

    // Ensure group validity updates when options change
    const optionsArray = group.get('options') as FormArray;
    optionsArray.valueChanges.subscribe(() => {
      group.updateValueAndValidity({ onlySelf: true });
    });
    // If multiple choice or multiple select, add options
    if (question && (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_SELECT') && question.options) {
      const optionsArray = group.get('options') as FormArray;
      question.options.forEach(opt => {
        optionsArray.push(this.createOptionGroup(opt));
      });
      
      // Set correctOptionId after options are added (for MULTIPLE_CHOICE)
      if (question.type === 'MULTIPLE_CHOICE' && question.correctOptionId) {
        const correctOptionIdStr = question.correctOptionId.toString();
        
        // Check if it's an ObjectId (24 hex characters)
        if (correctOptionIdStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(correctOptionIdStr)) {
          // Find the index of the option with this _id
          const correctIndex = question.options.findIndex(
            (opt: any) => opt._id?.toString() === correctOptionIdStr
          );
          
          if (correctIndex >= 0) {
            // Store the original ObjectId for later use when saving
            group.patchValue({ originalCorrectOptionId: correctOptionIdStr }, { emitEvent: false });
            
            // Use string for radio button compatibility (HTML inputs use strings)
            const correctOptionIdControl = group.get('correctOptionId');
            if (correctOptionIdControl) {
              // Set value immediately
              correctOptionIdControl.setValue(correctIndex.toString(), { emitEvent: false });
              // Also use setTimeout as backup to ensure it's set after render
              setTimeout(() => {
                correctOptionIdControl.setValue(correctIndex.toString(), { emitEvent: false });
                this.cdr.detectChanges(); // Force change detection
              }, 100);
            }
          } else {
            // If not found, try to parse as index
            const parsedIndex = parseInt(correctOptionIdStr);
            if (!isNaN(parsedIndex) && parsedIndex >= 0) {
              group.get('correctOptionId')?.setValue(parsedIndex.toString(), { emitEvent: false });
            } else {
              // If not found, keep the ObjectId (will be handled on save)
              group.get('correctOptionId')?.setValue(correctOptionIdStr, { emitEvent: false });
            }
          }
        } else {
          // It's already an index or other value - try to parse as number then convert to string
          const parsedIndex = parseInt(correctOptionIdStr);
          if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            group.get('correctOptionId')?.setValue(parsedIndex.toString(), { emitEvent: false });
          } else {
            group.get('correctOptionId')?.setValue(correctOptionIdStr, { emitEvent: false });
          }
        }
      }
      
      // Set correctOptionIds after options are added (for MULTIPLE_SELECT)
      if (question.type === 'MULTIPLE_SELECT' && question.correctOptionIds) {
        const correctOptionIds = question.correctOptionIds;
        const indices: string[] = [];
        
        correctOptionIds.forEach((optionId: any) => {
          const optionIdStr = optionId.toString();
          
          // Check if it's an ObjectId
          if (optionIdStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(optionIdStr)) {
            // Find the index of the option with this _id
            const idx = question.options?.findIndex(
              (opt: any) => opt._id?.toString() === optionIdStr
            );
            if (idx !== undefined && idx >= 0) {
              indices.push(idx.toString());
            }
          } else {
            // It's already an index
            indices.push(optionIdStr);
          }
        });
        
        group.patchValue({ 
          originalCorrectOptionIds: correctOptionIds,
          correctOptionIds: indices 
        }, { emitEvent: false });
      }
    } else if (!question || question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_SELECT') {
      // Add default 4 options for new MC/MS questions
      const optionsArray = group.get('options') as FormArray;
      for (let i = 0; i < 4; i++) {
        optionsArray.push(this.createOptionGroup());
      }
    }

    return group;
  }

  // Validator for each question group
  private questionGroupValidator(control: AbstractControl): ValidationErrors | null {
    const type = control.get('type')?.value;
    const options = control.get('options') as FormArray | null;
    const errors: any = {};

    if (type === 'MULTIPLE_CHOICE' || type === 'MULTIPLE_SELECT') {
      if (!options || options.length < 2) {
        errors.optionsCount = 'Debe haber al menos 2 opciones';
      }

      // Ensure every option has text
      if (options) {
        const emptyIndexes: number[] = [];
        for (let i = 0; i < options.length; i++) {
          const txtCtrl = options.at(i).get('text');
          const txtVal = txtCtrl?.value;
          if (!txtVal || (typeof txtVal === 'string' && txtVal.trim() === '')) {
            emptyIndexes.push(i);
            // mark control as touched so template shows per-option error
            try { txtCtrl?.markAsTouched(); } catch {}
            // explicitly set required error so control.invalid becomes true
            try { txtCtrl?.setErrors({ required: true }); } catch {}
          }
        }
        if (emptyIndexes.length) {
          errors.optionTextEmpty = `Hay ${emptyIndexes.length} opción(es) sin texto`;
        }
      }

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

    return Object.keys(errors).length ? errors : null;
  }

  private updateAfterClassValidators(posType: string | null) {
    const afterClassControl = this.questionnaireForm.get('afterClassId');
    if (!afterClassControl) return;

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
    this.questions.push(this.createQuestionGroup());
  }

  addQuestionFromData(question: Question): void {
    this.questions.push(this.createQuestionGroup(question));
  }

  removeQuestion(index: number): void {
    if (this.questions.length > 1) {
      this.questions.removeAt(index);
    } else {
      this.infoService.showError('Debe haber al menos una pregunta');
    }
  }

  
 

  onSubmit(): void {
    // Auto-fill empty option texts so the form can validate (helps UX when users forget)
    this.autoFillEmptyOptionTexts();

    if (this.questionnaireForm.invalid) {
      this.questionnaireForm.markAllAsTouched();
      this.infoService.showError('Por favor, completa todos los campos requeridos');
      return;
    }

    // Validate that MC/MS questions have correct answer(s) selected
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

    this.saving.set(true);

    const formValue = this.questionnaireForm.value;

    // Process questions
    const questions: Question[] = formValue.questions.map((q: any, index: number) => {
      const question: any = {
        type: q.type,
        questionText: q.questionText,
        order: index,
        points: q.points,
        required: q.required,
        promptType: q.promptType || 'TEXT',
        promptMediaUrl: q.promptMediaUrl || undefined,
        promptMediaProvider: q.promptMediaProvider || undefined
      };

      if (q.type === 'MULTIPLE_CHOICE') {
        question.options = q.options.map((opt: any, optIndex: number) => {
          const o: any = { text: opt.text, order: optIndex };
          if (opt._id) {
            o._id = opt._id;
          }
          return o;
        });

        // Find the correct option ID
        // Priority: Use the selected option's _id (from form), not the original
        if (q.correctOptionId !== null && q.correctOptionId !== undefined && q.correctOptionId !== '') {
          const correctOptionIdStr = q.correctOptionId.toString();
          
          // Check if it's an ObjectId (24 hex characters)
          if (correctOptionIdStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(correctOptionIdStr)) {
            // It's an ObjectId, verify it exists in options
            const correctOption = question.options?.find((opt: any) => opt._id?.toString() === correctOptionIdStr);
            if (correctOption) {
              // Use the ObjectId directly
              question.correctOptionId = correctOptionIdStr;
            } else {
              // ObjectId not found in options - this shouldn't happen, but try to use original as fallback
              const originalCorrectOptionId = q.originalCorrectOptionId;
              if (originalCorrectOptionId && typeof originalCorrectOptionId === 'string' && originalCorrectOptionId.length === 24) {
                question.correctOptionId = originalCorrectOptionId;
              } else {
                question.correctOptionId = correctOptionIdStr;
              }
            }
          } else {
            // It's likely an index (number or string number)
            const selectedOptionIndex = parseInt(correctOptionIdStr);
            if (!isNaN(selectedOptionIndex) && selectedOptionIndex >= 0 && question.options && question.options[selectedOptionIndex]) {
              // Check if the option has an existing _id (editing mode)
              const selectedOption = question.options[selectedOptionIndex];
              const originalCorrectOptionId = q.originalCorrectOptionId;
              
              if (selectedOption._id) {
                // ALWAYS use originalCorrectOptionId if it matches the selected option's _id
                // This ensures we don't send a different ObjectId for the same option
                if (originalCorrectOptionId && 
                    typeof originalCorrectOptionId === 'string' && 
                    originalCorrectOptionId.length === 24 &&
                    selectedOption._id.toString() === originalCorrectOptionId) {
                  // Same option as original, use originalCorrectOptionId to avoid false positives
                  question.correctOptionId = originalCorrectOptionId;
                } else {
                  // Different option selected - check if originalCorrectOptionId exists in any option
                  // If it does, and it's not the selected one, the user changed the answer
                  const originalOptionExists = question.options?.some((opt: any) => opt._id?.toString() === originalCorrectOptionId);
                  if (originalOptionExists && originalCorrectOptionId !== selectedOption._id.toString()) {
                    // User changed the answer - use the new ObjectId
                    question.correctOptionId = selectedOption._id.toString();
                  } else {
                    // Use the selected option's ObjectId
                    question.correctOptionId = selectedOption._id.toString();
                  }
                }
              } else {
                // New option, use index as string (backend will convert to ObjectId)
                question.correctOptionId = selectedOptionIndex.toString();
              }
            } else {
              // Invalid index - try to use originalCorrectOptionId as fallback
              const originalCorrectOptionId = q.originalCorrectOptionId;
              if (originalCorrectOptionId && typeof originalCorrectOptionId === 'string' && originalCorrectOptionId.length === 24) {
                question.correctOptionId = originalCorrectOptionId;
              } else {
                // Invalid value - this shouldn't happen, but try to use as-is, backend will validate
                question.correctOptionId = correctOptionIdStr;
              }
            }
          }
        } else {
          // No correctOptionId set - try to use originalCorrectOptionId as fallback
          const originalCorrectOptionId = q.originalCorrectOptionId;
          if (originalCorrectOptionId && typeof originalCorrectOptionId === 'string' && originalCorrectOptionId.length === 24) {
            question.correctOptionId = originalCorrectOptionId;
          } else {
            // No correctOptionId set - this is an error for MULTIPLE_CHOICE
            throw new Error(`La pregunta ${index + 1} de opción múltiple debe tener una respuesta correcta seleccionada`);
          }
        }
      }

      if (q.type === 'MULTIPLE_SELECT') {
        question.options = q.options.map((opt: any, optIndex: number) => {
          const o: any = { text: opt.text, order: optIndex };
          if (opt._id) {
            o._id = opt._id;
          }
          return o;
        });

        // Map correctOptionIds (array of indices) to array of ObjectIds or indices
        const selectedIndices = q.correctOptionIds || [];
        const correctOptionIds: any[] = [];
        
        selectedIndices.forEach((indexStr: string) => {
          const idx = parseInt(indexStr);
          if (!isNaN(idx) && idx >= 0 && question.options && question.options[idx]) {
            const selectedOption = question.options[idx];
            if (selectedOption._id) {
              // Use the existing ObjectId
              correctOptionIds.push(selectedOption._id.toString());
            } else {
              // New option, use index (backend will convert)
              correctOptionIds.push(idx);
            }
          }
        });

        question.correctOptionIds = correctOptionIds;
      }

      return question;
    });

    // Limpiar blob URLs antes de enviar al backend
    // Los archivos se subirán después de que el cuestionario sea guardado
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
      position: {
        type: formValue.positionType,
        afterClassId: formValue.positionType === 'BETWEEN_CLASSES' ? formValue.afterClassId : undefined
      },
      questions: cleanedQuestions,
      passingScore: formValue.passingScore,
      allowRetries: formValue.allowRetries,
      maxRetries: formValue.allowRetries ? formValue.maxRetries : undefined,
      showCorrectAnswers: formValue.showCorrectAnswers,
      timeLimitMinutes: formValue.timeLimitMinutes || undefined
    };

    const request = this.isEditMode
      ? this.questionnairesService.updateQuestionnaire(this.questionnaireId, questionnaireData)
      : this.questionnairesService.createQuestionnaire(questionnaireData);

    request.subscribe({
      next: (response) => {
        const savedQuestionnaire = response?.data;

        // Verificar si hay archivos pendientes para subir
        const hasPendingUploads = this.questionItems?.some((qc: QuestionItemComponent) => !!qc.pendingFile);

        if (savedQuestionnaire && hasPendingUploads) {
          // Hay archivos pendientes, iniciar uploads en segundo plano
          if (!this.isEditMode) {
            // Modo creación: cambiar a modo edición primero
            this.questionnaireId = savedQuestionnaire._id;
            this.isEditMode = true;
          }
          this.startChildrenPendingUploads(savedQuestionnaire, formValue.courseId);
        } else {
          // No hay uploads pendientes, mostrar success y navegar
          this.infoService.showSuccess(
            this.isEditMode ? 'Cuestionario actualizado exitosamente' : 'Cuestionario creado exitosamente'
          );
          // Emitir evento para que `course.orderedContent` sea recargado por cualquier vista interesada
          try { this.courseEvents.emitCourseReload(formValue.courseId); } catch (e) { /* ignore */ }
          this.router.navigate(['/profesor/questionnaires'], {
            queryParams: { courseId: formValue.courseId }
          });
        }
      },
      error: (error) => {
        console.error('Error saving questionnaire:', error);
        console.error('Error details:', error?.error);
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
    this.router.navigate(['/profesor/questionnaires']);
  }
  // Media uploads are handled by each QuestionItem child component.
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

  

  // After creating the questionnaire, ask each QuestionItem child to upload its pending file.
  private async startChildrenPendingUploads(questionnaire: Questionnaire, courseId: string) {
    const children = this.questionItems?.toArray() || [];
    const tasks: Promise<boolean>[] = [];

    questionnaire.questions.forEach((q: any, idx: number) => {
      const child = children[idx];
      if (child && typeof child.startPendingUpload === 'function' && q && q._id) {
        // ensure form has the question _id
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
