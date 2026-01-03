import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuestsComponent } from './quests.component';
import { ClassroomService } from '../../services/classroom.service';
import { AuthService } from '../../services/auth.service';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { SharedMaterialModule } from '../../shared-material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('QuestsComponent', () => {
    let component: QuestsComponent;
    let fixture: ComponentFixture<QuestsComponent>;
    let classroomServiceSpy: any;
    let authServiceSpy: any;

    beforeEach(async () => {
        classroomServiceSpy = {
            getStudentQuests: jest.fn()
        };
        authServiceSpy = {
            user$: of({ id: 'test-uid' })
        };

        await TestBed.configureTestingModule({
            imports: [
                QuestsComponent,
                RouterTestingModule,
                SharedMaterialModule,
                BrowserAnimationsModule
            ],
            providers: [
                { provide: ClassroomService, useValue: classroomServiceSpy },
                { provide: AuthService, useValue: authServiceSpy }
            ]
        }).compileComponents();

        classroomServiceSpy.getStudentQuests.mockReturnValue(of([]));

        fixture = TestBed.createComponent(QuestsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
