import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProjectInterpretationDTO {
  projectTitle?: string;
  projectType?: string;
  vesselName?: string;
  vesselType?: string;
  clientName?: string;
  scopeSummary?: string;
  majorWorkPackages?: string[];
  priorityLevel?: string;
  plannedStartDate?: string;
  durationWeeks?: number;
  dryDockRequired?: string;
  milestones?: string[];
  budgetAtCompletion?: number;
  currency?: string;
  crewSize?: number;
  specializedTeams?: string[];
  knownRisks?: string[];
  weatherConstraints?: string;
  missingFields?: string[];
  planningConfidence?: string;
  assumptionsMade?: string[];
  userConfirmedFields?: string[];
}

export interface InterpretationResponse {
  action: string;
  confidence: number;
  dto: ProjectInterpretationDTO;
  warnings: string[];
  requiresConfirmation: boolean;
}

export interface Subtask {
  summary: string;
  description: string;
  assignee: string;
  original_estimate: string;
  priority: string;
}

export interface Task {
  summary: string;
  description: string;
  assignee: string;
  reporter: string;
  priority: string;
  status: string;
  original_estimate: string;
  start_date: string;
  due_date: string;
  labels: string[];
  subtasks: Subtask[];
}

export interface ProjectPlan {
  project_title: string;
  total_duration_weeks: number;
  tasks: Task[];
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/projects`;

  interpretPrompt(prompt: string): Observable<InterpretationResponse> {
    return this.http.post<InterpretationResponse>(`${this.apiUrl}/interpret`, { prompt });
  }

  uploadAndExtract(file: File): Observable<{extractedText: string}> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{extractedText: string}>(`${this.apiUrl}/extract-file`, formData);
  }

  executeAction(interpretationId: string, confirmedDto: ProjectInterpretationDTO): Observable<ProjectPlan> {
    return this.http.post<ProjectPlan>(`${this.apiUrl}/execute`, {
      interpretationId,
      confirmedDto
    });
  }

  saveProjectPlan(data: { plan: ProjectPlan, dto: ProjectInterpretationDTO }): Observable<any> {
    return this.http.post(`${this.apiUrl}/save`, data);
  }

  getProjects(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getProjectGanttData(projectId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${projectId}/gantt`);
  }

  createGanttTask(projectId: string, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${projectId}/gantt/tasks`, data);
  }

  updateGanttTask(projectId: string, taskId: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${projectId}/gantt/tasks/${taskId}`, data);
  }

  createGanttLink(projectId: string, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${projectId}/gantt/links`, data);
  }

  updateGanttLink(projectId: string, linkId: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${projectId}/gantt/links/${linkId}`, data);
  }

  deleteGanttLink(projectId: string, linkId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${projectId}/gantt/links/${linkId}`);
  }

  deleteGanttTask(projectId: string, taskId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${projectId}/gantt/tasks/${taskId}`);
  }

  getProjectEvmData(projectId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${projectId}/evm`);
  }

  // Custom Survey Report Generator API
  getSurveyTemplates(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/api/survey-reports/templates`);
  }

  downloadSurveyTemplateUrl(filename: string): string {
    return `${environment.apiUrl}/api/survey-reports/templates/${filename}/download`;
  }

  getSurveyTemplateBlob(filename: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/api/survey-reports/templates/${filename}/download`, { responseType: 'blob' });
  }

  generateAiDescription(file: File, promptCaption: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('prompt_caption', promptCaption);
    return this.http.post<any>(`${environment.apiUrl}/api/survey-reports/generate-ai-description`, formData);
  }

  generateSurveyReport(payload: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/api/survey-reports/generate`, payload);
  }

  downloadGeneratedDocxUrl(reportId: string): string {
    return `${environment.apiUrl}/api/survey-reports/generated/${reportId}/download-docx`;
  }

  downloadGeneratedPdfUrl(reportId: string): string {
    return `${environment.apiUrl}/api/survey-reports/generated/${reportId}/download-pdf`;
  }
}
