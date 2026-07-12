import { Routes } from '@angular/router';
import { UserInputBox } from './features/user-command/user-input-box/user-input-box';
import { ProjectGantt } from './features/project-gantt/project-gantt';
import { ProjectDashboard } from './features/project-dashboard/project-dashboard';
import { ProjectEvm } from './features/project-evm/project-evm';
import { LoginComponent } from './features/auth/login/login';
import { SettingsComponent } from './features/settings/settings';
import { SurveyReportComponent } from './features/survey-report/survey-report';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'input', component: UserInputBox },
  { path: 'gantt', component: ProjectGantt },
  { path: 'dashboard', component: ProjectDashboard },
  { path: 'evm', component: ProjectEvm },
  { path: 'settings', component: SettingsComponent },
  { path: 'survey-report', component: SurveyReportComponent }
];
