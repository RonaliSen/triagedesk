import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Dashboard</h1>
    <p>Charts and summary cards arrive in a later milestone.</p>
  `,
})
export class DashboardPage {}
