import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopNavComponent } from './top-nav.component';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('TopNavComponent', () => {
    let component: TopNavComponent;
    let fixture: ComponentFixture<TopNavComponent>;
    let authServiceSpy: any;

    beforeEach(async () => {
        authServiceSpy = {
            user$: of({ id: 'test-user', user_metadata: {} }),
            profile$: of({ role: 'student' }),
            signOut: jest.fn()
        };

        await TestBed.configureTestingModule({
            imports: [
                TopNavComponent,
                MatButtonModule,
                MatIconModule,
                MatMenuModule,
                NoopAnimationsModule
            ],
            providers: [
                { provide: AuthService, useValue: authServiceSpy },
                { provide: Router, useValue: { url: '/menu', navigate: jest.fn() } }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TopNavComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
