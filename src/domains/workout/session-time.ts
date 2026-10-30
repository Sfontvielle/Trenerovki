import type { WorkoutSession } from './types';

type TimedSession = Pick<WorkoutSession, 'startedAt' | 'pausedMs'> &
  Partial<Pick<WorkoutSession, 'pausedAt' | 'finishedAt'>>;

export function sessionDurationMs(session: TimedSession, now: Date) {
  const end = session.finishedAt ?? session.pausedAt ?? now.toISOString();
  const elapsed = Date.parse(end) - Date.parse(session.startedAt) - session.pausedMs;
  return Math.max(0, elapsed);
}

export function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
}
