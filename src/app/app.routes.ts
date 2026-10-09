import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'tickets',
        loadComponent: () => import('./features/tickets/tickets-page').then((m) => m.TicketsPage),
      },
    ],
  },
];
