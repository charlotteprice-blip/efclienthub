// Handlers for every Client Hub Cloud Function, written against an injected
// database so they run unchanged in production (index.js wraps them with
// onCall) and in tests (tests/functions uses an in memory database).

import { HttpsError } from 'firebase-functions/v2/https';
import * as core from './core.js';
import { buildProgress, cleanPatientId } from './splose.js';
import { deriveClientType, validateIntake } from './shared/intake-rules.js';
import { buildDraft, scoreMeasure } from './shared/scoring.js';

const DAY = 24 * 60 * 60 * 1000;

// `splose` returns a Splose API client (functions/splose.js) or throws when
// the key is not set; `appConfig` is public/config/app.json.
export function makeHandlers({ db, intakeConfig, clientTypes, appConfig = {}, allowSample = () => false, splose = () => null, now = () => Date.now() }) {
  const fail = (code, message) => {
    throw new HttpsError(code, message);
  };

  function signedIn(request) {
    if (!request.auth) fail('unauthenticated', 'Please log in again.');
    return request.auth;
  }

  function practitioner(request) {
    const auth = signedIn(request);
    if (auth.token.role !== 'practitioner') fail('permission-denied', 'Only the practitioner can do this.');
    return auth;
  }

  function staff(request) {
    const auth = signedIn(request);
    if (!core.ROLES.includes(auth.token.role)) fail('permission-denied', 'Only Executive Frame staff can do this.');
    return auth;
  }

  async function audit(actorUid, action, targetUid = null, extra = {}) {
    await db.collection('auditLog').add({ actorUid, action, targetUid, at: now(), ...extra });
  }

  async function ownAssignment(auth, assignmentId) {
    const ref = db.doc(`assignments/${String(assignmentId)}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data().uid !== auth.uid) fail('not-found', 'That questionnaire was not found.');
    return { ref, a: snap.data() };
  }
  async function existingClient(uid) {
    const ref = db.doc(`clients/${String(uid)}`);
    const snap = await ref.get();
    if (!snap.exists) fail('not-found', 'Client not found.');
    return { ref, client: snap.data() };
  }

  // ---------- Splose helpers ----------

  const sploseConfig = () => appConfig.splose ?? {};

  function sploseApi() {
    if (!sploseConfig().enabled) fail('failed-precondition', 'Splose tracking is switched off in app.json.');
    try {
      const api = splose();
      if (!api) throw new Error('Splose is not connected.');
      return api;
    } catch (e) {
      return fail('failed-precondition', e.message);
    }
  }

  async function serviceNames(api) {
    const list = await api.services();
    return Object.fromEntries(list.map((s) => [s.id, String(s.name ?? 'Session').slice(0, 80)]));
  }

  // Reads 1 client's appointments, forms and case from Splose and writes
  // their progress record. 2 or 3 calls per client.
  async function syncClient(api, ref, client, names) {
    const cfg = sploseConfig();
    const patientId = client.sploseClientId;
    const since = new Date(now() - (cfg.lookbackDays ?? 180) * DAY).toISOString();
    const appointments = await api.appointments({ patientId, start_gt: since });
    const forms = cfg.showForms === false ? [] : await api.patientForms({ patientId });
    const cases = cfg.showCase ? await api.cases({ patientId }) : [];
    const progress = buildProgress({ patientId, appointments, forms, cases, serviceNames: names, config: cfg, client: { ...client, uid: ref.id }, now: now() });
    await db.doc(`sploseProgress/${ref.id}`).set(progress);
    await ref.update({ sploseSyncedAt: now() });
    return progress;
  }

  // A failed read leaves the last good record in place with the error on it.
  async function recordSploseError(ref, message) {
    await db.doc(`sploseProgress/${ref.id}`).set({ uid: ref.id, error: String(message).slice(0, 200), errorAt: now() }, { merge: true });
    await ref.update({ sploseSyncedAt: now() });
  }

  return {
    // ---------- shared sign in ----------

    // Answers the Learning Hub start page, which runs in the same Firebase
    // project and so shares one login: does this person have a place in the
    // Client Hub? Reads only the caller's own record and returns 1 boolean,
    // nothing else, so whether someone is Sarah's client stays between them
    // and their own browser (decision 60). A closed client is sent to the
    // Learning Hub like anyone else.
    hasClientHub: async (request) => {
      const auth = signedIn(request);
      if (core.ROLES.includes(auth.token.role)) return { hasHub: true };
      const snap = await db.doc(`clients/${auth.uid}`).get();
      return { hasHub: Boolean(snap.exists && !snap.data().closedAt) };
    },

    // ---------- client ----------

    redeemActivationCode: async (request) => {
      const auth = signedIn(request);
      const code = core.normaliseCode(request.data?.code);
      if (code.length !== core.CODE_LENGTH) fail('invalid-argument', "Activation codes have 12 letters and numbers. Check the code in Sarah's email.");
      const name = core.cleanName(request.data?.name ?? auth.token.name);

      const limitRef = db.doc(`rateLimits/${auth.uid}`);
      const codeRef = db.doc(`activationCodes/${core.hashCode(code)}`);
      const clientRef = db.doc(`clients/${auth.uid}`);

      // Count the attempt in its own transaction so failed attempts still count.
      const blocked = await db.runTransaction(async (tx) => {
        const attempt = core.nextAttemptState((await tx.get(limitRef)).data(), now());
        tx.set(limitRef, attempt.next);
        return attempt.blocked;
      });
      if (blocked) fail('resource-exhausted', 'Too many attempts. Wait an hour, or ask Sarah to check your code.');

      return db
        .runTransaction(async (tx) => {
          const [codeSnap, clientSnap] = await Promise.all([tx.get(codeRef), tx.get(clientRef)]);
          if (clientSnap.exists && clientSnap.data().codeHash) return { ok: true, already: true };

          const record = codeSnap.exists ? codeSnap.data() : null;
          const problem = core.codeProblem(record, { uid: auth.uid, email: auth.token.email, now: now() });
          if (problem) fail('failed-precondition', problem);

          tx.update(codeRef, { redeemedByUid: auth.uid, redeemedAt: now() });
          tx.set(
            clientRef,
            {
              uid: auth.uid,
              name: name || null,
              email: auth.token.email ?? null,
              codeHash: codeRef.id,
              codeType: record.clientTypeOverride ?? null,
              clientType: null,
              journeyStage: null,
              activatedAt: null,
              consentAt: null,
              consentVersion: null,
              retentionUntil: null,
              createdAt: now(),
              lastActive: now(),
            },
            { merge: true },
          );
          return { ok: true };
        })
        .then(async (r) => {
          await audit(auth.uid, 'redeemed activation code', auth.uid);
          return r;
        });
    },

    recordConsent: async (request) => {
      const auth = signedIn(request);
      const version = String(request.data?.version ?? '').slice(0, 40);
      if (!version) fail('invalid-argument', 'Consent version missing.');
      const ref = db.doc(`clients/${auth.uid}`);
      const snap = await ref.get();
      if (!snap.exists) fail('failed-precondition', 'Enter your activation code first.');
      await ref.update({ consentAt: now(), consentVersion: version, lastActive: now() });
      await audit(auth.uid, `recorded consent ${version}`, auth.uid);
      return { ok: true };
    },

    submitIntake: async (request) => {
      const auth = signedIn(request);
      const answers = request.data?.answers ?? {};
      const errors = validateIntake(intakeConfig, answers);
      if (Object.keys(errors).length) fail('invalid-argument', 'Please answer the required questions.');
      const ref = db.doc(`clients/${auth.uid}`);
      const snap = await ref.get();
      const client = snap.data();
      if (!client?.codeHash) fail('failed-precondition', 'Enter your activation code first.');
      if (!client.consentAt) fail('failed-precondition', 'Please agree to the privacy notice first.');
      if (client.activatedAt) return { ok: true, already: true };

      // Keep only answers to enabled questions, trimmed.
      const kept = {};
      for (const q of intakeConfig.questions.filter((x) => x.enabled)) {
        if (answers[q.id] !== undefined && answers[q.id] !== '') kept[q.id] = String(answers[q.id]).slice(0, 1000);
      }
      const derived = deriveClientType(intakeConfig, kept, client.codeType ?? null);
      const batch = db.batch();
      batch.set(db.doc(`intakeResponses/${auth.uid}`), {
        uid: auth.uid,
        answers: kept,
        derivedType: derived.type,
        source: derived.source,
        overriddenBy: null,
        submittedAt: now(),
        configVersion: intakeConfig.version,
      });
      batch.update(ref, { clientType: derived.type, journeyStage: 'assessment', activatedAt: now(), lastActive: now() });

      // Default questionnaires for the type, if Sarah has listed any.
      const defaults = clientTypes.types?.[derived.type]?.defaultMeasures ?? [];
      let order = 1;
      for (const measureId of defaults) {
        const m = await db.doc(`measures/${measureId}`).get();
        if (!core.assignable(m.data(), { allowSample: allowSample() })) continue;
        batch.set(db.collection('assignments').doc(), { uid: auth.uid, measureId, status: 'notStarted', order: order++, assignedAt: now(), completedAt: null });
      }
      await batch.commit();
      await audit(auth.uid, 'submitted intake', auth.uid);
      return { ok: true };
    },

    saveResponse: async (request) => {
      const auth = signedIn(request);
      const { assignmentId, itemId, value } = request.data ?? {};
      const { ref, a } = await ownAssignment(auth, assignmentId);
      if (a.status === 'complete') fail('failed-precondition', 'You have already finished that questionnaire.');
      const measure = (await db.doc(`measures/${a.measureId}`).get()).data();
      if (!core.validResponse(measure, itemId, value)) fail('invalid-argument', 'That answer is not one of the options.');
      // In progress answers sit on the assignment so the client can resume;
      // submitMeasure moves them to scoring, which clients cannot read.
      await ref.update({ [`responses.${itemId}`]: Number(value), status: 'inProgress', updatedAt: now() });
      await db.doc(`clients/${auth.uid}`).update({ lastActive: now() });
      return { ok: true };
    },

    submitMeasure: async (request) => {
      const auth = signedIn(request);
      const { ref, a } = await ownAssignment(auth, request.data?.assignmentId);
      if (a.status === 'complete') return { ok: true, booking: false };
      const measure = (await db.doc(`measures/${a.measureId}`).get()).data();
      const responses = a.responses ?? {};

      // scoreMeasure: draft only, never shown to the client before release.
      const scores = scoreMeasure(measure, responses);
      if (!scores.complete) fail('failed-precondition', 'Please answer every question before finishing.');
      const draft = buildDraft(measure, scores);

      const batch = db.batch();
      batch.set(db.doc(`scoring/${ref.id}`), { uid: auth.uid, assignmentId: ref.id, measureId: a.measureId, responses, scores, draft, scoredAt: now() });
      batch.update(ref, { status: 'complete', completedAt: now(), responses: null });
      await batch.commit();

      // triggerBooking: when the last questionnaire of the initial
      // assessment is done. A check in completed later in the journey
      // leaves the stage where Sarah has it.
      const open = await db.collection('assignments').where('uid', '==', auth.uid).where('status', 'in', ['notStarted', 'inProgress']).get();
      const clientRef = db.doc(`clients/${auth.uid}`);
      const stage = (await clientRef.get()).data()?.journeyStage ?? 'assessment';
      let booking = false;
      if (open.empty && stage === 'assessment') {
        await clientRef.update({ journeyStage: 'booking', bookingTriggeredAt: now(), lastActive: now() });
        booking = true;
      } else {
        await clientRef.update({ lastActive: now() });
      }
      await audit(auth.uid, 'completed questionnaire', auth.uid, { measureId: a.measureId, booking });
      return { ok: true, booking };
    },

    createRequest: async (request) => {
      const auth = signedIn(request);
      const kind = request.data?.kind;
      if (!core.REQUEST_KINDS.includes(kind)) fail('invalid-argument', 'Unknown request.');
      const detail = String(request.data?.detail ?? '')
        .trim()
        .slice(0, 1000);
      if (kind === 'correction' && !detail) fail('invalid-argument', 'Tell Sarah what should be corrected.');
      await db.collection('requests').add({ uid: auth.uid, kind, detail, createdAt: now(), dueBy: core.addWorkingDays(now(), 20), status: 'open' });
      await audit(auth.uid, `requested ${kind}`, auth.uid);
      return { ok: true };
    },

    // ---------- practitioner ----------

    issueActivationCode: async (request) => {
      const auth = staff(request);
      const forName = core.cleanName(request.data?.forName) || 'Unnamed';
      const type = request.data?.clientTypeOverride || null;
      if (type && !clientTypes.types[type]) fail('invalid-argument', 'Unknown client type.');
      const email =
        String(request.data?.email ?? '')
          .trim()
          .toLowerCase() || null;
      let code;
      let ref;
      for (let i = 0; i < 5; i += 1) {
        code = core.generateCode();
        ref = db.doc(`activationCodes/${core.hashCode(code)}`);
        if (!(await ref.get()).exists) break;
      }
      await ref.set({
        forName,
        email,
        clientTypeOverride: type,
        last4: code.slice(-4),
        issuedBy: auth.uid,
        issuedAt: now(),
        expiresAt: core.codeExpiry(now()),
        redeemedByUid: null,
        redeemedAt: null,
      });
      await audit(auth.uid, 'issued activation code', null, { forName });
      // The only time the code itself is returned; only its hash is stored.
      return { code: core.formatCode(code), expiresAt: core.codeExpiry(now()) };
    },

    setClientType: async (request) => {
      const auth = practitioner(request);
      const type = request.data?.type || null;
      if (type && !clientTypes.types[type]) fail('invalid-argument', 'Unknown client type.');
      const { ref } = await existingClient(request.data?.uid);
      await ref.update({ clientType: type });
      await db.doc(`intakeResponses/${ref.id}`).set({ overriddenBy: auth.uid, overriddenAt: now() }, { merge: true });
      await audit(auth.uid, `set client type ${type}`, ref.id);
      return { ok: true };
    },

    setStage: async (request) => {
      const auth = practitioner(request);
      const stage = request.data?.stage;
      if (!core.STAGES.includes(stage)) fail('invalid-argument', 'Unknown stage.');
      const { ref } = await existingClient(request.data?.uid);
      await ref.update({ journeyStage: stage });
      await audit(auth.uid, `set stage ${stage}`, ref.id);
      return { ok: true };
    },

    assignMeasure: async (request) => {
      const auth = practitioner(request);
      const { ref, client } = await existingClient(request.data?.uid);
      const measureId = String(request.data?.measureId ?? '');
      const measure = (await db.doc(`measures/${measureId}`).get()).data();
      if (!core.assignable(measure, { allowSample: allowSample() })) fail('failed-precondition', 'That questionnaire is not cleared for use with clients.');
      const current = await db.collection('assignments').where('uid', '==', ref.id).get();
      if (current.docs.some((d) => d.data().measureId === measureId && d.data().status !== 'complete')) return { ok: true, already: true };
      await db.collection('assignments').add({ uid: ref.id, measureId, status: 'notStarted', order: current.size + 1, assignedAt: now(), completedAt: null });
      if (['booking', 'feedback'].includes(client.journeyStage)) await ref.update({ journeyStage: 'assessment' });
      await audit(auth.uid, 'assigned questionnaire', ref.id, { measureId });
      return { ok: true };
    },

    releaseResults: async (request) => {
      const auth = practitioner(request);
      const { ref, client } = await existingClient(request.data?.uid);
      const scoring = await db.collection('scoring').where('uid', '==', ref.id).get();
      // Practitioner only questionnaires (screeners) have drafts for Sarah but nothing for the client.
      const drafts = scoring.docs.map((d) => d.data()).filter((d) => d.draft && d.draft.clientFacing !== false);
      if (!drafts.length) fail('failed-precondition', 'There are no draft results to release.');
      const resultsRef = db.doc(`results/${ref.id}`);
      const existing = (await resultsRef.get()).data()?.items ?? [];
      const items = core.buildRelease(drafts, existing);
      await resultsRef.set({ uid: ref.id, releasedAt: now(), releasedBy: auth.uid, items });
      await ref.update({ journeyStage: core.stageAfterRelease(client.journeyStage) });
      await audit(auth.uid, 'released results', ref.id, { count: items.length });
      return { ok: true };
    },

    saveFormulationDraft: async (request) => {
      const auth = practitioner(request);
      const { ref } = await existingClient(request.data?.uid);
      const factors = core.cleanFactors(request.data?.factors);
      if (!factors) fail('invalid-argument', 'Each factor needs text and one of the 5 zones.');
      const summary = core.cleanSummary(request.data?.summary);
      const view = core.cleanView(request.data?.view);
      await db.doc(`formulationDrafts/${ref.id}`).set({ uid: ref.id, factors, summary, view, updatedAt: now(), updatedBy: auth.uid });
      return { ok: true };
    },

    releaseFormulation: async (request) => {
      const auth = practitioner(request);
      const { ref } = await existingClient(request.data?.uid);
      const draft = (await db.doc(`formulationDrafts/${ref.id}`).get()).data();
      if (!draft?.factors?.length) fail('failed-precondition', 'Add at least 1 factor before releasing.');
      const prior = (await db.doc(`formulations/${ref.id}`).get()).data();
      const version = (prior?.version ?? 0) + 1;
      await db.doc(`formulations/${ref.id}`).set({ uid: ref.id, factors: draft.factors, summary: draft.summary ?? '', view: core.cleanView(draft.view), version, releasedAt: now(), releasedBy: auth.uid });
      await audit(auth.uid, 'released formulation', ref.id, { version });
      return { ok: true };
    },

    // The client marks a released factor as fits, partly or does not fit,
    // with an optional comment. Responses live in formulationResponses,
    // 1 document per client, keyed by factor id; Sarah reads them on the
    // client's record. A new release keeps earlier responses for factors
    // that are still present.
    respondToFormulation: async (request) => {
      const auth = signedIn(request);
      const formulation = (await db.doc(`formulations/${auth.uid}`).get()).data();
      if (!formulation?.releasedAt) fail('failed-precondition', 'No formulation has been shared with you yet.');
      const response = core.cleanResponse(request.data, formulation);
      if (!response) fail('invalid-argument', 'Choose fits, partly or does not fit, or write a comment.');
      const ref = db.doc(`formulationResponses/${auth.uid}`);
      const existing = (await ref.get()).data()?.responses ?? {};
      existing[response.factorId] = { fit: response.fit, comment: response.comment, at: now(), version: formulation.version ?? 1 };
      await ref.set({ uid: auth.uid, responses: existing, updatedAt: now() });
      return { ok: true };
    },

    // The next session Sarah has booked with the client, shown on their Home.
    setNextSession: async (request) => {
      const auth = practitioner(request);
      const { ref } = await existingClient(request.data?.uid);
      const session = core.cleanSession(request.data);
      if (!session) fail('invalid-argument', 'Enter a date and time for the session, or clear it.');
      await ref.update({ nextSessionAt: session.at, nextSessionNote: session.note });
      await audit(auth.uid, session.at ? 'set next session' : 'cleared next session', ref.id);
      return { ok: true };
    },

    // Links and notes Sarah pins for the client (Learning Hub pages, handouts
    // hosted elsewhere, recordings). Files are never stored in the hub.
    setResources: async (request) => {
      const auth = practitioner(request);
      const { ref } = await existingClient(request.data?.uid);
      const resources = core.cleanResources(request.data?.resources);
      if (!resources) fail('invalid-argument', 'Each resource needs a title and an https link.');
      await ref.update({ resources });
      await audit(auth.uid, 'set resources', ref.id, { count: resources.length });
      return { ok: true };
    },

    closeRequest: async (request) => {
      const auth = practitioner(request);
      const ref = db.doc(`requests/${String(request.data?.requestId)}`);
      const snap = await ref.get();
      if (!snap.exists) fail('not-found', 'Request not found.');
      await ref.update({ status: 'done', closedAt: now(), closedBy: auth.uid });
      await audit(auth.uid, 'answered privacy request', snap.data().uid);
      return { ok: true };
    },

    // Sarah records that she has followed up the flagged answers on 1
    // completed questionnaire. The flags stay on the draft with the date;
    // the questionnaire leaves Today and To review.
    markFlagsFollowedUp: async (request) => {
      const auth = practitioner(request);
      const ref = db.doc(`scoring/${String(request.data?.assignmentId)}`);
      const snap = await ref.get();
      if (!snap.exists) fail('not-found', 'That questionnaire was not found.');
      const scoring = snap.data();
      if (!(scoring.draft?.flags ?? []).length) fail('failed-precondition', 'That questionnaire has no answers to follow up.');
      if (scoring.flagsFollowedUpAt) return { ok: true, already: true };
      await ref.update({ flagsFollowedUpAt: now(), flagsFollowedUpBy: auth.uid });
      await audit(auth.uid, 'followed up flagged answers', scoring.uid, { measureId: scoring.measureId });
      return { ok: true };
    },

    // ---------- check in schedules ----------

    createSchedule: async (request) => {
      const auth = practitioner(request);
      const { ref, client } = await existingClient(request.data?.uid);
      if (!client.activatedAt) fail('failed-precondition', 'The client has not finished setting up yet.');
      const measureId = String(request.data?.measureId ?? '');
      const measure = (await db.doc(`measures/${measureId}`).get()).data();
      if (!core.assignable(measure, { allowSample: allowSample() })) fail('failed-precondition', 'That questionnaire is not cleared for use with clients.');
      const clean = core.scheduleProblem(request.data ?? {});
      if (typeof clean === 'string') fail('invalid-argument', clean);
      const today = core.nzDate(now());
      if (clean.startsOn < today) fail('invalid-argument', 'The first check in date cannot be in the past.');
      const existing = await db.collection('schedules').where('uid', '==', ref.id).where('status', 'in', ['active', 'paused']).get();
      if (existing.docs.some((d) => d.data().measureId === measureId)) fail('failed-precondition', 'That questionnaire already has a check in schedule. End it before adding another.');
      const doc = await db.collection('schedules').add({
        uid: ref.id,
        measureId,
        cadence: clean.cadence,
        dates: clean.dates,
        startsOn: clean.startsOn,
        endsOn: clean.endsOn,
        nextDue: clean.startsOn,
        status: 'active',
        runs: 0,
        lastRunOn: null,
        pausedAt: null,
        endedAt: null,
        createdBy: auth.uid,
        createdAt: now(),
      });
      await audit(auth.uid, `scheduled check in ${clean.cadence}`, ref.id, { measureId, scheduleId: doc.id });
      return { ok: true, scheduleId: doc.id };
    },

    updateSchedule: async (request) => {
      const auth = practitioner(request);
      const action = request.data?.action;
      if (!['pause', 'resume', 'end'].includes(action)) fail('invalid-argument', 'Unknown action.');
      const ref = db.doc(`schedules/${String(request.data?.scheduleId)}`);
      const snap = await ref.get();
      if (!snap.exists) fail('not-found', 'Schedule not found.');
      const s = snap.data();
      if (s.status === 'ended') fail('failed-precondition', 'That schedule has already ended.');
      const today = core.nzDate(now());
      if (action === 'pause') {
        if (s.status === 'paused') return { ok: true, already: true };
        await ref.update({ status: 'paused', pausedAt: now() });
      } else if (action === 'resume') {
        if (s.status === 'active') return { ok: true, already: true };
        const nextDue = core.resumedDue(s, today);
        await ref.update(nextDue ? { status: 'active', pausedAt: null, nextDue } : { status: 'ended', endedAt: now(), endedBy: auth.uid, nextDue: null });
      } else {
        await ref.update({ status: 'ended', endedAt: now(), endedBy: auth.uid, nextDue: null });
      }
      await audit(auth.uid, `${{ pause: 'paused', resume: 'resumed', end: 'ended' }[action]} check in schedule`, s.uid, { scheduleId: ref.id });
      return { ok: true };
    },

    // Run once a day by the scheduler (index.js), never by a browser. For
    // each schedule due today or earlier, assigns the questionnaire unless
    // the client already has it open, then moves the schedule on. `today`
    // may be passed in tests.
    runDueSchedules: async (request = {}) => {
      const today = request.data?.today && core.validDate(request.data.today) ? request.data.today : core.nzDate(now());
      const due = await db.collection('schedules').where('nextDue', '<=', today).get();
      const summary = { today, assigned: 0, skipped: 0, ended: 0 };
      for (const snap of due.docs) {
        const s = snap.data();
        if (s.status !== 'active') continue;
        const clientSnap = await db.doc(`clients/${s.uid}`).get();
        const client = clientSnap.exists ? clientSnap.data() : null;
        const measure = (await db.doc(`measures/${s.measureId}`).get()).data();
        const current = await db.collection('assignments').where('uid', '==', s.uid).get();
        const open = current.docs.some((d) => d.data().measureId === s.measureId && d.data().status !== 'complete');
        const canAssign = client?.activatedAt && !client.closedAt && core.assignable(measure, { allowSample: allowSample() }) && !open;
        if (canAssign) {
          await db.collection('assignments').add({
            uid: s.uid,
            measureId: s.measureId,
            status: 'notStarted',
            order: current.size + 1,
            assignedAt: now(),
            completedAt: null,
            source: 'scheduled',
            scheduleId: snap.id,
            dueOn: s.nextDue,
          });
          await audit('system', 'scheduled check in assigned', s.uid, { measureId: s.measureId, scheduleId: snap.id, dueOn: s.nextDue });
          summary.assigned += 1;
        } else {
          summary.skipped += 1;
        }
        const next = core.advanceSchedule(s, today);
        await snap.ref.update({ ...next, runs: (s.runs ?? 0) + 1, lastRunOn: today, ...(next.status === 'ended' ? { endedAt: now(), endedBy: 'system' } : {}) });
        if (next.status === 'ended') summary.ended += 1;
      }
      return summary;
    },

    // ---------- Splose ----------

    // Sarah links a hub client to their Splose patient record by id. The
    // email must match unless she confirms; the first sync runs at once.
    linkSplosePatient: async (request) => {
      const auth = practitioner(request);
      const { ref, client } = await existingClient(request.data?.uid);
      const patientId = cleanPatientId(request.data?.patientId);
      if (!patientId) fail('invalid-argument', "Enter the Splose patient id: the number in the address bar on the patient's Splose page.");
      const api = sploseApi();
      let patient;
      try {
        patient = await api.patient(patientId);
      } catch (e) {
        if (e.status === 404) fail('not-found', 'No patient in Splose has that id.');
        fail('unavailable', e.message);
      }
      const theirs = String(patient?.email ?? '').trim().toLowerCase();
      const ours = String(client.email ?? '').trim().toLowerCase();
      if (theirs && ours && theirs !== ours && !request.data?.confirm) {
        fail('failed-precondition', `That Splose patient's email does not match ${client.email}. Tick "Link anyway" if you are sure it is the same person.`);
      }
      await ref.update({ sploseClientId: patientId, sploseSyncedAt: null });
      await audit(auth.uid, 'linked Splose patient', ref.id, { emailMatched: !theirs || !ours || theirs === ours });
      try {
        await syncClient(api, ref, { ...client, sploseClientId: patientId }, await serviceNames(api));
      } catch (e) {
        await recordSploseError(ref, e.message);
      }
      return { ok: true };
    },

    // Sarah searches Splose by name or email to find the patient id. The
    // result is shown once on the Overview tab and nothing is stored.
    searchSplosePatients: async (request) => {
      practitioner(request);
      const query = String(request.data?.query ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (query.length < 2) fail('invalid-argument', 'Enter at least 2 letters of a name, or an email address.');
      const api = sploseApi();
      const words = query.split(' ');
      let found = [];
      try {
        if (query.includes('@')) found = await api.patients({ email: query });
        else if (words.length > 1) found = await api.patients({ firstname: words[0], lastname: words.slice(1).join(' ') });
        else found = [...(await api.patients({ firstname: query })), ...(await api.patients({ lastname: query }))];
      } catch (e) {
        fail('unavailable', e.message);
      }
      const seen = new Set();
      const results = [];
      for (const p of found) {
        const id = cleanPatientId(p?.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        results.push({
          id,
          name: [p.preferredName || p.firstname, p.lastname].filter(Boolean).join(' ').slice(0, 120) || 'Unnamed',
          email: p.email ? String(p.email).slice(0, 120) : null,
          archived: Boolean(p.archived),
        });
      }
      results.sort((a, b) => a.name.localeCompare(b.name));
      return { query, results: results.slice(0, 20) };
    },

    unlinkSplosePatient: async (request) => {
      const auth = practitioner(request);
      const { ref, client } = await existingClient(request.data?.uid);
      if (!client.sploseClientId) return { ok: true, already: true };
      await ref.update({ sploseClientId: null, sploseSyncedAt: null });
      await db.doc(`sploseProgress/${ref.id}`).delete();
      await audit(auth.uid, 'unlinked Splose patient', ref.id);
      return { ok: true };
    },

    // Resync now, from the client's Overview tab. Once a minute per client.
    syncSploseClient: async (request) => {
      const auth = practitioner(request);
      const { ref, client } = await existingClient(request.data?.uid);
      if (!client.sploseClientId) fail('failed-precondition', 'Link this client to Splose first.');
      const current = (await db.doc(`sploseProgress/${ref.id}`).get()).data();
      if (current?.syncedAt && now() - current.syncedAt < 60 * 1000) return { ok: true, already: true };
      const api = sploseApi();
      try {
        await syncClient(api, ref, client, await serviceNames(api));
      } catch (e) {
        await recordSploseError(ref, e.message);
        fail('unavailable', e.message);
      }
      await audit(auth.uid, 'resynced Splose', ref.id);
      return { ok: true };
    },

    // Run on a timer (index.js), never by a browser. Oldest synced clients
    // first, a fixed number per run, stopping inside the call budget so the
    // Splose limit of 60 calls a minute is never reached.
    runSploseSync: async () => {
      const cfg = sploseConfig();
      const summary = { synced: 0, failed: 0, deferred: 0, calls: 0, error: null };
      if (!cfg.enabled) return { ...summary, skipped: 'disabled' };
      let api;
      try {
        api = splose();
        if (!api) throw new Error('Splose is not connected.');
      } catch (e) {
        return { ...summary, error: e.message };
      }
      const linked = (await db.collection('clients').where('sploseClientId', '>', 0).get()).docs
        .map((d) => ({ ref: d.ref, client: d.data() }))
        .filter((x) => !x.client.closedAt)
        .sort((a, b) => (a.client.sploseSyncedAt ?? 0) - (b.client.sploseSyncedAt ?? 0));
      const batch = linked.slice(0, cfg.clientsPerRun ?? 15);
      summary.deferred = linked.length - batch.length;
      if (!batch.length) return summary;
      let names;
      try {
        names = await serviceNames(api);
      } catch (e) {
        summary.error = e.message;
        summary.calls = api.calls;
        return summary;
      }
      for (const { ref, client } of batch) {
        if (api.calls >= (cfg.callsPerRun ?? 50)) {
          summary.deferred += 1;
          continue;
        }
        try {
          await syncClient(api, ref, client, names);
          summary.synced += 1;
        } catch (e) {
          await recordSploseError(ref, e.message);
          summary.failed += 1;
          // A refused key or a rate limit stops the whole run; the rest wait.
          if ([401, 403, 429].includes(e.status)) {
            summary.error = e.message;
            break;
          }
        }
      }
      summary.calls = api.calls;
      return summary;
    },
  };
}
