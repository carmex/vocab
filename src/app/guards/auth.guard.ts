import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {

    constructor(private auth: AuthService, private router: Router) { }

    canActivate(): Observable<boolean | UrlTree> {
        return this.auth.user$.pipe(
            take(1),
            map(user => {
                // Allow access if user is logged in (anonymous or not)
                if (user) {
                    return true;
                }

                // Redirect to menu if no user session
                return this.router.createUrlTree(['/menu']);
            })
        );
    }
}
