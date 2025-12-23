import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { MainMenuComponent } from './main-menu.component';
import { StateService } from '../services/state.service';
import { SharedMaterialModule } from '../shared-material.module';
import { BehaviorSubject, Observable } from 'rxjs';

describe('MainMenuComponent', () => {
  let component: MainMenuComponent;
  let fixture: ComponentFixture<MainMenuComponent>;
  let stateServiceSpy: jasmine.SpyObj<StateService>;
  let hasQuizInProgressSubject: BehaviorSubject<boolean>;
  let hasMissedWordsSubject: BehaviorSubject<boolean>;
  let hasReviewInProgressSubject: BehaviorSubject<boolean>;
  let isReturningUserSubject: BehaviorSubject<boolean>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('StateService', [
      'exportState',
      'importState',
      'getCurrentState'
    ]);

    // Create BehaviorSubjects
    hasQuizInProgressSubject = new BehaviorSubject<boolean>(false);
    hasMissedWordsSubject = new BehaviorSubject<boolean>(false);
    hasReviewInProgressSubject = new BehaviorSubject<boolean>(false);
    isReturningUserSubject = new BehaviorSubject<boolean>(false);

    // Set up the observables
    spy.hasQuizInProgress$ = hasQuizInProgressSubject.asObservable();
    spy.hasMissedWords$ = hasMissedWordsSubject.asObservable();
    spy.hasReviewInProgress$ = hasReviewInProgressSubject.asObservable();
    spy.isReturningUser$ = isReturningUserSubject.asObservable();

    await TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([]),
        SharedMaterialModule
      ],
      declarations: [MainMenuComponent],
      providers: [
        { provide: StateService, useValue: spy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MainMenuComponent);
    component = fixture.componentInstance;
    stateServiceSpy = TestBed.inject(StateService) as jasmine.SpyObj<StateService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize observables from state service', () => {
    expect(component.hasQuizInProgress$).toBe(stateServiceSpy.hasQuizInProgress$);
    expect(component.hasMissedWords$).toBe(stateServiceSpy.hasMissedWords$);
    expect(component.hasReviewInProgress$).toBe(stateServiceSpy.hasReviewInProgress$);
    expect(component.isReturningUser$).toBe(stateServiceSpy.isReturningUser$);
  });

  it('should export state when export button clicked', () => {
    isReturningUserSubject.next(true);
    fixture.detectChanges();

    const exportButton = fixture.nativeElement.querySelector('.menu-button.gray');
    expect(exportButton).toBeTruthy();

    exportButton.click();
    expect(stateServiceSpy.exportState).toHaveBeenCalled();
  });

  it('should not show export button for new users', () => {
    isReturningUserSubject.next(false);
    fixture.detectChanges();

    const exportButton = fixture.nativeElement.querySelector('.menu-button.gray');
    expect(exportButton).toBeFalsy();
  });

  it('should handle file selection for import', () => {
    const mockEvent = {
      target: {
        files: [new File(['test'], 'test.json', { type: 'application/json' })]
      }
    } as any;

    component.onFileSelected(mockEvent);
    expect(stateServiceSpy.importState).toHaveBeenCalledWith(mockEvent.target.files[0]);
  });

  it('should reset file input after selection', () => {
    const mockEvent = {
      target: {
        files: [new File(['test'], 'test.json', { type: 'application/json' })],
        value: 'C:\\fakepath\\test.json'
      }
    } as any;

    component.onFileSelected(mockEvent);
    expect(mockEvent.target.value).toBe('');
  });

  it('should not call importState when no files selected', () => {
    const mockEvent = {
      target: {
        files: null
      }
    } as any;

    component.onFileSelected(mockEvent);
    expect(stateServiceSpy.importState).not.toHaveBeenCalled();
  });

  it('should show continue quiz when quiz is in progress', () => {
    hasQuizInProgressSubject.next(true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.menu-button');
    const continueButton = Array.from(buttons).find((btn: any) =>
      btn.textContent.includes('Continue Quiz')
    );
    const startButton = Array.from(buttons).find((btn: any) =>
      btn.textContent.includes('Start Quiz')
    );

    expect(continueButton).toBeTruthy();
    expect(startButton).toBeFalsy();
  });

  it('should show start quiz when no quiz in progress', () => {
    hasQuizInProgressSubject.next(false);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.menu-button');
    const startButton = Array.from(buttons).find((btn: any) =>
      btn.textContent.includes('Start Quiz')
    );
    const continueButton = Array.from(buttons).find((btn: any) =>
      btn.textContent.includes('Continue Quiz')
    );

    expect(startButton).toBeTruthy();
    expect(continueButton).toBeFalsy();
  });

  it('should show review missed words when missed words exist', () => {
    hasMissedWordsSubject.next(true);
    hasReviewInProgressSubject.next(false);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.menu-button');
    const reviewButton = Array.from(buttons).find((btn: any) =>
      btn.textContent.includes('Review Missed Words')
    );

    expect(reviewButton).toBeTruthy();
  });

  it('should not show review missed words when no missed words', () => {
    hasMissedWordsSubject.next(false);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.menu-button');
    const reviewButton = Array.from(buttons).find((btn: any) =>
      btn.textContent.includes('Review Missed Words')
    );

    expect(reviewButton).toBeFalsy();
  });

  it('should show continue review when review in progress', () => {
    hasMissedWordsSubject.next(true);
    hasReviewInProgressSubject.next(true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.menu-button');
    const continueButton = Array.from(buttons).find((btn: any) =>
      btn.textContent.includes('Continue Missed Words')
    );
    const reviewButton = Array.from(buttons).find((btn: any) =>
      btn.textContent.includes('Review Missed Words')
    );

    expect(continueButton).toBeTruthy();
    expect(reviewButton).toBeFalsy();
  });

  it('should have import button that triggers hidden file input', () => {
    fixture.detectChanges();

    const importButton = fixture.nativeElement.querySelector('.menu-button.blue');
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]');

    expect(importButton).toBeTruthy();
    expect(importButton.textContent).toContain('Import Progress');
    expect(fileInput).toBeTruthy();
    expect(fileInput.hidden).toBe(true);
    expect(fileInput.accept).toBe('.json');
  });

  it('should trigger file selection when import button clicked', () => {
    fixture.detectChanges();

    const importButton = fixture.nativeElement.querySelector('.menu-button.blue');
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    spyOn(fileInput, 'click');

    importButton.click();
    expect(fileInput.click).toHaveBeenCalled();
  });

  it('should handle multiple button types and styling', () => {
    isReturningUserSubject.next(true);
    hasQuizInProgressSubject.next(false);
    hasMissedWordsSubject.next(true);
    hasReviewInProgressSubject.next(false);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.menu-button');
    
    expect(buttons.length).toBe(4); // Start Quiz, Review Missed Words, Import, Export
    
    const greenButton = Array.from(buttons).find((btn: any) => btn.classList.contains('green'));
    const yellowButton = Array.from(buttons).find((btn: any) => btn.classList.contains('yellow'));
    const blueButton = Array.from(buttons).find((btn: any) => btn.classList.contains('blue'));
    const grayButton = Array.from(buttons).find((btn: any) => btn.classList.contains('gray'));

    expect(greenButton).toBeTruthy();
    expect(yellowButton).toBeTruthy();
    expect(blueButton).toBeTruthy();
    expect(grayButton).toBeTruthy();
  });

  it('should update button states when observables emit new values', () => {
    hasQuizInProgressSubject.next(false);
    fixture.detectChanges();

    let buttons = fixture.nativeElement.querySelectorAll('.menu-button');
    let startButton = Array.from(buttons).find((btn: any) =>
      btn.textContent.includes('Start Quiz')
    );
    expect(startButton).toBeTruthy();

    // Simulate user starting a quiz
    hasQuizInProgressSubject.next(true);
    fixture.detectChanges();

    buttons = fixture.nativeElement.querySelectorAll('.menu-button');
    const continueButton = Array.from(buttons).find((btn: any) =>
      btn.textContent.includes('Continue Quiz')
    );
    expect(continueButton).toBeTruthy();
  });
});