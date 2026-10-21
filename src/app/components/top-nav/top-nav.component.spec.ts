import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopNavComponent } from './top-nav.component';
import { AuthService } from '../../services/auth.service';
import { provideRouter, Router } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';

describe('TopNavComponent', () => {
    let component: TopNavComponent;
    let fixture: ComponentFixture<TopNavComponent>;
    let authServiceSpy: any;
    let userSubject: BehaviorSubject<any>;
    let overlayContainer: OverlayContainer;
    let overlayContainerElement: HTMLElement;

    beforeEach(async () => {
        userSubject = new BehaviorSubject<any>({ id: 'test-user', user_metadata: {}, is_anonymous: true });
        authServiceSpy = {
            user$: userSubject.asObservable(),
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
                provideRouter([])
            ]
        }).compileComponents();

        overlayContainer = TestBed.inject(OverlayContainer);
        overlayContainerElement = overlayContainer.getContainerElement();

        fixture = TestBed.createComponent(TopNavComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        overlayContainer.ngOnDestroy();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render profile icon as a button element for mobile tap and accessibility', () => {
        const profileIconEl = fixture.debugElement.query(By.css('.profile-icon'));
        expect(profileIconEl).toBeTruthy();
        expect(profileIconEl.nativeElement.tagName.toLowerCase()).toBe('button');
        expect(profileIconEl.nativeElement.getAttribute('type')).toBe('button');
    });

    it('should show Login and Sign Up when user is anonymous', () => {
        userSubject.next({ id: 'anon-user', is_anonymous: true });
        fixture.detectChanges();

        const trigger = fixture.debugElement.query(By.css('.profile-icon'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        const menuItems = overlayContainerElement.querySelectorAll('button[mat-menu-item]');
        const itemTexts = Array.from(menuItems).map(el => el.textContent?.trim() || '');
        expect(itemTexts.some(t => t.includes('Login'))).toBe(true);
        expect(itemTexts.some(t => t.includes('Sign Up'))).toBe(true);
    });

    it('should show Login and Sign Up even if user$ is null (unauthenticated / loading)', () => {
        userSubject.next(null);
        fixture.detectChanges();

        const trigger = fixture.debugElement.query(By.css('.profile-icon'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        const menuItems = overlayContainerElement.querySelectorAll('button[mat-menu-item]');
        const itemTexts = Array.from(menuItems).map(el => el.textContent?.trim() || '');
        expect(itemTexts.some(t => t.includes('Login'))).toBe(true);
        expect(itemTexts.some(t => t.includes('Sign Up'))).toBe(true);
    });

    it('should show email and Logout when user is authenticated', () => {
        userSubject.next({ id: 'real-user', email: 'teacher@test.com', is_anonymous: false });
        fixture.detectChanges();

        const trigger = fixture.debugElement.query(By.css('.profile-icon'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        const menuItems = overlayContainerElement.querySelectorAll('button[mat-menu-item]');
        const itemTexts = Array.from(menuItems).map(el => el.textContent?.trim() || '');
        expect(itemTexts.some(t => t.includes('teacher@test.com'))).toBe(true);
        expect(itemTexts.some(t => t.includes('Logout'))).toBe(true);
    });
});
