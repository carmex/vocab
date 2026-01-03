import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MathGenModalComponent } from './math-gen-modal.component';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('MathGenModalComponent', () => {
    let component: MathGenModalComponent;
    let fixture: ComponentFixture<MathGenModalComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                MathGenModalComponent,
                MatDialogModule,
                NoopAnimationsModule
            ],
            providers: [
                { provide: MatDialogRef, useValue: { close: () => { } } },
                { provide: MAT_DIALOG_DATA, useValue: {} }
            ]
        })
            .compileComponents();

        fixture = TestBed.createComponent(MathGenModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should calculate combinations correctly for addition', () => {
        component.ops = { add: true, sub: false, mul: false, div: false };
        component.range1 = { min: 1, max: 2 };
        component.range2 = { min: 1, max: 2 };
        component.recalc();
        // 1+1, 1+2, 2+1, 2+2 => 4 combinations
        expect(component.maxCards).toBe(4);
        expect(component.pool.length).toBe(4);
    });

    it('should filter non-integer division results', () => {
        component.ops = { add: false, sub: false, mul: false, div: true };
        component.range1 = { min: 1, max: 4 };
        component.range2 = { min: 2, max: 2 };
        // Pairs: 1/2 (0.5), 2/2 (1), 3/2 (1.5), 4/2 (2)
        // Integers: 2/2, 4/2 => 2 combinations
        component.recalc();
        expect(component.maxCards).toBe(2);
        expect(component.pool).toContainEqual(expect.objectContaining({ word: '2 ÷ 2', definition: '1' }));
        expect(component.pool).toContainEqual(expect.objectContaining({ word: '4 ÷ 2', definition: '2' }));
        expect(component.pool).not.toContainEqual(expect.objectContaining({ word: '1 ÷ 2' }));
    });

    it('should limit number of generated cards to count', () => {
        component.ops = { add: true, sub: false, mul: false, div: false };
        component.range1 = { min: 1, max: 10 };
        component.range2 = { min: 1, max: 10 };
        component.recalc(); // 100 combinations

        component.count = 10;
        component.generate();
        // Since generate calls dialogRef.close, we can't easily check return value here unless we spy.
        // But we can check internal logic if we refactor or just trust recalc/maxCards.
        // Let's spy on dialogRef.close
        // @ts-ignore
        const spy = jest.spyOn(component['dialogRef'], 'close');
        component.generate();
        expect(spy).toHaveBeenCalled();
        const result = spy.mock.calls[0][0];
        expect(result.length).toBe(10);
    });
});
