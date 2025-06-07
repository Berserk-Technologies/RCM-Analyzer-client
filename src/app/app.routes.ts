import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/calculator/components/calculator/calculator.component').then(m => m.CalculatorComponent)
  },
  {
    path: 'calculator',
    loadComponent: () => import('./features/calculator/components/calculator/calculator.component').then(m => m.CalculatorComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
