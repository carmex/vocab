import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainMenuComponent } from './main-menu.component';
import { StateService } from '../services/state.service';
import { AuthService } from '../services/auth.service';
import { ClassroomService } from '../services/classroom.service';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { SharedMaterialModule } from '../shared-material.module';
import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('MainMenuComponent', () => {
    let component: MainMenuComponent;
    let fixture: ComponentFixture<MainMenuComponent>;
    let stateServiceSpy: any;
    let authServiceSpy: any;
    let classroomServiceSpy: any;

    beforeEach(async () => {
        stateServiceSpy = {
            hasQuizInProgress$: of(false),
            hasMissedWords$: of(false),
            hasReviewInProgress$: of(false),
            isReturningUser$: of(false)
        };

        authServiceSpy = {
            user$: of({ id: 'test-uid' }),
            profile$: of({ role: 'student' })
        };

        classroomServiceSpy = {
            getStudentQuests: jest.fn()
        };

        await TestBed.configureTestingModule({
            declarations: [MainMenuComponent],
            imports: [RouterTestingModule, SharedMaterialModule, CommonModule],
            providers: [
                { provide: StateService, useValue: stateServiceSpy },
                { provide: AuthService, useValue: authServiceSpy },
                { provide: ClassroomService, useValue: classroomServiceSpy }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();

        classroomServiceSpy.getStudentQuests.mockReturnValue(of([]));

        fixture = TestBed.createComponent(MainMenuComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
