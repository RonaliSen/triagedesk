import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBadge } from '@angular/material/badge';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatListItem, MatListItemIcon, MatListItemTitle, MatNavList } from '@angular/material/list';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbar } from '@angular/material/toolbar';
import { firstValueFrom, map } from 'rxjs';
import { Database } from '../core/data/database';
import { TicketsStore } from '../core/tickets/tickets.store';
import { ConfirmDialog } from '../shared/confirm-dialog';
import { ThemeToggle } from '../core/theme/theme-toggle';

const MOBILE_QUERY = '(max-width: 767.98px)';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    MatToolbar,
    MatNavList,
    MatListItem,
    MatListItemIcon,
    MatListItemTitle,
    MatIconButton,
    MatButton,
    MatIcon,
    MatBadge,
    ThemeToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly database = inject(Database);
  private readonly ticketsStore = inject(TicketsStore);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly isMobile = toSignal(
    this.breakpointObserver.observe(MOBILE_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpointObserver.isMatched(MOBILE_QUERY) },
  );

  readonly mobileMenuOpen = signal(false);
  protected readonly openTicketCount = computed(() => this.ticketsStore.counts().open);

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  // Keeps mobileMenuOpen in sync when the sidenav closes itself — ESC key,
  // backdrop click — not just when our own toolbar button opens it.
  protected handleOpenedChange(opened: boolean): void {
    if (this.isMobile()) {
      this.mobileMenuOpen.set(opened);
    }
  }

  protected async resetDemoData(): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Reset demo data',
        message: 'Reset all tickets to the original 40 demo tickets? This cannot be undone.',
        confirmLabel: 'Reset',
      },
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }
    await this.database.resetDemoData();
    this.snackBar.open('Demo data reset', 'Dismiss', { duration: 3000 });
  }
}
