import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeStore } from './core/theme/theme.store';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  // Injected here so the theme is applied to <html> as early as possible,
  // not only once some component further down happens to use ThemeToggle.
  private readonly themeStore = inject(ThemeStore);
}
