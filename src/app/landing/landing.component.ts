import { Component, AfterViewInit, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface Step {
  title: string;
  text: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements AfterViewInit {
  /** Elements that fade in as they scroll into view. */
  @ViewChildren('reveal', { read: ElementRef }) revealEls!: QueryList<ElementRef>;

  steps: Step[] = [
    {
      title: 'Run one command',
      text: 'npm install, then npm start — the app and its local data server open together.'
    },
    {
      title: 'Add your videos',
      text: 'Paste a YouTube URL, write notes, and save the position you are at.'
    },
    {
      title: 'Watch your journey grow',
      text: 'Progress rings, weekly charts, and a most-watched leaderboard build themselves.'
    }
  ];

  themeSwatches: string[] = [
    '#1a73e8', '#8ab4f8', '#5fa8d3', '#66bb8a',
    '#d4a24c', '#88c0d0', '#0277bd', '#e8590c',
    '#d6336c', '#7c3aed', '#546e7a', '#8d6e63'
  ];

  /** Hero mock 3D tilt, driven by pointer position. */
  tiltX = 0;
  tiltY = 0;

  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.revealEls.forEach(el => el.nativeElement.classList.add('in-view'));
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' }
    );
    this.revealEls.forEach(el => observer.observe(el.nativeElement));
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  scrollToFeatures(): void {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  }

  onMockMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    this.tiltY = px * 6;
    this.tiltX = -py * 4;
  }

  resetTilt(): void {
    this.tiltX = 0;
    this.tiltY = 0;
  }
}
