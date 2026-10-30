export type SessionState = 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';
export type SessionCommand = 'start' | 'pause' | 'resume' | 'complete' | 'cancel';

const transitions: Record<SessionState, Partial<Record<SessionCommand, SessionState>>> = {
  planned: { start: 'active', cancel: 'cancelled' },
  active: { pause: 'paused', complete: 'completed', cancel: 'cancelled' },
  paused: { resume: 'active', complete: 'completed', cancel: 'cancelled' },
  completed: {},
  cancelled: {},
};

export function nextState(state: SessionState, command: SessionCommand) {
  return transitions[state][command] ?? null;
}
