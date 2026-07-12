import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Chart, registerables } from 'chart.js/auto';

Chart.register(...registerables);

@Component({
  selector: 'app-project-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './project-dashboard.html',
  styleUrl: './project-dashboard.scss'
})
export class ProjectDashboard implements OnInit, AfterViewInit {
  projects = ['Vessel MV-Alpha Dry-docking', 'ShipGuard-01 Engine Overhaul', 'Poseidon Retrofit'];
  selectedProject = this.projects[0];

  // Canvas references for charts
  @ViewChild('projectSummaryChart') projectSummaryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('riskStatusChart') riskStatusChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('taskCategoryChart') taskCategoryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('budgetRatioChart') budgetRatioChartRef!: ElementRef<HTMLCanvasElement>;

  charts: Chart[] = [];

  // Mock Data store
  projectData: any = {
    'Vessel MV-Alpha Dry-docking': {
      kpi: {
        budgetUsed: 4330,
        budgetPlanned: 8800,
        budgetAllocated: 8000,
        get budgetRemaining() { return this.budgetAllocated - this.budgetUsed; },
        tasksCompleted: 15,
        tasksPending: 10,
        milestones: 5,
        totalHours: 150,
        plannedHours: 182,
        teamSize: 7
      },
      risks: { low: 16, medium: 19, high: 5 },
      tasks: [
        { name: 'Hull Cleaning', status: 'Completed', priority: 'High', complexity: 'Level 2', hours: 45 },
        { name: 'Propeller Inspection', status: 'In-Process', priority: 'Medium', complexity: 'Level 3', hours: 25 },
        { name: 'Engine Overhaul Prep', status: 'Open', priority: 'High', complexity: 'Level 1', hours: 0 },
        { name: 'Deck Painting', status: 'Hold', priority: 'Low', complexity: 'Level 1', hours: 10 },
        { name: 'Valve Replacements', status: 'Completed', priority: 'High', complexity: 'Level 2', hours: 30 },
        { name: 'Navigation Systems Test', status: 'In-Process', priority: 'Low', complexity: 'Level 3', hours: 40 }
      ]
    },
    'ShipGuard-01 Engine Overhaul': {
      kpi: {
        budgetUsed: 12500,
        budgetPlanned: 15000,
        budgetAllocated: 14000,
        get budgetRemaining() { return this.budgetAllocated - this.budgetUsed; },
        tasksCompleted: 45,
        tasksPending: 5,
        milestones: 8,
        totalHours: 350,
        plannedHours: 400,
        teamSize: 12
      },
      risks: { low: 5, medium: 8, high: 2 },
      tasks: [
        { name: 'Main Engine Disassembly', status: 'Completed', priority: 'High', complexity: 'Level 3', hours: 120 },
        { name: 'Cylinder Honing', status: 'In-Process', priority: 'High', complexity: 'Level 3', hours: 60 },
        { name: 'Piston Ring Replacement', status: 'Open', priority: 'Medium', complexity: 'Level 2', hours: 0 }
      ]
    },
    'Poseidon Retrofit': {
      kpi: {
        budgetUsed: 2000,
        budgetPlanned: 50000,
        budgetAllocated: 45000,
        get budgetRemaining() { return this.budgetAllocated - this.budgetUsed; },
        tasksCompleted: 2,
        tasksPending: 38,
        milestones: 12,
        totalHours: 40,
        plannedHours: 1200,
        teamSize: 5
      },
      risks: { low: 25, medium: 15, high: 10 },
      tasks: [
        { name: 'Site Survey', status: 'Completed', priority: 'Medium', complexity: 'Level 1', hours: 40 },
        { name: 'Material Procurement', status: 'In-Process', priority: 'High', complexity: 'Level 2', hours: 0 }
      ]
    }
  };

  currentData: any;
  currentViewMode: string = 'Month';

  changeViewMode(mode: string) {
    this.currentViewMode = mode;
    this.destroyCharts();
    this.renderCharts();
  }

  ngOnInit() {
    this.currentData = this.projectData[this.selectedProject];
  }

  ngAfterViewInit() {
    this.renderCharts();
  }

  onProjectChange() {
    this.currentData = this.projectData[this.selectedProject];
    this.destroyCharts();
    this.renderCharts();
  }

  destroyCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  renderCharts() {
    // 1. Project Summary Donut (Task Status)
    const taskStatusCounts = { Open: 0, 'In-Process': 0, Hold: 0, Cancelled: 0, Completed: 0 };
    this.currentData.tasks.forEach((t: any) => {
      if (taskStatusCounts[t.status as keyof typeof taskStatusCounts] !== undefined) {
        taskStatusCounts[t.status as keyof typeof taskStatusCounts]++;
      }
    });

    const summaryCtx = this.projectSummaryChartRef.nativeElement.getContext('2d');
    if (summaryCtx) {
      this.charts.push(new Chart(summaryCtx, {
        type: 'doughnut',
        data: {
          labels: ['Open', 'In-Process', 'Hold', 'Completed'],
          datasets: [{
            data: [taskStatusCounts['Open'], taskStatusCounts['In-Process'], taskStatusCounts['Hold'], taskStatusCounts['Completed']],
            backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#10b981'],
            borderWidth: 0
          }]
        },
        options: { cutout: '70%', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
      }));
    }

    // 2. Risk Status Donut
    const riskCtx = this.riskStatusChartRef.nativeElement.getContext('2d');
    if (riskCtx) {
      this.charts.push(new Chart(riskCtx, {
        type: 'doughnut',
        data: {
          labels: ['Low', 'Medium', 'High'],
          datasets: [{
            data: [this.currentData.risks.low, this.currentData.risks.medium, this.currentData.risks.high],
            backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: { cutout: '70%', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
      }));
    }

    // 3. Category Wise Task Status Bar
    const categoryCtx = this.taskCategoryChartRef.nativeElement.getContext('2d');
    if (categoryCtx) {
      this.charts.push(new Chart(categoryCtx, {
        type: 'bar',
        data: {
          labels: ['Open', 'In-Process', 'Hold', 'Completed'],
          datasets: [{
            label: 'Tasks',
            data: [taskStatusCounts['Open'], taskStatusCounts['In-Process'], taskStatusCounts['Hold'], taskStatusCounts['Completed']],
            backgroundColor: '#4ade80',
            borderRadius: 4
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      }));
    }

    // 4. Budget vs Expense Progress (Horizontal Bar)
    const budgetCtx = this.budgetRatioChartRef.nativeElement.getContext('2d');
    if (budgetCtx) {
      this.charts.push(new Chart(budgetCtx, {
        type: 'bar',
        data: {
          labels: ['Budget'],
          datasets: [
            { label: 'Used', data: [this.currentData.kpi.budgetUsed], backgroundColor: '#ef4444' },
            { label: 'Remaining', data: [this.currentData.kpi.budgetRemaining], backgroundColor: '#e5e7eb' }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: true, display: false }, y: { stacked: true, display: false } },
          plugins: { legend: { display: false } }
        }
      }));
    }
  }

  getBudgetRatio(): number {
    return Math.round((this.currentData.kpi.budgetUsed / this.currentData.kpi.budgetAllocated) * 100);
  }
}
