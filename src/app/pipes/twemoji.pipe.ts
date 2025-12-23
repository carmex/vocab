import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import twemoji from 'twemoji';

@Pipe({
    name: 'twemoji',
    standalone: true
})
export class TwemojiPipe implements PipeTransform {

    constructor(private sanitizer: DomSanitizer) { }

    transform(value: string | null | undefined): SafeHtml {
        if (!value) {
            return '';
        }

        const parsed = twemoji.parse(value, {
            folder: 'svg',
            ext: '.svg'
        });

        return this.sanitizer.bypassSecurityTrustHtml(parsed);
    }
}
