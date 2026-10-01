import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from '../storage.service';
import { ProgressStats, MotivationMessage, formatDuration, WeeklyProgress, DailyProgress } from '../models/video-note.model';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit {
  currentYear: number = 0;
  currentMonth: number = 0;
  currentMonthName: string = '';
  todayDate: string = '';
  yesterdayDate: string = '';
  weekRange: string = '';
  
  progressStats: ProgressStats | null = null;
  motivationMessages: MotivationMessage[] = [];
  activeMessageIndex: number = 0;

  // Circle progress for today
  circleProgress: number = 283; // 2 * π * 45
  circleOffset: number = 283;

  private monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
  
  private dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(private router: Router, private storage: StorageService) {}

  ngOnInit(): void {
    this.loadInitialData();
    this.loadProgressStats();
    
    // Auto-refresh progress every 30 seconds
    setInterval(() => this.loadProgressStats(), 30000);
  }

  private loadInitialData(): void {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth() + 1;
    this.currentMonthName = this.monthNames[now.getMonth()];
    
    this.todayDate = this.formatDate(now);
    this.yesterdayDate = this.formatDate(new Date(now.setDate(now.getDate() - 1)));
    
    // Set week range
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    this.weekRange = `${this.formatDate(weekStart).split(',')[0]} - ${this.formatDate(weekEnd).split(',')[0]}`;
  }

  private loadProgressStats(): void {
    this.progressStats = this.storage.getProgressStats();
    this.motivationMessages = this.storage.getMotivationMessages();
    this.activeMessageIndex = 0;
    
    // Update circle progress for today
    this.updateCircleProgress();
  }

  private formatDate(date: Date): string {
    const day = date.getDate();
    const monthName = this.monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    // Add ordinal suffix to day
    const suffix = this.getOrdinalSuffix(day);
    return `${monthName} ${day}${suffix}, ${year}`;
  }

  private getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  private updateCircleProgress(): void {
    const todayTime = this.progressStats?.today.totalTimeWatched || 0;
    const target = 7200; // 2 hours = 7200 seconds
    const progress = Math.min((todayTime / target) * 100, 100);
    
    // Calculate dash offset for circle
    // Circumference = 2 * π * r = 2 * π * 45 ≈ 283
    const offset = 283 - (283 * progress) / 100;
    this.circleOffset = offset;
  }

  getDayHeight(seconds: number): number {
    const maxTime = Math.max(
      ...(this.progressStats?.thisWeek.dailyBreakdown.map(d => d.totalTimeWatched) || [7200]),
      7200
    );
    return (seconds / maxTime) * 100;
  }

  getMessageTypeLabel(type: string): string {
    switch (type) {
      case 'achievement': return 'Achievement';
      case 'encouragement': return 'Encouragement';
      case 'tip': return 'Tip';
      case 'milestone': return 'Milestone';
      default: return '';
    }
  }

  formatDuration(seconds: number): string {
    return formatDuration(seconds);
  }

  nextMessage(): void {
    if (this.activeMessageIndex < this.motivationMessages.length - 1) {
      this.activeMessageIndex++;
    }
  }

  prevMessage(): void {
    if (this.activeMessageIndex > 0) {
      this.activeMessageIndex--;
    }
  }

  refreshProgress(): void {
    this.loadProgressStats();
  }

  navigateToCurrentYear(): void {
    const year = new Date().getFullYear();
    this.router.navigate(['/year', year]);
  }

  navigateToCurrentMonth(): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    this.router.navigate(['/year', year, 'month', month]);
  }

  navigateToToday(): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    this.router.navigate(['/year', year, 'month', month, 'day', day]);
  }

  navigateToYesterday(): void {
    const now = new Date();
    const yesterday = new Date(now.setDate(now.getDate() - 1));
    const year = yesterday.getFullYear();
    const month = yesterday.getMonth() + 1;
    const day = yesterday.getDate();
    this.router.navigate(['/year', year, 'month', month, 'day', day]);
  }
}