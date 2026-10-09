import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ThemeStore } from './theme.store';

@Component({
  selector: 'app-theme-toggle',
  imports: [MatButton, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button mat-button type="button" [attr.aria-label]="label()" (click)="themeStore.toggleTheme()">
      <mat-icon class="material-symbols-outlined">{{ icon() }}</mat-icon>
      {{ label() }}
    </button>
  `,
})
export class ThemeToggle {
  protected readonly themeStore = inject(ThemeStore);

  protected readonly icon = computed(() => (this.themeStore.isDark() ? 'light_mode' : 'dark_mode'));
  protected readonly label = computed(() =>
    this.themeStore.isDark() ? 'Switch to light mode' : 'Switch to dark mode',
  );
}
