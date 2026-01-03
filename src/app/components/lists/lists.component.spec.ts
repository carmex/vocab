import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListsComponent } from './lists.component';
import { ListService } from '../../services/list.service';
import { AuthService } from '../../services/auth.service';
import { ClassroomService } from '../../services/classroom.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { SharedMaterialModule } from '../../shared-material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('ListsComponent', () => {
    let component: ListsComponent;
    let fixture: ComponentFixture<ListsComponent>;
    let listServiceSpy: any;
    let authServiceSpy: any;
    let classroomServiceSpy: any;

    beforeEach(async () => {
        listServiceSpy = {
            getMyLists: jest.fn(),
            generateShareCode: jest.fn(),
            subscribeToList: jest.fn()
        };
        authServiceSpy = {
            user$: of({ id: 'test-uid' }),
            isAnonymous: false
        };

        classroomServiceSpy = {
            getStudentQuests: jest.fn()
        };

        await TestBed.configureTestingModule({
            imports: [
                ListsComponent,
                RouterTestingModule,
                SharedMaterialModule,
                BrowserAnimationsModule
            ],
            providers: [
                { provide: ListService, useValue: listServiceSpy },
                { provide: AuthService, useValue: authServiceSpy },
                { provide: ClassroomService, useValue: classroomServiceSpy },
                { provide: MatDialog, useValue: {} },
                { provide: MatSnackBar, useValue: {} }
            ]
        }).compileComponents();

        listServiceSpy.getMyLists.mockReturnValue(of([]));
        classroomServiceSpy.getStudentQuests.mockReturnValue(of([]));

        fixture = TestBed.createComponent(ListsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
