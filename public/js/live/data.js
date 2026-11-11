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

export async function loadClient(uid) {
  const client = await maybe(doc(db, 'clients', uid));
  const ctx = { client, assignments: [], measures: {}, results: null, formulation: null, formulationResponses: {}, requests: [], schedules: [], splose: null };
  if (!client?.activatedAt) return ctx;
  // Questionnaires come from a function that hands over only what is needed
  // to answer them; the rules no longer let a client read `measures`.
  const [assignments, results, formulation, responses, requests, schedules, splose, questionnaires] = await Promise.all([
    all(query(collection(db, 'assignments'), where('uid', '==', uid), orderBy('order'))),
    maybe(doc(db, 'results', uid)),
    maybe(doc(db, 'formulations', uid)),
    maybe(doc(db, 'formulationResponses', uid)),
    all(query(collection(db, 'requests'), where('uid', '==', uid), orderBy('createdAt', 'desc'))),
    all(query(collection(db, 'schedules'), where('uid', '==', uid))),
    maybe(doc(db, 'sploseProgress', uid)),
    call('myQuestionnaires'),
  ]);
  ctx.assignments = assignments;
  ctx.measures = questionnaires.measures ?? {};
  ctx.splose = splose;
  ctx.results = results?.releasedAt ? results : null;
  ctx.formulation = formulation?.releasedAt ? formulation : null;
  ctx.formulationResponses = responses?.responses ?? {};
  ctx.requests = requests;
  ctx.schedules = schedules.filter((x) => x.status === 'active' || x.status === 'paused').sort((a, b) => String(a.nextDue ?? '') > String(b.nextDue ?? '') ? 1 : -1);
  return ctx;
}

const byId = (list, key = 'id') => Object.fromEntries(list.map((x) => [x[key], x]));

export async function loadStaff(role) {
  // An admin account is handed the codes by a function, without names or
  // emails; only the practitioner reads the collection itself.
  const [codes, measures] = await Promise.all([role === 'practitioner' ? all(collection(db, 'activationCodes')) : call('listActivationCodes').then((r) => r.codes), all(collection(db, 'measures'))]);
  const ctx = { codes: codes.sort((a, b) => b.issuedAt - a.issuedAt), measures: byId(measures) };
  if (role !== 'practitioner') return ctx;
  const [clients, assignments, scoring, results, requests, intake, drafts, formulations, schedules, responses, splose] = await Promise.all([
    all(collection(db, 'clients')),
    all(collection(db, 'assignments')),
    all(collection(db, 'scoring')),
    all(collection(db, 'results')),
    all(collection(db, 'requests')),
    all(collection(db, 'intakeResponses')),
    all(collection(db, 'formulationDrafts')),
    all(collection(db, 'formulations')),
    all(collection(db, 'schedules')),
    all(collection(db, 'formulationResponses')),
    all(collection(db, 'sploseProgress')),
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
    formulationResponses: byId(responses, 'uid'),
    schedules: schedules.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    splose: byId(splose),
  };
}
