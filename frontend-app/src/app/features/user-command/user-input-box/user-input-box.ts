import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { AiService, InterpretationResponse, ProjectPlan } from '../../../core/services/ai.service';

@Component({
  selector: 'app-user-input-box',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, FormsModule, TextFieldModule],
  templateUrl: './user-input-box.html',
  styleUrl: './user-input-box.scss'
})
export class UserInputBox {
  query = signal('');
  isInterpreting = signal(false);
  interpretation = signal<InterpretationResponse | null>(null);
  
  isExecuting = signal(false);
  projectPlan = signal<ProjectPlan | null>(null);

  private aiService = inject(AiService);
  
  suggestions = [
    // { icon: 'directions_boat', text: 'Vessel Health' },
    // { icon: 'build', text: 'Dry-docking' },
    // { icon: 'schedule', text: 'Schedule Inspection' },
    // { icon: 'anchor', text: 'Port Coordination' },
    // { icon: 'warning', text: 'Troubleshoot' }
  ];

  selectedFile: File | null = null;

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  clearFile() {
    this.selectedFile = null;
  }

  submitQuery() {
    const q = this.query().trim();
    if (!q && !this.selectedFile) return;
    
    // Clear previous states
    this.interpretation.set(null);
    this.projectPlan.set(null);
    this.isInterpreting.set(true);
    this.query.set('');

    if (this.selectedFile) {
      this.aiService.uploadAndExtract(this.selectedFile).subscribe({
        next: (res) => {
          let combinedQuery = q;
          if (res.extractedText) {
             combinedQuery += "\n\n--- Document Context ---\n" + res.extractedText;
          }
          this.callInterpreter(combinedQuery);
          this.selectedFile = null; // Clear file after successful extraction
        },
        error: (err) => {
          console.error("Error extracting file", err);
          this.isInterpreting.set(false);
        }
      });
    } else {
      this.callInterpreter(q);
    }
  }

  callInterpreter(queryText: string) {
    this.aiService.interpretPrompt(queryText).subscribe({
      next: (res) => {
        this.interpretation.set(res);
        this.isInterpreting.set(false);
        
        if (res.action === 'NEEDS_CLARIFICATION' && res.dto.missingFields && res.dto.missingFields.length > 0) {
          const INITIAL_SEP = "--- Initial Request ---";
          const PROVIDED_SEP = "--- Provided Details ---";
          const MISSING_SEP = "--- Missing Information ---";
          
          let initialInput = queryText;
          // Extract the pure user intent by stripping out old separators
          if (queryText.includes(INITIAL_SEP)) {
            let parts = queryText.split(INITIAL_SEP)[1];
            initialInput = parts.split(PROVIDED_SEP)[0].split(MISSING_SEP)[0].trim();
          } else if (queryText.includes(PROVIDED_SEP)) {
            initialInput = queryText.split(PROVIDED_SEP)[0].trim();
          } else if (queryText.includes(MISSING_SEP)) {
            initialInput = queryText.split(MISSING_SEP)[0].trim();
          }

          let suggestion = `${INITIAL_SEP}\n${initialInput}\n\n`;

          const allFields = [
              "projectTitle", "projectType", "vesselName", "vesselType",
              "scopeSummary", "majorWorkPackages", "priorityLevel", "plannedStartDate",
              "durationWeeks", "budgetAtCompletion",
              "currency", "crewSize", 
          ];
          
          const providedFields = allFields.filter(f => !res.dto.missingFields!.includes(f));
          
          if (providedFields.length > 0) {
              suggestion += `${PROVIDED_SEP}\n`;
              providedFields.forEach(f => {
                  const val = (res.dto as any)[f];
                  let valStr = '';
                  if (Array.isArray(val)) {
                      valStr = val.join(', ');
                  } else if (val !== null && val !== undefined) {
                      valStr = String(val);
                  }
                  
                  if (valStr) {
                      suggestion += `[✓] ${f.toUpperCase()}: ${valStr}\n`;
                  }
              });
              suggestion += `\n`;
          }
          
          suggestion += `${MISSING_SEP}\n`;
          res.dto.missingFields.forEach(field => {
            suggestion += `[ ] ${field.toUpperCase()}: \n`;
          });
          
          this.query.set(suggestion);
        }
      },
      error: (err) => {
        console.error('Error interpreting prompt:', err);
        this.isInterpreting.set(false);
      }
    });
  }

  acceptQuery() {
    const currentInterpretation = this.interpretation();
    if (!currentInterpretation) return;

    this.isExecuting.set(true);
    // Do NOT hide interpretation box by setting it to null, as we need its DTO for saving later.
    // Instead we will hide it via HTML *ngIf="!projectPlan()"

    // Call execute
    this.aiService.executeAction('dummy-id-123', currentInterpretation.dto).subscribe({
      next: (plan) => {
        this.projectPlan.set(plan);
        this.isExecuting.set(false);
      },
      error: (err) => {
        console.error('Error executing action:', err);
        this.isExecuting.set(false);
      }
    });
  }

  rejectQuery() {
    this.interpretation.set(null);
  }

  setQuery(text: string) {
    this.query.set(text);
  }

  savePlan() {
    const plan = this.projectPlan();
    const dto = this.interpretation()?.dto;
    if (!plan || !dto) return;

    this.isExecuting.set(true);
    
    // We pass both plan and dto because backend needs DTO fields for the 'projects' table
    this.aiService.saveProjectPlan({ plan, dto }).subscribe({
      next: (res) => {
        alert("Project plan saved successfully!");
        this.projectPlan.set(null);
        this.interpretation.set(null);
        this.isExecuting.set(false);
      },
      error: (err) => {
        console.error('Error saving plan:', err);
        alert("Failed to save project.");
        this.isExecuting.set(false);
      }
    });
  }
}
