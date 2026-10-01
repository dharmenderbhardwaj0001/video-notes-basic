import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../storage.service';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-year',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './year.component.html',
  styleUrls: ['./year.component.scss']
})
export class YearComponent implements OnInit {
  year: number = 0;
  months: number[] = [];
  yearStats: any = null;

  private monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.year = parseInt(params['year']);
      this.loadMonths();
      this.loadYearStats();
    });
  }

  private loadMonths(): void {
    // Always show all 12 months
    this.months = Array.from({length: 12}, (_, i) => i + 1);
  }

  private loadYearStats(): void {
    const allMonths = this.storage.getAllMonthsForYear(this.year);
    let totalVideos = 0;
    let totalNotes = 0;
    let activeMonths = 0;
    let activeDays = 0;

    allMonths.forEach(month => {
      const allDays = this.storage.getAllDaysForMonth(this.year, month);
      if (allDays.length > 0) {
        activeMonths++;
        activeDays += allDays.length;
      }
      
      allDays.forEach(day => {
        const dayVideos = this.storage.getVideoNotesForDay(this.year, month, day);
        totalVideos += dayVideos.length;
        totalNotes += dayVideos.filter(v => v.notes && v.notes.trim().length > 0).length;
      });
    });

    this.yearStats = {
      totalVideos,
      totalNotes,
      activeMonths,
      activeDays
    };
  }

  getMonthName(month: number): string {
    return this.monthNames[month - 1];
  }

  hasDataForMonth(month: number): boolean {
    const days = this.storage.getAllDaysForMonth(this.year, month);
    return days.length > 0;
  }

  getMonthStats(month: number): string {
    const days = this.storage.getAllDaysForMonth(this.year, month);
    if (days.length === 0) return 'No data';
    
    const videos = days.reduce((total, day) => {
      const dayVideos = this.storage.getVideoNotesForDay(this.year, month, day);
      return total + dayVideos.length;
    }, 0);
    
    return `${days.length} days • ${videos} videos`;
  }

  navigateToMonth(month: number): void {
    this.router.navigate(['/year', this.year, 'month', month]);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}