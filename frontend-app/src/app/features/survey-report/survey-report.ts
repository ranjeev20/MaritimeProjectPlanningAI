import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AiService } from '../../core/services/ai.service';
import * as docx from 'docx-preview';

interface SubcontractorWork {
  scope_of_works: string;
  subcontractor: string;
}

interface WorkScopeItem {
  title: string;
  description: string;
  image_base64: string;
  image_name: string;
  status: string;
  start_date: string;
  categories: { [key: string]: boolean };
  permits: { [key: string]: boolean };
  promptCaption: string;
  isGeneratingAI: boolean;
}

@Component({
  selector: 'app-survey-report',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './survey-report.html',
  styleUrl: './survey-report.scss'
})
export class SurveyReportComponent implements OnInit {
  aiService = inject(AiService);

  // General lists
  projects: any[] = [];
  selectedProject: any = null;
  templates: any[] = [];
  selectedTemplate: any = null;

  // Stepper state: 0=Template, 1=Parameters, 2=Scopes, 3=Compile/Export
  stepperIndex: number = 0;

  // Parameters (Step 2)
  companyName: string = 'Van Oord Marine Ingenuity';
  vesselName: string = 'HAM 318';
  documentName: string = '0318 - Intermediate Survey - 2026';
  docNr: string = 'VOMS-PR3.07-SMD-IN-01-05';
  reference: string = 'VOMS-PR3.07-SMD-IN-01';
  revision: string = '1';
  arrivalDate: string = '2026-06-01';
  totalLeadTime: number = 38;
  drydockDuration: number = 21;

  coverImageBase64: string = '';
  coverImageName: string = '';
  interiorImageBase64: string = '';
  interiorImageName: string = '';
  companyLogoBase64: string = '';
  companyLogoName: string = '';

  // Subcontractors
  subcontractors: SubcontractorWork[] = [
    { scope_of_works: 'Overhaul Main Engines', subcontractor: 'Wartsila' },
    { scope_of_works: 'Electrical Works', subcontractor: 'Bakker' }
  ];
  newSubScope: string = '';
  newSubName: string = '';

  // Shipyard Scopes (Step 3)
  categoryOptions = ['Steel', 'Piping', 'Cleaning', 'Transport', 'Mechanical', 'Electrical', 'Painting', 'Hydraulic'];
  permitOptions = ['Confined space', 'Hot work permit', 'Ventilation', 'Working at heights', 'Entrance permit', 'Gas free permit', 'Lighting', 'Heavy lifting (>5 ton)'];

  shipyardScopes: WorkScopeItem[] = [];

  // Scopes Creation form
  newScopeTitle: string = '';

  // Export State (Step 4)
  isGeneratingReport: boolean = false;
  generatedReportId: string = '';

  ngOnInit() {
    this.loadProjects();
    this.loadTemplates();
  }

  loadProjects() {
    this.aiService.getProjects().subscribe({
      next: (res) => {
        this.projects = res;
        if (this.projects.length > 0) {
          this.selectedProject = this.projects[0];
        }
      },
      error: (err) => console.error("Error loading projects", err)
    });
  }

  loadTemplates() {
    this.aiService.getSurveyTemplates().subscribe({
      next: (res) => {
        this.templates = res.templates || [];
        if (this.templates.length > 0) {
          this.selectedTemplate = this.templates[0];
        }
      },
      error: (err) => console.error("Error loading templates", err)
    });
  }

  selectTemplate(tpl: any) {
    this.selectedTemplate = tpl;
    this.nextStep();
  }

  nextStep() {
    if (this.stepperIndex < 3) {
      this.stepperIndex++;
    }
  }

  prevStep() {
    if (this.stepperIndex > 0) {
      this.stepperIndex--;
    }
  }

  setStep(idx: number) {
    this.stepperIndex = idx;
  }

  // File to Base64 encoder helper
  onFileSelected(event: any, target: 'cover' | 'interior' | 'logo') {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (target === 'cover') {
        this.coverImageBase64 = reader.result as string;
        this.coverImageName = file.name;
      } else if (target === 'interior') {
        this.interiorImageBase64 = reader.result as string;
        this.interiorImageName = file.name;
      } else if (target === 'logo') {
        this.companyLogoBase64 = reader.result as string;
        this.companyLogoName = file.name;
      }
    };
    reader.readAsDataURL(file);
  }

  // Subcontractor Management
  addSubcontractor() {
    if (this.newSubScope.trim() && this.newSubName.trim()) {
      this.subcontractors.push({
        scope_of_works: this.newSubScope.trim(),
        subcontractor: this.newSubName.trim()
      });
      this.newSubScope = '';
      this.newSubName = '';
    }
  }

  removeSubcontractor(index: number) {
    this.subcontractors.splice(index, 1);
  }

  // Scope Management
  addNewScope() {
    if (!this.newScopeTitle.trim()) return;

    let rawTitles: string[] = [];
    if (this.newScopeTitle.includes('\n')) {
      rawTitles = this.newScopeTitle.split('\n');
    } else if (this.newScopeTitle.includes(';')) {
      rawTitles = this.newScopeTitle.split(';');
    } else if (this.newScopeTitle.includes(',')) {
      rawTitles = this.newScopeTitle.split(',');
    } else {
      rawTitles = [this.newScopeTitle];
    }

    const titlesList = rawTitles.map(t => t.trim()).filter(t => t.length > 0);

    titlesList.forEach(title => {
      const categoriesInit: { [key: string]: boolean } = {};
      this.categoryOptions.forEach(opt => categoriesInit[opt] = false);

      const permitsInit: { [key: string]: boolean } = {};
      this.permitOptions.forEach(opt => permitsInit[opt] = false);

      this.shipyardScopes.push({
        title: title,
        description: '',
        image_base64: '',
        image_name: '',
        status: 'New',
        start_date: '',
        categories: categoriesInit,
        permits: permitsInit,
        promptCaption: '',
        isGeneratingAI: false
      });
    });

    this.newScopeTitle = '';
  }

  removeScope(index: number) {
    this.shipyardScopes.splice(index, 1);
  }

  onScopeFileSelected(event: any, scope: WorkScopeItem) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      scope.image_base64 = reader.result as string;
      scope.image_name = file.name;
      // Pre-fill caption/suggestion context
      if (!scope.promptCaption) {
        scope.promptCaption = `Repair/maintenance job for ${scope.title}`;
      }
    };
    reader.readAsDataURL(file);
  }

  generateScopeDescription(scope: WorkScopeItem) {
    if (!scope.image_base64) {
      alert("Please upload a photo for the scope item first.");
      return;
    }

    scope.isGeneratingAI = true;

    // Convert base64 back to raw File to submit to FormData AI endpoint
    const fileObj = this.dataURLtoFile(scope.image_base64, scope.image_name || 'photo.jpg');

    this.aiService.generateAiDescription(fileObj, scope.promptCaption).subscribe({
      next: (res) => {
        scope.description = res.description;
        scope.isGeneratingAI = false;
      },
      error: (err) => {
        scope.isGeneratingAI = false;
        console.error("Error generating description", err);
        alert("Failed to generate description. Please try again or write manually.");
      }
    });
  }

  // Helper: Base64 dataURL to JS File object
  dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  // Compile final Report
  compileReport() {
    if (!this.selectedProject) {
      alert("Please select a project first.");
      return;
    }
    if (!this.selectedTemplate) {
      alert("Please select a template first.");
      return;
    }
    if (this.shipyardScopes.length === 0) {
      alert("Please add at least one shipyard work scope item.");
      return;
    }

    this.isGeneratingReport = true;

    // Build categories/permits CSV lists
    const processedScopes = this.shipyardScopes.map(scope => {
      const activeCats = Object.keys(scope.categories).filter(k => scope.categories[k]).join(",");
      const activePermits = Object.keys(scope.permits).filter(k => scope.permits[k]).join(",");
      return {
        title: scope.title,
        description: scope.description,
        image_base64: scope.image_base64,
        status: scope.status,
        start_date: scope.start_date,
        categories: activeCats,
        permits: activePermits
      };
    });

    const payload = {
      project_id: this.selectedProject.project_id,
      template_id: this.selectedTemplate.filename,
      document_name: this.documentName,
      doc_nr: this.docNr,
      reference: this.reference,
      revision: this.revision,
      company_name: this.companyName,
      vessel_name: this.vesselName,
      arrival_date: this.arrivalDate,
      total_lead_time: this.totalLeadTime,
      drydock_duration: this.drydockDuration,
      cover_image_base64: this.coverImageBase64,
      interior_image_base64: this.interiorImageBase64,
      company_logo_base64: this.companyLogoBase64,
      subcontractors: this.subcontractors,
      shipyard_scopes: processedScopes
    };

    this.aiService.generateSurveyReport(payload).subscribe({
      next: (res) => {
        this.generatedReportId = res.report_id;
        this.isGeneratingReport = false;
        this.nextStep();
      },
      error: (err) => {
        this.isGeneratingReport = false;
        console.error("Error generating report", err);
        alert("Failed to generate survey report: " + (err.error?.detail || err.message));
      }
    });
  }

  previewingTemplate: any = null;
  isLoadingDocx: boolean = false;
  isViewingDocx: boolean = false;

  togglePreview(tpl: any) {
    if (this.previewingTemplate && this.previewingTemplate.filename === tpl?.filename) {
      this.previewingTemplate = null;
      this.isViewingDocx = false;
    } else {
      this.previewingTemplate = tpl;
      this.isViewingDocx = true;
      if (tpl) {
        this.loadDocxPreview(tpl);
      }
    }
  }

  loadDocxPreview(tpl: any) {
    this.isLoadingDocx = true;
    this.aiService.getSurveyTemplateBlob(tpl.filename).subscribe({
      next: (blob) => {
        this.isLoadingDocx = false;
        setTimeout(() => {
          const container = document.getElementById('docx-preview-container');
          if (container) {
            container.innerHTML = '';
            docx.renderAsync(blob, container, undefined, {
              className: "docx",
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              ignoreLastRenderedPageBreak: true,
              experimental: false,
              trimXmlDeclaration: true,
              useBase64URL: false,
            })
            .then(() => console.log("DOCX rendering complete."))
            .catch(err => {
              console.error("Error rendering DOCX:", err);
              container.innerHTML = `<div class="error-msg" style="padding: 24px; color: #ef4444; font-weight: bold; text-align: center;">Error rendering DOCX file preview. Please try downloading the raw file.</div>`;
            });
          }
        }, 100);
      },
      error: (err) => {
        this.isLoadingDocx = false;
        console.error("Error downloading template blob:", err);
        alert("Failed to load template file.");
      }
    });
  }

  // Direct download helpers
  downloadTemplate(tpl: any) {
    if (tpl) {
      const url = this.aiService.downloadSurveyTemplateUrl(tpl.filename);
      window.open(url, '_blank');
    }
  }

  downloadDocx() {
    if (this.generatedReportId) {
      const url = this.aiService.downloadGeneratedDocxUrl(this.generatedReportId);
      window.open(url, '_blank');
    }
  }

  downloadPdf() {
    if (this.generatedReportId) {
      const url = this.aiService.downloadGeneratedPdfUrl(this.generatedReportId);
      window.open(url, '_blank');
    }
  }
}
