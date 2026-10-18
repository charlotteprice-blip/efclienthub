// Test stand in for Firebase Authentication, backed by tests/e2e/server.mjs.
const KEY = 'fake-auth-uid';
const listeners = new Set();
let current = null;

async function post(path, body) {
  const res = await fetch(`/__fake/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.message), { code: json.code });
  return json;
}

function makeUser(u) {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName ?? null,
    async getIdTokenResult() {
      const fresh = await post('auth/user', { uid: u.uid });
      return { claims: fresh.role ? { role: fresh.role } : {} };
    },
  };
}

function emit() {
  for (const fn of listeners) fn(current);
}

export const browserLocalPersistence = 'local';
export const getAuth = () => ({ get currentUser() { return current; } });
export const connectAuthEmulator = () => {};
export const setPersistence = async () => {};

export function onAuthStateChanged(_auth, fn) {
  listeners.add(fn);
  const uid = localStorage.getItem(KEY);
  if (uid) post('auth/user', { uid }).then((u) => { current = makeUser(u); fn(current); }).catch(() => fn(null));
  else setTimeout(() => fn(null), 0);
  return () => listeners.delete(fn);
}

export async function createUserWithEmailAndPassword(_auth, email, password) {
  const u = await post('auth/signup', { email, password });
  localStorage.setItem(KEY, u.uid);
  current = makeUser(u);
  emit();
  return { user: current };
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  const u = await post('auth/signin', { email, password });
  localStorage.setItem(KEY, u.uid);
  current = makeUser(u);
  emit();
  return { user: current };
}

export async function updateProfile(user, { displayName }) {
  await post('auth/profile', { uid: user.uid, displayName });
  user.displayName = displayName;
}

export async function signOut() {
  localStorage.removeItem(KEY);
  current = null;
  emit();
}

export async function sendPasswordResetEmail() {}
