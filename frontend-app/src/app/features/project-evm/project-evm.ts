import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Chart, registerables } from 'chart.js/auto';
import { AiService } from '../../core/services/ai.service';

Chart.register(...registerables);

@Component({
  selector: 'app-project-evm',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './project-evm.html',
  styleUrl: './project-evm.scss'
})
export class ProjectEvm implements OnInit, AfterViewInit, OnDestroy {
  aiService = inject(AiService);

  projects: any[] = [];
  selectedProject: any = null;

  isLoading: boolean = false;

  @ViewChild('evmChart') evmChartRef!: ElementRef<HTMLCanvasElement>;
  chart: Chart | null = null;
  private themeObserver: MutationObserver | null = null;

  evmData: any = null;
  currentData: any = null;
  currentViewMode: string = 'Weekly';
  metrics: any = null;
  aiAnalysis: any = null;

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

  changeViewMode(mode: string) {
    this.currentViewMode = mode;
    if (this.evmData) {
      this.currentData = this.evmData[this.currentViewMode];
      this.renderChart();
    }
  }

  ngOnInit() {
    this.loadProjects();
    
    // Watch for theme changes to re-render the chart with correct colors
    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          this.renderChart();
        }
      });
    });
    this.themeObserver.observe(document.body, { attributes: true });
  }

  loadProjects() {
    this.aiService.getProjects().subscribe({
      next: (res) => {
        this.projects = res;
        if (this.projects.length > 0) {
          this.selectedProject = this.projects[0];
          this.loadEvmData();
        }
      },
      error: (err) => console.error("Error loading projects", err)
    });
  }

  loadEvmData() {
    if (!this.selectedProject) return;
    this.isLoading = true;
    this.currentData = null;
    this.metrics = null;
    this.aiAnalysis = null;
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    
    this.aiService.getProjectEvmData(this.selectedProject.project_id).subscribe({
      next: (res) => {
        this.evmData = res;
        this.currentData = this.evmData[this.currentViewMode];
        this.metrics = this.evmData.metrics;
        this.aiAnalysis = this.evmData.ai_analysis;
        this.isLoading = false;
        // Need to wait for DOM to render the canvas element before chart initialization
        setTimeout(() => {
          this.renderChart();
        }, 150);
      },
      error: (err) => {
        console.error("Error loading EVM data", err);
        this.currentData = null;
        this.metrics = null;
        this.aiAnalysis = null;
        this.isLoading = false;
        if (this.chart) {
          this.chart.destroy();
          this.chart = null;
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
    if (this.chart) {
      this.chart.destroy();
    }
  }

  ngAfterViewInit() {
    if (this.currentData) {
      this.renderChart();
    }
  }

  onProjectChange() {
    this.loadEvmData();
  }

  renderChart() {
    if (this.chart) {
      this.chart.destroy();
    }
    if (!this.currentData || !this.currentData.labels) {
      return;
    }

    const ctx = this.evmChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#4b5563';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.currentData.labels,
        datasets: [
          {
            label: 'Budgeted Cost',
            data: this.currentData.budgeted_cost,
            borderColor: '#3b82f6', // blue
            backgroundColor: '#3b82f6',
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8
          },
          {
            label: 'Actual Cost',
            data: this.currentData.actual_cost,
            borderColor: '#f59e0b', // amber
            backgroundColor: '#f59e0b',
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8
          },
          {
            label: 'Predicted Cost',
            data: this.currentData.predicted_cost,
            borderColor: this.currentData.trend_color === 'red' ? '#ef4444' : '#10b981', // red or green
            backgroundColor: this.currentData.trend_color === 'red' ? '#ef4444' : '#10b981',
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              font: {
                family: "'Inter', sans-serif",
                size: 14
              },
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            titleColor: isDark ? '#fff' : '#1e293b',
            bodyColor: isDark ? '#cbd5e1' : '#475569',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context: any) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  const symbol = this.getCurrencySymbol();
                  label += symbol + context.parsed.y.toLocaleString();
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Inter', sans-serif"
              }
            }
          },
          y: {
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Inter', sans-serif"
              },
              callback: (value: any) => {
                const symbol = this.getCurrencySymbol();
                return symbol + value;
              }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
  }
}
