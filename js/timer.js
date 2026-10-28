import { audio } from './audio.js';

/* ==========================================================================
   DO OR DIE — Timer & Countdown System (Phase 11, 12, 13)
   ========================================================================== */

export class TimerSystem {
  constructor(config = {}) {
    this.baseSeconds = config.baseSeconds || 140; // 140 seconds (02:20) for Hospital Floor 3 (increased by 1 min)
    this.currentSeconds = this.baseSeconds;
    this.bonusSeconds = 0;
    this.isRunning = false;
    this.isUrgent = false;

    // Callbacks
    this.onTick = config.onTick || null;
    this.onUrgent = config.onUrgent || null;
    this.onTimeUp = config.onTimeUp || null;

    // DOM Elements
    this.timerBadge = document.getElementById('hud-timer');
    this.timerDisplay = document.getElementById('timer-display');
    this.vignette = document.getElementById('vignette-overlay');

    // Warning heartbeat timing
    this.warningBeepTimer = 0;

    this.render();
  }

  start(seconds = null) {
    if (seconds !== null) {
      this.currentSeconds = seconds;
    }
    this.isRunning = true;
    this.isUrgent = false;
    this.render();
  }

  pause() {
    this.isRunning = false;
  }

  resume() {
    if (this.currentSeconds > 0) {
      this.isRunning = true;
    }
  }

  stop() {
    this.isRunning = false;
    if (this.timerBadge) this.timerBadge.classList.remove('urgent');
    if (this.vignette) this.vignette.classList.remove('active');
  }

  reset(seconds = null) {
    this.stop();
    this.currentSeconds = seconds !== null ? seconds : this.baseSeconds;
    this.bonusSeconds = 0;
    this.isUrgent = false;
    this.render();
  }

  addBonusTime(seconds) {
    this.bonusSeconds += seconds;
    this.currentSeconds += seconds;
    this.render();
  }

  get remainingSeconds() {
    return Math.max(0, Math.ceil(this.currentSeconds));
  }

  get formattedTime() {
    const total = this.remainingSeconds;
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  update(delta) {
    if (!this.isRunning) return;

    this.currentSeconds -= delta;

    if (this.currentSeconds <= 0) {
      this.currentSeconds = 0;
      this.stop();
      this.render();

      audio.playGameOver();

      if (this.onTimeUp) {
        this.onTimeUp();
      }
      return;
    }

    // Urgent warning threshold (< 15 seconds)
    const isNowUrgent = this.currentSeconds <= 15.0;
    if (isNowUrgent !== this.isUrgent) {
      this.isUrgent = isNowUrgent;
      if (this.onUrgent) {
        this.onUrgent(this.isUrgent);
      }
    }

    // Play tension heartbeat pulse every 1s when urgent
    if (this.isUrgent) {
      this.warningBeepTimer += delta;
      if (this.warningBeepTimer >= 1.0) {
        this.warningBeepTimer = 0;
        audio.playTimerWarningPulse();
      }
    }

    this.render();

    if (this.onTick) {
      this.onTick(this.remainingSeconds, this.formattedTime);
    }
  }

  render() {
    const formatted = this.formattedTime;
    if (this.timerDisplay) {
      this.timerDisplay.textContent = formatted;
    }

    if (this.timerBadge) {
      if (this.isUrgent && this.isRunning) {
        this.timerBadge.classList.add('urgent');
      } else {
        this.timerBadge.classList.remove('urgent');
      }
    }

    if (this.vignette) {
      if (this.isUrgent && this.isRunning) {
        this.vignette.classList.add('active');
      } else {
        this.vignette.classList.remove('active');
      }
    }
  }
}
