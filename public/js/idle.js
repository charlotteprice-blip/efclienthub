// Idle sign out: the timing rules, kept apart from the page so they can be
// tested. A signed in browser is logged out after a period with no
// activity, with a warning shortly before that lets the person stay.
//
// The time of the last activity is kept through `read` and `write` (the
// live app uses localStorage, so activity in another tab counts and a
// browser reopened hours later is logged out at once). Only a timestamp is
// stored: nothing about the person.

export const IDLE_DEFAULTS = { limitMs: 30 * 60 * 1000, warnMs: 60 * 1000 };

// 'active', 'warn' (inside the last warnMs before the limit) or 'expired'.
// A missing or unreadable time counts as active, and so does a time in the
// future (a clock that was put back), so nobody is logged out by mistake.
export function idleState(last, now, { limitMs = IDLE_DEFAULTS.limitMs, warnMs = IDLE_DEFAULTS.warnMs } = {}) {
  const t = Number(last);
  if (!Number.isFinite(t) || t <= 0) return 'active';
  const idle = now - t;
  if (idle < 0) return 'active';
  if (idle >= limitMs) return 'expired';
  if (idle >= limitMs - warnMs) return 'warn';
  return 'active';
}

// Watches for idleness. The page calls activity() on input, check() on a
// timer and when the tab is shown again, stay() from the warning's button,
// and start() or stop() as someone signs in or out.
//   onWarn()    the warning should be shown
//   onActive()  the warning should be closed (they stayed, or were active elsewhere)
//   onExpire()  log out now; called once
export function createIdleWatch({ read, write, now = () => Date.now(), limitMs = IDLE_DEFAULTS.limitMs, warnMs = IDLE_DEFAULTS.warnMs, throttleMs = 5000, onWarn = () => {}, onActive = () => {}, onExpire = () => {} }) {
  let state = 'stopped';
  let lastWrite = 0;
  const stamp = () => {
    lastWrite = now();
    write(lastWrite);
  };
  return {
    get state() {
      return state;
    },
    // fresh: the person has just logged in, so the clock starts now. Not
    // fresh: a session the browser kept, so an old time still counts and a
    // long absence expires at the next check.
    start({ fresh = false } = {}) {
      state = 'active';
      if (fresh || !Number(read())) stamp();
      return this.check();
    },
    stop() {
      state = 'stopped';
    },
    // Input on the page. Ignored while the warning is up: only its button
    // (or activity in another tab) keeps the person logged in, so a stray
    // touch does not hide a warning they have not read.
    activity() {
      if (state !== 'active') return;
      if (now() - lastWrite >= throttleMs) stamp();
    },
    stay() {
      if (state === 'stopped' || state === 'expired') return;
      stamp();
      if (state === 'warn') {
        state = 'active';
        onActive();
      }
    },
    check() {
      if (state === 'stopped' || state === 'expired') return state;
      const next = idleState(read(), now(), { limitMs, warnMs });
      if (next === state) return state;
      state = next;
      if (next === 'warn') onWarn();
      else if (next === 'expired') onExpire();
      else onActive();
      return state;
    },
  };
}
