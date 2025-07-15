import { Injectable } from '@nestjs/common';

@Injectable()
export class LoginAttemptService {
  private attempts = new Map<string, { count: number; lockUntil: Date | null }>();

  private readonly MAX_ATTEMPTS = 4;
  private readonly LOCK_TIME_MINUTES = 40;

  registerFailedAttempt(email: string): void {
    const entry = this.attempts.get(email) || { count: 0, lockUntil: null };
    const now = new Date();

    // If account is locked and lock hasn't expired, exit
    if (entry.lockUntil && entry.lockUntil > now) return;

    entry.count++;

    if (entry.count >= this.MAX_ATTEMPTS) {
      entry.lockUntil = new Date(now.getTime() + this.LOCK_TIME_MINUTES * 60 * 1000);
      entry.count = 0;
    }

    this.attempts.set(email, entry);
  }

  isLocked(email: string): boolean {
    const entry = this.attempts.get(email);
    if (!entry || !entry.lockUntil) return false;

    if (entry.lockUntil > new Date()) return true;

    // Lock expired: reset attempt
    this.attempts.set(email, { count: 0, lockUntil: null });
    return false;
  }

  reset(email: string): void {
    this.attempts.delete(email);
  }
}
