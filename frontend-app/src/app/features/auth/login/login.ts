import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  constructor(private http: HttpClient, private router: Router) {}

  onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.http.post('http://localhost:8000/api/auth/login', {
      email: this.email,
      password: this.password
    }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        // Optionally store the user ID or token here
        localStorage.setItem('employee_id', res.employee_id);
        localStorage.setItem('employee_name', res.employee_name);
        localStorage.setItem('email', res.email);
        localStorage.setItem('designation', res.designation || '');
        localStorage.setItem('permissions', res.permissions || '');
        // Navigate to input
        this.router.navigate(['/input']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || 'Invalid email or password. Please try again.';
      }
    });
  }
}
