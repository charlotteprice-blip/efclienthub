// Live data layer: Firestore reads (as firestore.rules allow) and calls to
// the Cloud Functions, which make every change.

import { db, functions } from '../firebase.js';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from '/assets/vendor/firebase/firebase-firestore.js';
import { httpsCallable } from '/assets/vendor/firebase/firebase-functions.js';

const FRIENDLY = 'Something went wrong. Check your connection and try again.';

export async function call(name, data = {}) {
  try {
    const result = await httpsCallable(functions, name)(data);
    return result.data;
  } catch (e) {
    const code = String(e?.code ?? '');
    const message = ['functions/internal', 'functions/unavailable', 'functions/deadline-exceeded', 'functions/unknown'].includes(code) || !e?.message ? FRIENDLY : e.message;
    throw new Error(message);
  }
}

// A read the rules refuse (for example results not yet released) is
// treated as "nothing to show".
async function maybe(ref) {
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    if (e?.code === 'permission-denied') return null;
    throw e;
  }
}

async function all(q) {
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const measureCache = new Map();
export async function measure(id) {
  if (!measureCache.has(id)) measureCache.set(id, await maybe(doc(db, 'measures', id)));
  return measureCache.get(id);
}

export async function loadClient(uid) {
  const client = await maybe(doc(db, 'clients', uid));
  const ctx = { client, assignments: [], measures: {}, results: null, formulation: null, requests: [] };
  if (!client?.activatedAt) return ctx;
  const [assignments, results, formulation, requests] = await Promise.all([
    all(query(collection(db, 'assignments'), where('uid', '==', uid), orderBy('order'))),
    maybe(doc(db, 'results', uid)),
    maybe(doc(db, 'formulations', uid)),
    all(query(collection(db, 'requests'), where('uid', '==', uid), orderBy('createdAt', 'desc'))),
  ]);
  ctx.assignments = assignments;
  ctx.results = results?.releasedAt ? results : null;
  ctx.formulation = formulation?.releasedAt ? formulation : null;
  ctx.requests = requests;
  for (const a of assignments) ctx.measures[a.measureId] = await measure(a.measureId);
  return ctx;
}

const byId = (list, key = 'id') => Object.fromEntries(list.map((x) => [x[key], x]));

export async function loadStaff(role) {
  const [codes, measures] = await Promise.all([all(collection(db, 'activationCodes')), all(collection(db, 'measures'))]);
  const ctx = { codes: codes.sort((a, b) => b.issuedAt - a.issuedAt), measures: byId(measures) };
  if (role !== 'practitioner') return ctx;
  const [clients, assignments, scoring, results, requests, intake, drafts, formulations] = await Promise.all([
    all(collection(db, 'clients')),
    all(collection(db, 'assignments')),
    all(collection(db, 'scoring')),
    all(collection(db, 'results')),
    all(collection(db, 'requests')),
    all(collection(db, 'intakeResponses')),
    all(collection(db, 'formulationDrafts')),
    all(collection(db, 'formulations')),
  ]);
  return {
    ...ctx,
    clients: byId(clients),
    assignments: assignments.sort((a, b) => a.order - b.order),
    scoring: byId(scoring),
    results: byId(results),
    requests: requests.sort((a, b) => b.createdAt - a.createdAt),
    intake: byId(intake),
    formulationDrafts: byId(drafts),
    formulations: byId(formulations),
  };
}
