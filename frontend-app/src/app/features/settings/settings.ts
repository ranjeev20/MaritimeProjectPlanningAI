import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, MatIconModule, MatButtonModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss']
})
export class SettingsComponent implements OnInit {
  isDarkMode = signal(false);
  activeTab = 'profile'; // 'profile' | 'appearance' | 'admin'
  
  // User details
  employee_id = '';
  employee_name = '';
  email = '';
  designation = '';
  permissions = '';
  
  // Admin User Management State
  adminSubTab = 'add'; // 'add' | 'update' | 'remove'
  allUsers: any[] = [];
  selectedUserToUpdate: any = null;
  selectedUserToDelete: any = null;
  
  updatePayload: any = {};
  
  // New User Form
  newUser = {
    employee_id: '',
    employee_name: '',
    designation: '',
    permissions: '',
    email: '',
    password: 'password123' // default password
  };
  
  isProjectManager = false;
  successMessage = '';
  errorMessage = '';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.employee_id = localStorage.getItem('employee_id') || '';
    this.employee_name = localStorage.getItem('employee_name') || '';
    this.email = localStorage.getItem('email') || '';
    this.designation = localStorage.getItem('designation') || '';
    this.permissions = localStorage.getItem('permissions') || '';
    
    this.isProjectManager = this.designation === 'Project Manager';
    if (this.isProjectManager) {
      this.loadUsers();
    }
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.isDarkMode.set(true);
    }
  }

  toggleTheme() {
    this.isDarkMode.set(!this.isDarkMode());
    if (this.isDarkMode()) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }
  
  addUser() {
    this.successMessage = '';
    this.errorMessage = '';
    
    if (!this.newUser.employee_id || !this.newUser.employee_name || !this.newUser.email) {
      this.errorMessage = 'Please fill out all required fields.';
      return;
    }
    
    this.http.post('http://localhost:8000/api/users/?requester_id=' + this.employee_id, this.newUser).subscribe({
      next: () => {
        this.successMessage = 'User successfully created!';
        this.newUser = {
          employee_id: '',
          employee_name: '',
          designation: '',
          permissions: '',
          email: '',
          password: 'password123'
        };
        this.loadUsers(); // Refresh the list
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Failed to create user.';
      }
    });
  }

  loadUsers() {
    this.http.get<any[]>('http://localhost:8000/api/users/?requester_id=' + this.employee_id).subscribe({
      next: (data) => {
        this.allUsers = data;
      },
      error: (err) => console.error("Failed to load users", err)
    });
  }

  selectUserForUpdate(user: any) {
    this.selectedUserToUpdate = user;
    this.updatePayload = {
      employee_name: user.employee_name,
      designation: user.designation,
      permissions: user.permissions,
      email: user.email
    };
    this.successMessage = '';
    this.errorMessage = '';
  }

  updateUser() {
    this.successMessage = '';
    this.errorMessage = '';
    
    if (!this.selectedUserToUpdate) return;
    
    this.http.put(`http://localhost:8000/api/users/${this.selectedUserToUpdate.employee_id}?requester_id=${this.employee_id}`, this.updatePayload).subscribe({
      next: () => {
        this.successMessage = 'User successfully updated!';
        this.loadUsers();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Failed to update user.';
      }
    });
  }

  selectUserForDelete(user: any) {
    this.selectedUserToDelete = user;
    this.successMessage = '';
    this.errorMessage = '';
  }

  deleteUser() {
    this.successMessage = '';
    this.errorMessage = '';
    
    if (!this.selectedUserToDelete) return;
    
    this.http.delete(`http://localhost:8000/api/users/${this.selectedUserToDelete.employee_id}?requester_id=${this.employee_id}`).subscribe({
      next: () => {
        this.successMessage = 'User successfully deleted!';
        this.selectedUserToDelete = null;
        this.loadUsers();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Failed to delete user.';
      }
    });
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
