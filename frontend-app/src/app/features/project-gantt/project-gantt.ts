import { Component, OnInit, ViewEncapsulation, ElementRef, ViewChild, AfterViewInit, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { gantt } from 'dhtmlx-gantt';
import { AiService } from '../../core/services/ai.service';
import { GANTT_ERRORS } from '../../core/constants/gantt-errors';

@Component({
  selector: 'app-project-gantt',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, FormsModule],
  templateUrl: './project-gantt.html',
  styleUrl: './project-gantt.scss',
  encapsulation: ViewEncapsulation.None
})
export class ProjectGantt implements AfterViewInit, OnInit {

  @ViewChild('ganttContainer', { static: false }) ganttContainer!: ElementRef;

  aiService = inject(AiService);
  ngZone = inject(NgZone);
  cdr = inject(ChangeDetectorRef);

  projects: any[] = [];
  selectedProject: any = null;
  showMetrics = false;
  showPredecessors = false;

  isModalOpen = false;
  editingTask: any = null;
  editMode: 'actual' | 'planned' = 'actual';
  activeErrors: string[] = [];
  isValidationErrorModalOpen = false;
  validationErrors: string[] = [];
  eligiblePredecessors: any[] = [];

  tasks: any = {
    data: [],
    links: []
  };

  getCurrencySymbol(): string {
    if (this.selectedProject && this.selectedProject['currency']) {
      const cur = String(this.selectedProject['currency']).toUpperCase();
      if (cur === 'USD') return '$';
      if (cur === 'EUR') return '€';
      if (cur === 'GBP') return '£';
      return cur + ' ';
    }
    return '€';
  }

  ngOnInit() {
    this.setupGantt();
    this.loadProjects();
  }

  loadProjects() {
    this.aiService.getProjects().subscribe({
      next: (res) => {
        this.projects = res;
        if (this.projects.length > 0) {
          this.selectedProject = this.projects[0];
          this.onProjectChange();
        } else {
          // No projects found
          gantt.clearAll();
        }
      },
      error: (err) => console.error("Error loading projects", err)
    });
  }

  setupGantt() {
    gantt.config.date_format = "%d-%m-%Y";
    gantt.config.duration_unit = "day";
    gantt.config.scale_height = 50;
    gantt.config.row_height = 40;
    gantt.config.details_on_dblclick = true;
    gantt.config['grid_resize'] = true;

    // Enable work hours: exclude Saturdays and Sundays
    gantt.config.work_time = true;
    gantt.config.correct_work_time = true;
    gantt.config.skip_off_time = true;
    gantt.setWorkTime({ day: 6, hours: false }); // Saturday off
    gantt.setWorkTime({ day: 0, hours: false }); // Sunday off

    gantt.templates.timeline_cell_class = (task: any, date: Date) => {
      if (this.currentViewMode === 'Week' && !gantt.isWorkTime({ date, task })) {
        return "weekend-cell";
      }
      return "";
    };

    gantt.templates.task_class = (start: Date, end: Date, task: any) => {
      let cssClass = '';
      const status = task.status || 'In Progress';
      if (status === 'Completed') {
        cssClass = 'gantt-status-completed';
      } else if (status === 'In Progress') {
        cssClass = 'gantt-status-in-progress';
      } else if (status === 'Not Started' || status === 'To Do' || status === 'todo' || status === 'Planned') {
        cssClass = 'gantt-status-not-started';
      } else if (status === 'Delayed') {
        cssClass = 'gantt-status-delayed';
      }
      
      if (task.type === "project") {
        cssClass += " gantt_project";
      } else if (task.type === "milestone") {
        cssClass += " gantt_milestone";
      }
      return cssClass;
    };

    const numberEditor = { type: "number", map_to: "Planned_crew", min: 1, max: 100 };
    const actualNumberEditor = { type: "number", map_to: "Actual_crew", min: 1, max: 100 };

    // Configure Lightbox sections for double-click editing
    gantt.config.lightbox.sections = [
      { name: "description", height: 38, map_to: "text", type: "textarea", focus: true },
      { name: "Planned_crew", height: 28, map_to: "Planned_crew", type: "textarea" },
      { name: "Actual_crew", height: 28, map_to: "Actual_crew", type: "textarea" },
      { name: "time", height: 72, map_to: "auto", type: "duration" }
    ];

    gantt.locale.labels['section_Planned_crew'] = "Planned Crew";
    gantt.locale.labels['section_Actual_crew'] = "Actual Crew";
    gantt.locale.labels['section_planned_crew'] = "Planned Crew";
    gantt.locale.labels['section_actual_crew'] = "Actual Crew";

    this.updateGanttColumns();

    // Grid layout configuration
    gantt.config.layout = {
      css: "gantt_container",
      rows: [
        {
          cols: [
            { view: "grid", scrollX: "scrollHor", scrollY: "scrollVer" },
            { resizer: true, width: 1 },
            { view: "timeline", scrollX: "scrollHor", scrollY: "scrollVer" },
            { view: "scrollbar", id: "scrollVer" }
          ]
        },
        { view: "scrollbar", id: "scrollHor" }
      ]
    };

    const zoomConfig = {
      levels: [
        {
          name: "week",
          scale_height: 50,
          min_column_width: 50,
          scales: [
            { unit: "week", step: 1, format: "Week #%W" },
            { unit: "day", step: 1, format: "%D %d" }
          ]
        },
        {
          name: "month",
          scale_height: 50,
          min_column_width: 120,
          scales: [
            { unit: "month", step: 1, format: "%F, %Y" },
            { unit: "week", step: 1, format: "Week #%W" }
          ]
        },
        {
          name: "quarter",
          scale_height: 50,
          min_column_width: 90,
          scales: [
            { unit: "month", step: 1, format: "%M" },
            {
              unit: "quarter", step: 1, format: function (date: Date) {
                const dateToStr = gantt.date.date_to_str("%M");
                const endDate = gantt.date.add(gantt.date.add(date, 3, "month"), -1, "day");
                return dateToStr(date) + " - " + dateToStr(endDate);
              }
            }
          ]
        },
        {
          name: "year",
          scale_height: 50,
          min_column_width: 30,
          scales: [
            { unit: "year", step: 1, format: "%Y" }
          ]
        }
      ]
    };
    gantt.ext.zoom.init(zoomConfig as any);
    gantt.ext.zoom.setLevel("quarter"); // Default view level

    // Display text on the right side for zoomed-out views to prevent truncation
    gantt.templates.rightside_text = (start: Date, end: Date, task: any) => {
      if (this.currentViewMode === 'Quarter' || this.currentViewMode === 'Year' || this.currentViewMode === 'Month') {
        return task.text;
      }
      return "";
    };

    gantt.templates.task_text = (start: Date, end: Date, task: any) => {
      if (this.currentViewMode === 'Quarter' || this.currentViewMode === 'Year' || this.currentViewMode === 'Month') {
        return ""; // Clear inner text to prevent clipping
      }
      return task.text;
    };

    const updateParentCosts = (parentId: string | number) => {
      if (!parentId || parentId === gantt.config.root_id) return;
      try {
        const parent = gantt.getTask(parentId);
        if (parent) {
          const children = gantt.getChildren(parentId);
          let totalPlanned = 0;
          let totalActual = 0;
          children.forEach((childId) => {
            const child = gantt.getTask(childId);
            if (child) {
              totalPlanned += (parseFloat(child['Planned_cost']) || parseFloat(child['planned_cost']) || 0);
              totalActual += (parseFloat(child['Actual_cost']) || parseFloat(child['actual_cost']) || 0);
            }
          });
          if (parent['Planned_cost'] !== totalPlanned || parent['Actual_cost'] !== totalActual) {
            parent['Planned_cost'] = totalPlanned;
            parent['planned_cost'] = totalPlanned;
            parent['Actual_cost'] = totalActual;
            parent['actual_cost'] = totalActual;
            gantt.updateTask(parent.id);
            if (parent['parent'] !== undefined) {
              updateParentCosts(parent['parent']);
            }
          }
        }
      } catch (e) {
        console.error("Error updating parent costs", e);
      }
    };

    gantt.attachEvent("onAfterTaskUpdate", (id, task: any) => {
      if (!task) return;

      const dateToStr = gantt.date.date_to_str(gantt.config.date_format);

      if (task.start_date) {
        const newStartStr = dateToStr(task.start_date);
        if (task['Actual_start_date'] !== newStartStr) {
          task['Actual_start_date'] = newStartStr;
        }
      }

      if (task.end_date) {
        const newEndStr = dateToStr(task.end_date);
        if (task['Actual_end_date'] !== newEndStr) {
          task['Actual_end_date'] = newEndStr;
          task['actual_end_date'] = newEndStr;
        }
      }

      if (task.duration !== undefined) {
        if (task['Actual_duration'] !== task.duration) {
          task['Actual_duration'] = task.duration;
        }
      }

      const hasChildren = gantt.getChildren(task.id).length > 0;
      if (!hasChildren && task.type !== "milestone" && task.type !== "project") {
        const pCrew = parseInt(task['Planned_crew'], 10) || parseInt(task['planned_crew'], 10) || 1;
        const aCrew = parseInt(task['Actual_crew'], 10) || parseInt(task['actual_crew'], 10) || pCrew;
        const duration = parseInt(task['Actual_duration'], 10) || parseInt(task['duration'], 10) || 1;

        const pDuration = parseInt(task['Planned_duration'], 10) || parseInt(task['planned_duration'], 10) || 1;
        const plannedCost = pCrew * pDuration * 800;
        const actualCost = aCrew * duration * 800;

        if (task['Planned_cost'] !== plannedCost || task['Actual_cost'] !== actualCost) {
          task['Planned_cost'] = plannedCost;
          task['planned_cost'] = plannedCost;
          task['Actual_cost'] = actualCost;
          task['actual_cost'] = actualCost;
        }
      }

      if (task['parent'] && task['parent'] !== gantt.config.root_id) {
        updateParentCosts(task['parent']);
      }
    });

    gantt.attachEvent("onBeforeTaskAdd", (id, task: any) => {
      if (!task.parent || task.parent === 0 || task.parent === gantt.config.root_id) {
        return false; // Prevent adding root items (projects)
      }
      try {
        const parentTask = gantt.getTask(task.parent);
        if (parentTask && (parentTask as any).$level >= 2) {
          return false; // Prevent nesting deeper than subtasks (level 2)
        }
      } catch (e) {
        // If parent task is not found (e.g. invalid parent), prevent adding
        return false;
      }
      return true;
    });

    gantt.attachEvent("onBeforeTaskMove", (id, parent, tindex) => {
      try {
        const task = gantt.getTask(id);
        if (task.type === "project") {
          return false; // Cannot move project
        }
        if (!parent || parent === 0 || parent === gantt.config.root_id) {
          return false; // Cannot move task to root level
        }
        const parentTask = gantt.getTask(parent);
        if (parentTask && (parentTask as any).$level >= 2) {
          return false; // Cannot move task under a subtask
        }
      } catch (e) {
        return false;
      }
      return true;
    });

    gantt.attachEvent("onBeforeTaskUpdate", (id, task: any) => {
      if (this.isModalOpen) {
        return true;
      }
      const errors = this.validateTask(task);
      if (errors.length > 0) {
        this.showValidationErrorModal(errors);
        return false;
      }
      return true;
    });

    gantt.attachEvent("onBeforeLightbox", (id) => {
      const task = gantt.getTask(id);
      this.openEditModal(task);
      return false; // prevent default lightbox
    });

    gantt.attachEvent("onBeforeLinkAdd", (id, link: any) => {
      try {
        const sourceTask = gantt.getTask(link.source);
        const targetTask = gantt.getTask(link.target);
        if (sourceTask && targetTask) {
          if (!this.isPredecessorCompleted(sourceTask) && this.isTaskStarted(targetTask)) {
            const err = `${GANTT_ERRORS.ERR_011.code}: Predecessor Constraint: Cannot link predecessor "${sourceTask.text}" because it is not in Completed status (Current status: ${sourceTask['status'] || 'Not Started'}), while task "${targetTask.text}" has already been started.`;
            this.showValidationErrorModal([err]);
            return false;
          }
        }
      } catch (e) {}
      return true;
    });

    gantt.attachEvent("onAfterLinkAdd", (id, link) => {
      this.ngZone.run(() => {
        gantt.render();
        this.cdr.detectChanges();
      });
    });

    gantt.attachEvent("onAfterLinkDelete", (id, link) => {
      this.ngZone.run(() => {
        gantt.render();
        this.cdr.detectChanges();
      });
    });

    gantt.attachEvent("onAfterLinkUpdate", (id, link) => {
      this.ngZone.run(() => {
        gantt.render();
        this.cdr.detectChanges();
      });
    });

    gantt.attachEvent("onTaskClick", (id, e) => {
      if (!e) return true;
      const target = (e.target || (e as any).srcElement) as HTMLElement;
      if (target) {
        // Direct click on 'x' button inside predecessor badge to remove dependency
        if (target.classList.contains("pred-remove-btn") || target.closest(".pred-remove-btn")) {
          const btn = target.classList.contains("pred-remove-btn") ? target : target.closest(".pred-remove-btn");
          const taskId = btn?.getAttribute("data-task-id") || id;
          const predId = btn?.getAttribute("data-pred-id");
          this.removePredecessor(taskId, predId || undefined);
          return false;
        }

        // Click on '+ Add' or predecessor name badge to open modal to add/update dependency
        if (target.classList.contains("pred-add-btn") || target.closest(".pred-add-btn") || 
            target.classList.contains("pred-name") || target.closest(".pred-name")) {
          const task = gantt.getTask(id);
          this.openEditModal(task);
          return false;
        }
      }
      return true;
    });
  }

  dp: any = null;

  ngAfterViewInit() {
    gantt.init(this.ganttContainer.nativeElement);
    this.setupDataProcessor();
  }

  setupDataProcessor() {
    if (this.dp) {
      this.dp.destructor();
    }
    this.dp = gantt.createDataProcessor((entity: string, action: string, data: any, id: string | number) => {
      if (!this.selectedProject || this.selectedProject.project_id === 'demo-maritime-project-001') {
        return new Promise(resolve => resolve({}));
      }

      const projectId = this.selectedProject.project_id;

      return new Promise((resolve, reject) => {
        if (entity === "task") {
          if (action === "create") {
            this.aiService.createGanttTask(projectId, data).subscribe({
              next: (res) => {
                resolve(res);
                this.onProjectChange();
              },
              error: (err) => reject(err)
            });
          } else if (action === "update") {
            this.aiService.updateGanttTask(projectId, String(id), data).subscribe({
              next: (res) => {
                resolve(res);
                this.onProjectChange();
              },
              error: (err) => reject(err)
            });
          } else if (action === "delete") {
            this.aiService.deleteGanttTask(projectId, String(id)).subscribe({
              next: (res) => {
                resolve(res);
                this.onProjectChange();
              },
              error: (err) => reject(err)
            });
          } else {
            resolve({});
          }
        } else if (entity === "link") {
          if (action === "create") {
            this.aiService.createGanttLink(projectId, data).subscribe({
              next: (res) => resolve(res),
              error: (err) => reject(err)
            });
          } else if (action === "update") {
            this.aiService.updateGanttLink(projectId, String(id), data).subscribe({
              next: (res) => resolve(res),
              error: (err) => reject(err)
            });
          } else if (action === "delete") {
            this.aiService.deleteGanttLink(projectId, String(id)).subscribe({
              next: (res) => resolve(res),
              error: (err) => reject(err)
            });
          }
        }
      });
    });
  }

  renderGantt() {
    gantt.clearAll();
    gantt.parse(this.tasks);
    this.recalculateProgressAndRender();
  }

  zoomIn() {
    gantt.ext.zoom.zoomIn();
  }

  zoomOut() {
    gantt.ext.zoom.zoomOut();
  }

  currentViewMode = 'Quarter';

  changeViewMode(mode: string) {
    this.currentViewMode = mode;
    if (mode === 'Week') {
      gantt.ext.zoom.setLevel('week');
    } else if (mode === 'Month') {
      gantt.ext.zoom.setLevel('month');
    } else if (mode === 'Quarter') {
      gantt.ext.zoom.setLevel('quarter');
    } else if (mode === 'Year') {
      gantt.ext.zoom.setLevel('year');
    }
    gantt.render(); // Re-render to apply text placement templates
  }

  onProjectChange() {
    if (!this.selectedProject) return;

    this.aiService.getProjectGanttData(this.selectedProject.project_id).subscribe({
      next: (res) => {
        this.tasks = res;
        this.updateGanttColumns();
        this.renderGantt();
      },
      error: (err) => console.error("Error loading gantt data", err)
    });
  }

  toggleMetrics() {
    this.showMetrics = !this.showMetrics;
    this.updateGanttColumns();
    gantt.render();
  }

  togglePredecessors() {
    this.showPredecessors = !this.showPredecessors;
    this.updateGanttColumns();
    gantt.render();
  }

  updateGanttColumns() {
    const numberEditor = { type: "number", map_to: "Planned_crew", min: 1, max: 100 };
    const actualNumberEditor = { type: "number", map_to: "Actual_crew", min: 1, max: 100 };

    let gridWidth = 750;
    if (this.showPredecessors) {
      gridWidth += 160;
    }
    if (this.showMetrics) {
      gridWidth += 640;
    }
    gantt.config.grid_width = gridWidth;

    const baseColumns: any[] = [
      {
        name: "text",
        label: "Task name",
        tree: true,
        width: '*',
        min_width: 200,
        resize: true,
        template: (task: any) => {
          return `<span title="${task.text}">${task.text}</span>`;
        }
      }
    ];

    if (this.showPredecessors) {
      baseColumns.push({
        name: "predecessor",
        label: "Predecessor",
        align: "center",
        width: 160,
        resize: true,
        template: (task: any) => {
          if (task.type === "project") return "";
          const preds = this.getPredecessors(task);
          if (preds.length === 0) {
            return `<span class="pred-add-btn" data-task-id="${task.id}" title="Click to add predecessor dependency">+ Add</span>`;
          }
          return preds.map(p => `
            <span class="gantt-pred-badge" title="Dependent on: ${p.text} (Click to edit)">
              <span class="pred-name" data-task-id="${task.id}">${p.text}</span>
              <span class="pred-remove-btn" data-task-id="${task.id}" data-pred-id="${p.id}" title="Remove dependency on ${p.text}">&times;</span>
            </span>
          `).join(" ");
        }
      });
    }
    baseColumns.push(
      {
        name: "Actual_start_date",
        label: "Start date",
        align: "center",
        width: 100,
        resize: true,
        template: (task: any) => {
          if (task.status === 'Not Started' || task['status'] === 'Not Started') {
            return "N/A";
          }
          if (task.Actual_start_date) {
            return task.Actual_start_date;
          }
          if (task.start_date) {
            const dateToStr = gantt.date.date_to_str(gantt.config.date_format);
            return typeof task.start_date === 'string' ? task.start_date : dateToStr(task.start_date);
          }
          return "";
        }
      },
      {
        name: "Actual_end_date",
        label: "End date",
        align: "center",
        width: 100,
        resize: true,
        template: (task: any) => {
          if (task.status === 'Not Started' || task['status'] === 'Not Started') {
            return "N/A";
          }
          if (task.Actual_end_date) {
            return task.Actual_end_date;
          }
          if (task.actual_end_date) {
            return task.actual_end_date;
          }
          if (task.planned_end_date) {
            return task.planned_end_date;
          }
          if (task.end_date) {
            const dateToStr = gantt.date.date_to_str(gantt.config.date_format);
            return typeof task.end_date === 'string' ? task.end_date : dateToStr(task.end_date);
          }
          return "";
        }
      },
      {
        name: "Actual_duration",
        label: "Duration",
        align: "center",
        width: 65,
        resize: true,
        template: (task: any) => {
          if (task.type === "milestone") {
            return "";
          }
          const days = task.Actual_duration !== undefined ? task.Actual_duration : (task.duration || 0);
          const w = Math.floor(days / 5);
          const d = days % 5;
          if (w > 0 && d > 0) {
            return `${w} w ${d} d`;
          } else if (w > 0) {
            return `${w} w`;
          } else {
            return `${d} d`;
          }
        }
      },
      {
        name: "progress",
        label: "Progress",
        align: "center",
        width: 80,
        resize: true,
        template: (task: any) => {
          const pct = Math.round((task.progress || 0) * 100);
          return `<span>${pct}%</span>`;
        }
      },
      {
        name: "status",
        label: "Status",
        align: "center",
        width: 130,
        resize: true,
        template: (task: any) => {
          const status = task.status || 'In Progress';
          let emoji = '🔵';
          if (status === 'Completed') emoji = '🟢';
          else if (status === 'In Progress') emoji = '🔵';
          else if (status === 'Not Started' || status === 'To Do' || status === 'todo') emoji = '⚪';
          else if (status === 'Delayed') emoji = '🔴';
          return `<span>${emoji} ${status}</span>`;
        }
      }
    );

    if (this.showMetrics) {
      baseColumns.push(
        {
          name: "Actual_crew",
          label: "Crew",
          align: "center",
          width: 80,
          resize: true,
          template: (task: any) => {
            if (task.type === "project" || task.type === "milestone") return "";
            const hasChildren = gantt.getChildren(task.id).length > 0;
            if (hasChildren) return "";
            return task.Actual_crew || task.actual_crew || task.Planned_crew || task.planned_crew || 1;
          }
        } as any,
        {
          name: "Actual_cost",
          label: "Cost",
          align: "center",
          width: 100,
          resize: true,
          template: (task: any) => {
            if (task.type === "milestone") return "";
            const cost = parseFloat(task.Actual_cost || task.actual_cost || 0);
            const symbol = this.getCurrencySymbol();
            return `${symbol}${cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          }
        } as any,
        {
          name: "planned_start_date",
          label: "P_Start",
          align: "center",
          width: 100,
          resize: true,
          template: (task: any) => {
            if (task.type === "milestone") return "";
            if (task.status === 'Not Started' || task['status'] === 'Not Started') {
              return "N/A";
            }
            return task.planned_start_date || "";
          }
        } as any,
        {
          name: "planned_end_date",
          label: "P_End",
          align: "center",
          width: 100,
          resize: true,
          template: (task: any) => {
            if (task.type === "milestone") return "";
            if (task.status === 'Not Started' || task['status'] === 'Not Started') {
              return "N/A";
            }
            return task.planned_end_date || "";
          }
        } as any,
        {
          name: "Planned_duration",
          label: "P_Duration",
          align: "center",
          width: 90,
          resize: true,
          template: (task: any) => {
            if (task.type === "milestone") return "";
            const days = task.Planned_duration !== undefined ? task.Planned_duration : (task.planned_duration || 0);
            const w = Math.floor(days / 5);
            const d = days % 5;
            if (w > 0 && d > 0) {
              return `${w} w ${d} d`;
            } else if (w > 0) {
              return `${w} w`;
            } else {
              return `${d} d`;
            }
          }
        } as any,
        {
          name: "Planned_crew",
          label: "P_Crew",
          align: "center",
          width: 80,
          resize: true,
          template: (task: any) => {
            if (task.type === "project" || task.type === "milestone") return "";
            const hasChildren = gantt.getChildren(task.id).length > 0;
            if (hasChildren) return "";
            return task.Planned_crew || task.planned_crew || 1;
          }
        } as any,
        {
          name: "Planned_cost",
          label: "P_Cost",
          align: "center",
          width: 100,
          resize: true,
          template: (task: any) => {
            if (task.type === "milestone") return "";
            const cost = parseFloat(task.Planned_cost || task.planned_cost || 0);
            const symbol = this.getCurrencySymbol();
            return `${symbol}${cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          }
        } as any,
        {
          name: "add",
          label: "",
          width: 44,
          css: (task: any) => {
            if (task.$level >= 2) {
              return "hide-add-btn";
            }
            return "";
          },
          template: (task: any) => {
            if (task.$level >= 2) {
              return "";
            }
            return `
              <div class="gantt_add" style="cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
            `;
          }
        } as any
      );
    }

    gantt.config.columns = baseColumns;
  }

  parseDate(str: string): Date | null {
    if (!str) return null;
    const parser = gantt.date.str_to_date(gantt.config.date_format);
    try {
      const parsed = parser(str);
      return parsed instanceof Date && !isNaN(parsed.getTime()) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  formatDate(date: Date): string {
    if (!date) return "";
    const formatter = gantt.date.date_to_str(gantt.config.date_format);
    return formatter(date);
  }

  validateTask(task: any): string[] {
    const errors: string[] = [];
    if (!task) return errors;

    // Predecessor Dependency Rule (ERR-011):
    // If any task or subtask has a predecessor, that predecessor must be in 'Completed' status.
    // Otherwise, this particular task or subtask cannot be started.
    const predsToCheck: any[] = [];
    if (this.editingTask && String(this.editingTask.id) === String(task.id)) {
      if (this.editingTask.selectedPredecessorId) {
        try {
          const pt = gantt.getTask(this.editingTask.selectedPredecessorId);
          if (pt) predsToCheck.push(pt);
        } catch (e) {}
      }
    } else {
      predsToCheck.push(...this.getPredecessors(task));
    }

    if (predsToCheck.length > 0 && this.isTaskStarted(task)) {
      for (const pred of predsToCheck) {
        if (!this.isPredecessorCompleted(pred)) {
          errors.push(
            `${GANTT_ERRORS.ERR_011.code}: Predecessor Constraint: Task "${task.text}" cannot be started because its predecessor "${pred.text}" is not in Completed status (Current predecessor status: ${pred.status || 'Not Started'}).`
          );
        }
      }
    }

    const rootId = gantt.config.root_id;

    // Subtask constraint: If parent task has a predecessor that is not completed, subtask cannot start either
    if (task.parent && task.parent !== rootId && this.isTaskStarted(task)) {
      try {
        const parentTask = gantt.getTask(task.parent);
        if (parentTask && parentTask.type !== 'project') {
          const parentPreds = this.getPredecessors(parentTask);
          for (const pPred of parentPreds) {
            if (!this.isPredecessorCompleted(pPred)) {
              errors.push(
                `${GANTT_ERRORS.ERR_011.code}: Predecessor Constraint: Subtask "${task.text}" cannot be started because parent task "${parentTask.text}" has predecessor "${pPred.text}" that is not in Completed status (Current status: ${pPred.status || 'Not Started'}).`
              );
            }
          }
        }
      } catch (e) {}
    }

    // Helper to get task state (handling if the id matches the current edited task)
    const getTaskState = (id: string | number) => {
      const gt = gantt.getTask(id);
      if (String(id) === String(task.id)) {
        return {
          ...gt,
          ...task,
          status: task.status || gt['status'] || 'To Do',
          progressPercent: task.progressPercent !== undefined ? task.progressPercent : Math.round((gt.progress || 0) * 100),
          planned_start_date: task.planned_start_date || gt['planned_start_date'] || "",
          planned_end_date: task.planned_end_date || gt['planned_end_date'] || "",
          Planned_duration: task.Planned_duration !== undefined ? task.Planned_duration : (gt['Planned_duration'] || gt['planned_duration'] || 0),
          Planned_cost: task.Planned_cost !== undefined ? task.Planned_cost : (gt['Planned_cost'] || gt['planned_cost'] || 0),
          Planned_crew: task.Planned_crew !== undefined ? task.Planned_crew : (gt['Planned_crew'] || gt['planned_crew'] || 1)
        };
      }
      return {
        ...gt,
        status: gt['status'] || 'To Do',
        progressPercent: Math.round((gt.progress || 0) * 100),
        planned_start_date: gt['planned_start_date'] || "",
        planned_end_date: gt['planned_end_date'] || "",
        Planned_duration: gt['Planned_duration'] !== undefined ? gt['Planned_duration'] : (gt['planned_duration'] || 0),
        Planned_cost: gt['Planned_cost'] !== undefined ? gt['Planned_cost'] : (gt['planned_cost'] || 0),
        Planned_crew: gt['Planned_crew'] !== undefined ? gt['Planned_crew'] : (gt['planned_crew'] || 1)
      };
    };

    // Helpers to dynamically resolve actual dates for started tasks
    const getActualStartDate = (t: any): Date | null => {
      if (!this.isTaskStarted(t)) return null;
      if (this.isModalOpen && this.editingTask && String(t.id) === String(this.editingTask.id)) {
        return this.parseDate(this.editingTask.Actual_start_date || this.editingTask.actual_start_date);
      }
      return this.parseDate(t.Actual_start_date || t.actual_start_date);
    };

    const getActualEndDate = (t: any): Date | null => {
      if (!this.isTaskStarted(t)) return null;
      if (this.isModalOpen && this.editingTask && String(t.id) === String(this.editingTask.id)) {
        return this.parseDate(this.editingTask.Actual_end_date || this.editingTask.actual_end_date);
      }
      return this.parseDate(t.Actual_end_date || t.actual_end_date);
    };

    // Rule 1 & 2: Project date validation (Actual)
    if (task.type === 'project' && (!task.parent || task.parent === rootId)) {
      if (this.isTaskStarted(task)) {
        const projStart = getActualStartDate(task);
        const projEnd = getActualEndDate(task);
        if (projStart && projEnd) {
          const childIds = gantt.getChildren(task.id);
          const childStarts: Date[] = [];
          const childEnds: Date[] = [];

          childIds.forEach(cId => {
            const childState = getTaskState(cId);
            if (this.isTaskStarted(childState)) {
              const cs = getActualStartDate(childState);
              const ce = getActualEndDate(childState);
              if (cs) childStarts.push(cs);
              if (ce) childEnds.push(ce);
            }
          });

          if (childStarts.length > 0) {
            const minChildStart = new Date(Math.min(...childStarts.map(d => d.getTime())));
            if (projStart < minChildStart) {
              errors.push(`${GANTT_ERRORS.ERR_001.code}: ${GANTT_ERRORS.ERR_001.message} (Project: ${this.formatDate(projStart)}, Tasks Min Start: ${this.formatDate(minChildStart)})`);
            }
          }
          if (childEnds.length > 0) {
            const maxChildEnd = new Date(Math.max(...childEnds.map(d => d.getTime())));
            if (projEnd > maxChildEnd) {
              errors.push(`${GANTT_ERRORS.ERR_002.code}: ${GANTT_ERRORS.ERR_002.message} (Project: ${this.formatDate(projEnd)}, Tasks Max End: ${this.formatDate(maxChildEnd)})`);
            }
          }
        }
      }
    }

    // Rule 3 & 4: Task date validation against subtasks (Actual)
    if (task.type !== 'project' && task.type !== 'milestone') {
      const childIds = gantt.getChildren(task.id);
      if (childIds.length > 0 && this.isTaskStarted(task)) {
        const taskStart = getActualStartDate(task);
        const taskEnd = getActualEndDate(task);
        if (taskStart && taskEnd) {
          const subStarts: Date[] = [];
          const subEnds: Date[] = [];

          childIds.forEach(cId => {
            const subState = getTaskState(cId);
            if (this.isTaskStarted(subState)) {
              const ss = getActualStartDate(subState);
              const se = getActualEndDate(subState);
              if (ss) subStarts.push(ss);
              if (se) subEnds.push(se);
            }
          });

          if (subStarts.length > 0) {
            const minSubStart = new Date(Math.min(...subStarts.map(d => d.getTime())));
            if (taskStart < minSubStart) {
              errors.push(`${GANTT_ERRORS.ERR_003.code}: ${GANTT_ERRORS.ERR_003.message} (Task: ${this.formatDate(taskStart)}, Subtasks Min Start: ${this.formatDate(minSubStart)})`);
            }
          }
          if (subEnds.length > 0) {
            const maxSubEnd = new Date(Math.max(...subEnds.map(d => d.getTime())));
            if (taskEnd > maxSubEnd) {
              errors.push(`${GANTT_ERRORS.ERR_004.code}: ${GANTT_ERRORS.ERR_004.message} (Task: ${this.formatDate(taskEnd)}, Subtasks Max End: ${this.formatDate(maxSubEnd)})`);
            }
          }
        }
      }
    }

    // Rule 5: Task Budget Sum check
    if (task.type !== 'project' && task.type !== 'milestone') {
      const childIds = gantt.getChildren(task.id);
      if (childIds.length > 0 && task.status !== 'Not Started') {
        let sumCosts = 0;
        childIds.forEach(cId => {
          const subState = getTaskState(cId);
          if (subState.status !== 'Not Started') {
            sumCosts += parseFloat(subState.Planned_cost || 0);
          }
        });
        const currentCost = parseFloat(task.Planned_cost || 0);
        if (Math.abs(currentCost - sumCosts) > 1.0) {
          errors.push(`${GANTT_ERRORS.ERR_005.code}: ${GANTT_ERRORS.ERR_005.message} (Expected task budget: ${sumCosts}, actual: ${currentCost})`);
        }
      }
    }

    // Rule 6: Project Budget Sum check
    if (task.type === 'project' && (!task.parent || task.parent === rootId)) {
      if (task.status !== 'Not Started') {
        const childIds = gantt.getChildren(task.id);
        let sumCosts = 0;
        childIds.forEach(cId => {
          const taskState = getTaskState(cId);
          if (taskState.status !== 'Not Started') {
            sumCosts += parseFloat(taskState.Planned_cost || 0);
          }
        });
        const currentCost = parseFloat(task.Planned_cost || 0);
        if (Math.abs(currentCost - sumCosts) > 1.0) {
          errors.push(`${GANTT_ERRORS.ERR_006.code}: ${GANTT_ERRORS.ERR_006.message} (Expected project budget: ${sumCosts}, actual: ${currentCost})`);
        }
      }
    }

    // Rule 7: Task Progress Average check
    if (task.type !== 'project' && task.type !== 'milestone') {
      const childIds = gantt.getChildren(task.id);
      if (childIds.length > 0 && task.status !== 'Not Started') {
        let totalProgress = 0;
        let subtasksCount = 0;
        childIds.forEach(cId => {
          const subState = getTaskState(cId);
          if (subState.status !== 'Not Started') {
            totalProgress += subState.progressPercent || 0;
            subtasksCount++;
          }
        });
        const avgProgress = subtasksCount > 0 ? (totalProgress / subtasksCount) : 0;
        const currentProgress = task.progressPercent !== undefined ? task.progressPercent : Math.round((task.progress || 0) * 100);
        if (Math.abs(currentProgress - avgProgress) > 1.0) {
          errors.push(`${GANTT_ERRORS.ERR_007.code}: ${GANTT_ERRORS.ERR_007.message} (Expected task progress: ${Math.round(avgProgress)}%, actual: ${currentProgress}%)`);
        }
      }
    }

    // Rule 8: Project Progress Average check
    if (task.type === 'project' && (!task.parent || task.parent === rootId)) {
      if (task.status !== 'Not Started') {
        const childIds = gantt.getChildren(task.id);
        let totalProgress = 0;
        let tasksCount = 0;
        childIds.forEach(cId => {
          const taskState = getTaskState(cId);
          if (taskState.status !== 'Not Started') {
            totalProgress += taskState.progressPercent || 0;
            tasksCount++;
          }
        });
        const avgProgress = tasksCount > 0 ? (totalProgress / tasksCount) : 0;
        const currentProgress = task.progressPercent !== undefined ? task.progressPercent : Math.round((task.progress || 0) * 100);
        if (Math.abs(currentProgress - avgProgress) > 1.0) {
          errors.push(`${GANTT_ERRORS.ERR_008.code}: ${GANTT_ERRORS.ERR_008.message} (Expected project progress: ${Math.round(avgProgress)}%, actual: ${currentProgress}%)`);
        }
      }
    }

    return errors;
  }

  calculateDerivedValues(task: any) {
    const childIds = gantt.getChildren(task.id);
    let calculatedProgressPercent = Math.round((task.progress || 0) * 100);
    let calculatedPlannedCost = task.Planned_cost !== undefined ? task.Planned_cost : (task.planned_cost || 0);
    let calculatedActualCost = task.Actual_cost !== undefined ? task.Actual_cost : (task.actual_cost || 0);

    const getTaskState = (id: string | number) => {
      if (this.editingTask && String(this.editingTask.id) === String(id)) {
        return this.editingTask;
      }
      return gantt.getTask(id);
    };

    let minPlannedStart: Date | null = null;
    let maxPlannedEnd: Date | null = null;
    let minActualStart: Date | null = null;
    let maxActualEnd: Date | null = null;
    let calculatedPlannedDuration = task.Planned_duration !== undefined ? task.Planned_duration : (task.planned_duration || 1);
    let calculatedActualDuration = task.Actual_duration !== undefined ? task.Actual_duration : (task.duration || 1);

    if (task.type === 'project' || (task.type === 'task' && childIds.length > 0)) {
      let totalProgress = 0;
      let childCount = 0;
      let totalPlannedCost = 0;
      let totalActualCost = 0;
      
      childIds.forEach(cId => {
        const child = getTaskState(cId);
        if (child) {
          if (child.status !== 'Not Started') {
            totalProgress += child.progressPercent !== undefined ? child.progressPercent : Math.round((child.progress || 0) * 100);
            childCount++;
            totalActualCost += parseFloat(child.Actual_cost || child.actual_cost || 0);
          }
          totalPlannedCost += parseFloat(child.Planned_cost || child.planned_cost || 0);

          const pStartStr = child.planned_start_date || (child.start_date ? (typeof child.start_date === 'string' ? child.start_date : this.formatDate(child.start_date)) : "");
          const pEndStr = child.planned_end_date || (child.end_date ? (typeof child.end_date === 'string' ? child.end_date : this.formatDate(child.end_date)) : "");
          const aStartStr = child.Actual_start_date || child.actual_start_date || (child.start_date ? (typeof child.start_date === 'string' ? child.start_date : this.formatDate(child.start_date)) : "");
          const aEndStr = child.Actual_end_date || child.actual_end_date || (child.end_date ? (typeof child.end_date === 'string' ? child.end_date : this.formatDate(child.end_date)) : "");

          const cps = this.parseDate(pStartStr);
          const cpe = this.parseDate(pEndStr);
          const cas = this.parseDate(aStartStr);
          const cae = this.parseDate(aEndStr);

          if (cps && (!minPlannedStart || cps < minPlannedStart)) minPlannedStart = cps;
          if (cpe && (!maxPlannedEnd || cpe > maxPlannedEnd)) maxPlannedEnd = cpe;
          if (cas && (!minActualStart || cas < minActualStart)) minActualStart = cas;
          if (cae && (!maxActualEnd || cae > maxActualEnd)) maxActualEnd = cae;
        }
      });
      
      if (childCount > 0) {
        calculatedProgressPercent = Math.round(totalProgress / childCount);
      } else {
        calculatedProgressPercent = 0;
      }
      calculatedPlannedCost = totalPlannedCost;
      calculatedActualCost = totalActualCost;

      if (minPlannedStart && maxPlannedEnd) {
        calculatedPlannedDuration = gantt.calculateDuration({ start_date: minPlannedStart, end_date: maxPlannedEnd, task });
      }
      if (minActualStart && maxActualEnd) {
        calculatedActualDuration = gantt.calculateDuration({ start_date: minActualStart, end_date: maxActualEnd, task });
      }
    }

    return {
      progressPercent: calculatedProgressPercent,
      Planned_cost: calculatedPlannedCost,
      Actual_cost: calculatedActualCost,
      planned_start_date: minPlannedStart ? this.formatDate(minPlannedStart) : "",
      planned_end_date: maxPlannedEnd ? this.formatDate(maxPlannedEnd) : "",
      Planned_duration: calculatedPlannedDuration,
      Actual_start_date: minActualStart ? this.formatDate(minActualStart) : "",
      Actual_end_date: maxActualEnd ? this.formatDate(maxActualEnd) : "",
      Actual_duration: calculatedActualDuration
    };
  }

  openEditModal(task: any) {
    this.ngZone.run(() => {
      this.activeErrors = [];
      const hasChildren = gantt.getChildren(task.id).length > 0;
      
      // Auto-calculate derived properties to heal database out-of-sync values
      const derived = this.calculateDerivedValues(task);

      // Populate eligible predecessors (both tasks and subtasks)
      const candidates: any[] = [];
      gantt.eachTask((t: any) => {
        if (String(t.id) === String(task.id)) return;
        if (t.type === 'project') return;
        if (gantt.isChildOf(t.id, task.id)) return;
        if (this.isTaskDependentOn(t.id, task.id)) return;

        const isSubtask = t.parent && t.parent !== gantt.config.root_id;
        let category = 'Task';
        let parentName = '';
        if (isSubtask) {
          category = 'Subtask';
          try {
            const pTask = gantt.getTask(t.parent);
            if (pTask) parentName = pTask.text;
          } catch (e) {}
        }

        candidates.push({
          id: String(t.id),
          text: t.text,
          category,
          parentName,
          status: t.status || 'Not Started',
          type: t.type
        });
      });
      this.eligiblePredecessors = candidates;

      const currentPreds = this.getPredecessors(task);
      const selectedPredecessorId = currentPreds.length > 0 ? String(currentPreds[0].id) : "";

      const statusLower = (task.status || '').trim().toLowerCase();
      const isUnstarted = statusLower === 'not started' || statusLower === 'to do' || statusLower === 'todo' || statusLower === 'planned' || statusLower === '';

      this.editingTask = {
        ...task,
        hasChildren,
        selectedPredecessorId,
        originalPredecessorId: selectedPredecessorId,
        status: task.status || 'To Do',
        progressPercent: isUnstarted ? 0 : derived.progressPercent,
        Actual_start_date: task.type === 'project' || hasChildren 
          ? (derived.Actual_start_date || "") 
          : (isUnstarted ? (task.Actual_start_date || "") : (task.Actual_start_date || (task.start_date ? (typeof task.start_date === 'string' ? task.start_date : this.formatDate(task.start_date)) : ""))),
        Actual_end_date: task.type === 'project' || hasChildren 
          ? (derived.Actual_end_date || "") 
          : (isUnstarted ? (task.Actual_end_date || "") : (task.Actual_end_date || (task.end_date ? (typeof task.end_date === 'string' ? task.end_date : this.formatDate(task.end_date)) : ""))),
        Actual_duration: task.type === 'project' || hasChildren 
          ? (derived.Actual_duration || 1) 
          : (isUnstarted ? (task.Actual_duration || 0) : (task.Actual_duration !== undefined ? task.Actual_duration : (task.duration || 1))),
        Actual_crew: isUnstarted ? (task.Actual_crew || 0) : (task.Actual_crew || task.actual_crew || 1),
        Actual_cost: isUnstarted ? 0 : derived.Actual_cost,
        planned_start_date: task.type === 'project' || hasChildren ? (derived.planned_start_date || "") : (task.planned_start_date || (task.start_date ? (typeof task.start_date === 'string' ? task.start_date : this.formatDate(task.start_date)) : "")),
        planned_end_date: task.type === 'project' || hasChildren ? (derived.planned_end_date || "") : (task.planned_end_date || (task.end_date ? (typeof task.end_date === 'string' ? task.end_date : this.formatDate(task.end_date)) : "")),
        Planned_duration: task.type === 'project' || hasChildren ? (derived.Planned_duration || 1) : (task.Planned_duration !== undefined ? task.Planned_duration : (task.planned_duration || 1)),
        Planned_crew: task.Planned_crew || task.planned_crew || 1,
        Planned_cost: derived.Planned_cost
      };
      
      // Ensure costs are calculated automatically
      this.recalculateActualCost();
      this.recalculatePlannedCost();
      
      this.editMode = isUnstarted ? 'planned' : 'actual';
      this.isModalOpen = true;
      this.checkPredecessorConstraintInModal();
      this.cdr.detectChanges();
    });
  }

  setEditMode(mode: 'actual' | 'planned') {
    this.editMode = mode;
  }

  closeModal() {
    this.ngZone.run(() => {
      const state = gantt.getState() as any;
      if (this.editingTask && state.new_task === this.editingTask.id) {
        gantt.deleteTask(this.editingTask.id);
      }
      this.isModalOpen = false;
      this.editingTask = null;
      this.cdr.detectChanges();
    });
  }

  saveTask() {
    this.ngZone.run(() => {
      if (!this.editingTask) return;
      
      this.activeErrors = [];
      const errors = this.validateTask(this.editingTask);
      if (errors.length > 0) {
        this.activeErrors = errors;
        this.cdr.detectChanges();
        return;
      }
      
      const originalTask = gantt.getTask(this.editingTask.id);
      if (originalTask) {
        // Handle Predecessor link update
        const oldPredId = this.editingTask.originalPredecessorId;
        const newPredId = this.editingTask.selectedPredecessorId;

        if (oldPredId !== newPredId) {
          // Remove old link(s) for this target
          const targetLinks = [...(originalTask.$target || [])];
          targetLinks.forEach((linkId: string | number) => {
            try {
              const link = gantt.getLink(linkId);
              if (!newPredId || (link && String(link.source) === String(oldPredId))) {
                gantt.deleteLink(linkId);
              }
            } catch (e) {}
          });

          // Add new link if selected
          if (newPredId) {
            try {
              const newLinkId = 'link_' + Date.now();
              gantt.addLink({
                id: newLinkId,
                source: newPredId,
                target: originalTask.id,
                type: "0"
              });
            } catch (e) {
              console.error("Error adding predecessor link", e);
            }
          }
        }

        originalTask.text = this.editingTask.text;
        originalTask['status'] = this.editingTask.status || 'To Do';
        
        const status = (this.editingTask.status || '').trim().toLowerCase();
        const isUnstarted = status === 'not started' || status === 'to do' || status === 'todo' || status === 'planned';

        if (isUnstarted) {
          originalTask.unscheduled = false;
          originalTask.progress = 0;
          
          originalTask['Actual_start_date'] = "";
          originalTask['Actual_end_date'] = "";
          originalTask['Actual_duration'] = 0;
          
          originalTask['planned_start_date'] = this.editingTask.planned_start_date;
          originalTask['planned_end_date'] = this.editingTask.planned_end_date;
          originalTask['Planned_duration'] = this.editingTask.Planned_duration;
          
          const parsedStart = this.parseDate(this.editingTask.planned_start_date);
          const parsedEnd = this.parseDate(this.editingTask.planned_end_date);
          if (parsedStart && parsedEnd) {
            originalTask.start_date = parsedStart;
            originalTask.end_date = parsedEnd;
            originalTask.duration = this.editingTask.Planned_duration;
          }
          
          if (originalTask.type !== 'project' && originalTask.type !== 'milestone') {
            originalTask['Actual_crew'] = 0;
            originalTask['Actual_cost'] = 0;
            originalTask['Planned_crew'] = this.editingTask.Planned_crew;
            originalTask['Planned_cost'] = this.editingTask.Planned_cost;
            originalTask['actual_crew'] = 0;
            originalTask['actual_cost'] = 0;
            originalTask['planned_crew'] = this.editingTask.Planned_crew;
            originalTask['planned_cost'] = this.editingTask.Planned_cost;
          }
        } else {
          originalTask.unscheduled = false;
          originalTask.progress = this.editingTask.progressPercent / 100;
          
          originalTask['Actual_start_date'] = this.editingTask.Actual_start_date;
          originalTask['Actual_end_date'] = this.editingTask.Actual_end_date;
          originalTask['Actual_duration'] = this.editingTask.Actual_duration;
          
          originalTask['planned_start_date'] = this.editingTask.planned_start_date;
          originalTask['planned_end_date'] = this.editingTask.planned_end_date;
          originalTask['Planned_duration'] = this.editingTask.Planned_duration;
          
          const parsedStart = this.parseDate(this.editingTask.Actual_start_date);
          const parsedEnd = this.parseDate(this.editingTask.Actual_end_date);
          if (parsedStart && parsedEnd) {
            originalTask.start_date = parsedStart;
            originalTask.end_date = parsedEnd;
            originalTask.duration = this.editingTask.Actual_duration;
          }
          
          if (originalTask.type !== 'project' && originalTask.type !== 'milestone') {
            originalTask['Actual_crew'] = this.editingTask.Actual_crew;
            originalTask['Actual_cost'] = this.editingTask.Actual_cost;
            originalTask['Planned_crew'] = this.editingTask.Planned_crew;
            originalTask['Planned_cost'] = this.editingTask.Planned_cost;
            originalTask['actual_crew'] = this.editingTask.Actual_crew;
            originalTask['actual_cost'] = this.editingTask.Actual_cost;
            originalTask['planned_crew'] = this.editingTask.Planned_crew;
            originalTask['planned_cost'] = this.editingTask.Planned_cost;
          }
        }

        gantt.updateTask(originalTask.id);
        this.recalculateProgressAndRender();
      }
      
      this.isModalOpen = false;
      this.editingTask = null;
      this.cdr.detectChanges();
    });
  }

  onActualDateOrDurationChange() {
    const start = this.parseDate(this.editingTask.Actual_start_date);
    const duration = parseInt(this.editingTask.Actual_duration, 10);
    if (start && !isNaN(duration)) {
      const end = gantt.calculateEndDate({ start_date: start, duration: duration, task: this.editingTask });
      this.editingTask.Actual_end_date = this.formatDate(end);
      this.recalculateActualCost();
    }
    this.checkPredecessorConstraintInModal();
  }

  onActualDateChange() {
    const start = this.parseDate(this.editingTask.Actual_start_date);
    const end = this.parseDate(this.editingTask.Actual_end_date);
    if (start && end) {
      const duration = gantt.calculateDuration({ start_date: start, end_date: end, task: this.editingTask });
      this.editingTask.Actual_duration = duration;
      this.recalculateActualCost();
    }
    this.checkPredecessorConstraintInModal();
  }

  onActualCrewChange() {
    this.recalculateActualCost();
  }

  recalculateActualCost() {
    if (this.editingTask.type !== 'project' && this.editingTask.type !== 'milestone') {
      const hasChildren = gantt.getChildren(this.editingTask.id).length > 0;
      if (hasChildren) {
        const children = gantt.getChildren(this.editingTask.id);
        let total = 0;
        children.forEach((cId) => {
          const child = gantt.getTask(cId);
          if (child) {
            total += parseFloat(child['Actual_cost']) || parseFloat(child['actual_cost']) || 0;
          }
        });
        this.editingTask.Actual_cost = total;
      } else {
        const crew = parseInt(this.editingTask.Actual_crew, 10) || 1;
        const duration = parseInt(this.editingTask.Actual_duration, 10) || 1;
        this.editingTask.Actual_cost = crew * duration * 800;
      }
    }
  }

  onPlannedDateOrDurationChange() {
    const start = this.parseDate(this.editingTask.planned_start_date);
    const duration = parseInt(this.editingTask.Planned_duration, 10);
    if (start && !isNaN(duration)) {
      const end = gantt.calculateEndDate({ start_date: start, duration: duration, task: this.editingTask });
      this.editingTask.planned_end_date = this.formatDate(end);
      this.recalculatePlannedCost();
    }
  }

  onPlannedDateChange() {
    const start = this.parseDate(this.editingTask.planned_start_date);
    const end = this.parseDate(this.editingTask.planned_end_date);
    if (start && end) {
      const duration = gantt.calculateDuration({ start_date: start, end_date: end, task: this.editingTask });
      this.editingTask.Planned_duration = duration;
      this.recalculatePlannedCost();
    }
  }

  onPlannedCrewChange() {
    this.recalculatePlannedCost();
  }

  recalculatePlannedCost() {
    if (this.editingTask.type !== 'project' && this.editingTask.type !== 'milestone') {
      const hasChildren = gantt.getChildren(this.editingTask.id).length > 0;
      if (hasChildren) {
        const children = gantt.getChildren(this.editingTask.id);
        let total = 0;
        children.forEach((cId) => {
          const child = gantt.getTask(cId);
          if (child) {
            total += parseFloat(child['Planned_cost']) || parseFloat(child['planned_cost']) || 0;
          }
        });
        this.editingTask.Planned_cost = total;
      } else {
        const crew = parseInt(this.editingTask.Planned_crew, 10) || 1;
        const duration = parseInt(this.editingTask.Planned_duration, 10) || 1;
        this.editingTask.Planned_cost = crew * duration * 800;
      }
    }
  }

  onStatusChange() {
    const status = (this.editingTask?.status || '').trim().toLowerCase();
    const isUnstarted = status === 'not started' || status === 'to do' || status === 'todo' || status === 'planned';
    
    if (this.editingTask && isUnstarted) {
      this.editingTask.Actual_start_date = "";
      this.editingTask.Actual_end_date = "";
      this.editingTask.Actual_duration = 0;
      this.editingTask.progressPercent = 0;
      this.editingTask.Actual_crew = 0;
      this.editingTask.Actual_cost = 0;
    }

    this.checkPredecessorConstraintInModal();
  }

  onPredecessorChange() {
    this.checkPredecessorConstraintInModal();
  }

  onProgressChange() {
    this.checkPredecessorConstraintInModal();
  }

  checkPredecessorConstraintInModal() {
    if (!this.editingTask) return;
    const pred = this.getSelectedPredecessor();
    if (pred && !this.isPredecessorCompleted(pred)) {
      if (this.isTaskStarted(this.editingTask)) {
        this.activeErrors = [
          `${GANTT_ERRORS.ERR_011.code}: Predecessor Constraint: Task/subtask "${this.editingTask.text}" cannot be started because its predecessor "${pred.text}" is not in Completed status (Current predecessor status: ${pred.status || 'Not Started'}).`
        ];
        return;
      }
    }

    // Check parent task predecessor if editing a subtask
    const rootId = gantt.config.root_id;
    if (this.editingTask.parent && this.editingTask.parent !== rootId && this.isTaskStarted(this.editingTask)) {
      try {
        const parentTask = gantt.getTask(this.editingTask.parent);
        if (parentTask && parentTask.type !== 'project') {
          const parentPreds = this.getPredecessors(parentTask);
          for (const pPred of parentPreds) {
            if (!this.isPredecessorCompleted(pPred)) {
              this.activeErrors = [
                `${GANTT_ERRORS.ERR_011.code}: Predecessor Constraint: Subtask "${this.editingTask.text}" cannot be started because parent task "${parentTask.text}" has predecessor "${pPred.text}" that is not in Completed status (Current status: ${pPred.status || 'Not Started'}).`
              ];
              return;
            }
          }
        }
      } catch (e) {}
    }

    this.activeErrors = [];
  }

  getPredecessors(task: any): any[] {
    if (!task) return [];
    const predTasks: any[] = [];
    const targetLinkIds = task.$target || [];
    targetLinkIds.forEach((linkId: string | number) => {
      try {
        const link = gantt.getLink(linkId);
        if (link && link.source) {
          const sourceTask = gantt.getTask(link.source);
          if (sourceTask) {
            predTasks.push(sourceTask);
          }
        }
      } catch (e) {}
    });

    if (predTasks.length === 0 && task.predecessor_ids && Array.isArray(task.predecessor_ids)) {
      task.predecessor_ids.forEach((sId: any) => {
        try {
          const sourceTask = gantt.getTask(sId);
          if (sourceTask) predTasks.push(sourceTask);
        } catch (e) {}
      });
    }

    return predTasks;
  }

  getPredecessorDisplay(task: any): string {
    const preds = this.getPredecessors(task);
    if (preds.length === 0) return "";
    return preds.map(p => p.text).join(", ");
  }

  isTaskDependentOn(potentialPredId: string | number, currentTaskId: string | number): boolean {
    const visited = new Set<string>();
    const queue = [String(potentialPredId)];
    while (queue.length > 0) {
      const currId = queue.shift()!;
      if (currId === String(currentTaskId)) return true;
      if (visited.has(currId)) continue;
      visited.add(currId);
      try {
        const t = gantt.getTask(currId);
        if (t && t.$target) {
          t.$target.forEach((lId: any) => {
            const link = gantt.getLink(lId);
            if (link && link.source) {
              queue.push(String(link.source));
            }
          });
        }
      } catch (e) {}
    }
    return false;
  }

  getSelectedPredecessor(): any | null {
    if (!this.editingTask || !this.editingTask.selectedPredecessorId) return null;
    try {
      return gantt.getTask(this.editingTask.selectedPredecessorId);
    } catch (e) {
      return null;
    }
  }

  isPredecessorCompleted(predTask: any): boolean {
    if (!predTask) return true;
    const status = (predTask.status || '').trim().toLowerCase();
    const progress = predTask.progressPercent !== undefined ? predTask.progressPercent : Math.round((predTask.progress || 0) * 100);

    // If predecessor has children (it is a parent task), all of its children must be completed as well
    const childIds = gantt.getChildren ? gantt.getChildren(predTask.id) : [];
    if (childIds && childIds.length > 0) {
      const allChildrenCompleted = childIds.every((cId: any) => {
        try {
          const child: any = gantt.getTask(cId);
          const childStatus = (child['status'] || '').trim().toLowerCase();
          const childProgress = child['progressPercent'] !== undefined ? child['progressPercent'] : Math.round((child.progress || 0) * 100);
          return childStatus === 'completed' || childProgress >= 100;
        } catch (e) {
          return true;
        }
      });
      if (!allChildrenCompleted) return false;
    }

    return status === 'completed' || progress >= 100;
  }

  isTaskStarted(task: any): boolean {
    if (!task) return false;
    const status = (task.status || '').trim().toLowerCase();
    const isUnstartedStatus = 
      status === 'not started' || 
      status === 'to do' || 
      status === 'todo' || 
      status === 'planned' || 
      status === '';

    const progress = task.progressPercent !== undefined 
      ? task.progressPercent 
      : Math.round((task.progress || 0) * 100);

    if (progress > 0) {
      return true;
    }

    if (isUnstartedStatus) {
      return false;
    }

    return true;
  }

  isPredecessorStarted(predTask: any): boolean {
    if (!predTask) return true;
    const status = (predTask.status || '').toLowerCase();
    if (status === 'not started' || status === 'to do' || status === 'todo' || status === '') {
      return false;
    }
    return true;
  }

  clearPredecessor() {
    if (this.editingTask) {
      this.editingTask.selectedPredecessorId = "";
      this.onPredecessorChange();
    }
  }

  removePredecessor(taskId: string | number, predId?: string | number) {
    this.ngZone.run(() => {
      const task = gantt.getTask(taskId);
      if (!task) return;
      const targetLinks = [...(task.$target || [])];
      if (targetLinks.length === 0) return;

      targetLinks.forEach((linkId: string | number) => {
        try {
          const link = gantt.getLink(linkId);
          if (!predId || (link && String(link.source) === String(predId))) {
            gantt.deleteLink(linkId);
          }
        } catch (e) {
          console.error("Error deleting link", e);
        }
      });

      gantt.updateTask(task.id);
      this.recalculateProgressAndRender();
      this.cdr.detectChanges();
    });
  }

  recalculateProgressAndRender() {
    const rootId = gantt.config.root_id;
    const rootTasks = gantt.getChildren(rootId).map(id => gantt.getTask(id));
    
    rootTasks.forEach(rootTask => {
      if (rootTask.type === 'project') {
        const tasks = gantt.getChildren(rootTask.id).map(id => gantt.getTask(id));
        let totalTaskProgress = 0;
        let taskCount = 0;

        tasks.forEach(task => {
          const subtasks = gantt.getChildren(task.id).map(id => gantt.getTask(id));
          if (subtasks.length > 0) {
            const totalSubProgress = subtasks.reduce((sum, s) => sum + (s.progress || 0), 0);
            task.progress = totalSubProgress / subtasks.length;
            gantt.refreshTask(task.id);
          }
          totalTaskProgress += task.progress || 0;
          taskCount++;
        });

        if (taskCount > 0) {
          rootTask.progress = totalTaskProgress / taskCount;
          gantt.refreshTask(rootTask.id);
        }
      }
    });
    gantt.render();
  }

  deleteTask() {
    if (!this.editingTask) return;
    
    const taskName = this.editingTask.text || 'this task';
    const isParent = gantt.getChildren(this.editingTask.id).length > 0;
    
    let warningMsg = `Are you sure you want to delete "${taskName}"?`;
    if (isParent) {
      warningMsg += `\n\nWARNING: This will also delete all of its subtasks and recalculate parent dates and costs.`;
    } else {
      warningMsg += `\n\nThis will recalculate the parent task's dates and costs.`;
    }
    
    if (confirm(warningMsg)) {
      const taskId = this.editingTask.id;
      this.closeModal();
      gantt.deleteTask(taskId);
    }
  }

  showValidationErrorModal(errors: string[]) {
    this.ngZone.run(() => {
      this.validationErrors = errors;
      this.isValidationErrorModalOpen = true;
      this.cdr.detectChanges();
    });
  }

  closeValidationErrorModal() {
    this.ngZone.run(() => {
      this.isValidationErrorModalOpen = false;
      this.validationErrors = [];
      this.cdr.detectChanges();
    });
  }
}
