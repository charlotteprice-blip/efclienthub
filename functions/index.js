// Executive Frame Client Hub Cloud Functions (codebase "clienthub").
//
// Every write to the named Firestore database `clienthub` happens here,
// through the Admin SDK. Browsers only read, as firestore.rules allows.
// Times are stored as milliseconds since 1970 (numbers). The logic lives in
// handlers.js; this file only connects it to Firebase.
//
// Client:        redeemActivationCode, recordConsent, submitIntake,
//                saveResponse, submitMeasure (scores the draft and triggers
//                booking), createRequest
// Practitioner:  issueActivationCode (admin too), setClientType, setStage,
//                assignMeasure, releaseResults, saveFormulationDraft,
//                releaseFormulation, closeRequest, createSchedule,
//                updateSchedule
// Splose:        searchSplosePatients, linkSplosePatient,
//                unlinkSplosePatient, syncSploseClient
// Shared login:  hasClientHub, called by the Learning Hub start page from
//                the person's own browser; answers { hasHub } and logs no one
// Scheduled:     runCheckIns, every morning at 7am New Zealand time,
//                assigns the check in questionnaires due that day;
//                runSploseSync, every 15 minutes in waking hours and hourly
//                overnight, reads appointments and forms from Splose

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineBoolean, defineSecret } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { makeHandlers } from './handlers.js';
import { createSploseClient } from './splose.js';

setGlobalOptions({ region: 'australia-southeast1', maxInstances: 10 });
initializeApp();

const readJson = (file) => JSON.parse(readFileSync(new URL(`./shared/${file}`, import.meta.url), 'utf8'));

// Set ALLOW_SAMPLE_MEASURES=true in functions/.env.ef-client-hub only
// while testing with the invented sample questionnaires.
const ALLOW_SAMPLE_MEASURES = defineBoolean('ALLOW_SAMPLE_MEASURES', { default: false });
// Sarah's Splose API key, set once with:
//   firebase functions:secrets:set SPLOSE_API_KEY --project ef-client-hub
const SPLOSE_API_KEY = defineSecret('SPLOSE_API_KEY');

const handlers = makeHandlers({
  db: getFirestore('clienthub'),
  intakeConfig: readJson('intake.json'),
  clientTypes: readJson('client-types.json'),
  appConfig: readJson('app.json'),
  allowSample: () => ALLOW_SAMPLE_MEASURES.value(),
  splose: () => createSploseClient({ apiKey: SPLOSE_API_KEY.value() }),
});

const options = {
  cors: [
    /^https:\/\/clients\.executiveframe\.co\.nz$/,
    /^https:\/\/executiveframe-clienthub\.(web\.app|firebaseapp\.com)$/,
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  ],
  secrets: [SPLOSE_API_KEY],
};

const wrap = (handler) =>
  onCall(options, async (request) => {
    try {
      return await handler(request);
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      logger.error(e);
      throw new HttpsError('internal', 'Something went wrong. Please try again.');
    }
  });

export const redeemActivationCode = wrap(handlers.redeemActivationCode);
export const recordConsent = wrap(handlers.recordConsent);
export const submitIntake = wrap(handlers.submitIntake);
export const saveResponse = wrap(handlers.saveResponse);
export const submitMeasure = wrap(handlers.submitMeasure);
export const createRequest = wrap(handlers.createRequest);
export const myQuestionnaires = wrap(handlers.myQuestionnaires);
export const listActivationCodes = wrap(handlers.listActivationCodes);
export const issueActivationCode = wrap(handlers.issueActivationCode);
export const setClientType = wrap(handlers.setClientType);
export const setStage = wrap(handlers.setStage);
export const assignMeasure = wrap(handlers.assignMeasure);
export const releaseResults = wrap(handlers.releaseResults);
export const saveFormulationDraft = wrap(handlers.saveFormulationDraft);
export const releaseFormulation = wrap(handlers.releaseFormulation);
export const respondToFormulation = wrap(handlers.respondToFormulation);
export const setNextSession = wrap(handlers.setNextSession);
export const setResources = wrap(handlers.setResources);
export const closeRequest = wrap(handlers.closeRequest);
export const markFlagsFollowedUp = wrap(handlers.markFlagsFollowedUp);
export const createSchedule = wrap(handlers.createSchedule);
export const updateSchedule = wrap(handlers.updateSchedule);
export const searchSplosePatients = wrap(handlers.searchSplosePatients);
export const linkSplosePatient = wrap(handlers.linkSplosePatient);
export const unlinkSplosePatient = wrap(handlers.unlinkSplosePatient);
export const syncSploseClient = wrap(handlers.syncSploseClient);

// hasClientHub is the 1 function another site calls, so it has its own
// options: the Learning Hub origins are allowed here and nowhere else, it
// needs no secret, and a failure logs the error code only, never who asked
// or what the answer was (decision 60).
const sharedLoginOptions = {
  cors: [
    /^https:\/\/learn\.executiveframe\.co\.nz$/,
    /^https:\/\/executiveframe-learninghub\.(web\.app|firebaseapp\.com)$/,
    /^https:\/\/clients\.executiveframe\.co\.nz$/,
    /^https:\/\/executiveframe-clienthub\.(web\.app|firebaseapp\.com)$/,
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  ],
};
export const hasClientHub = onCall(sharedLoginOptions, async (request) => {
  try {
    return await handlers.hasClientHub(request);
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.error('hasClientHub failed', { code: e?.code ?? 'unknown' });
    throw new HttpsError('internal', 'Something went wrong. Please try again.');
  }
});

export const runCheckIns = onSchedule({ schedule: '0 7 * * *', timeZone: 'Pacific/Auckland', retryCount: 2 }, async () => {
  const summary = await handlers.runDueSchedules();
  logger.info('Check in schedules run', summary);
});

async function sploseRun() {
  const summary = await handlers.runSploseSync();
  if (summary.error) logger.error('Splose sync stopped', summary);
  else logger.info('Splose sync run', summary);
}
const sploseOptions = { timeZone: 'Pacific/Auckland', secrets: [SPLOSE_API_KEY], retryCount: 0 };
export const runSploseSync = onSchedule({ ...sploseOptions, schedule: '*/15 7-21 * * *' }, sploseRun);
export const runSploseSyncNight = onSchedule({ ...sploseOptions, schedule: '0 22,23,0-6 * * *' }, sploseRun);
