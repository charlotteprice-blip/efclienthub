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
//                releaseFormulation, closeRequest

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineBoolean } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { makeHandlers } from './handlers.js';

setGlobalOptions({ region: 'australia-southeast1', maxInstances: 10 });
initializeApp();

const readJson = (file) => JSON.parse(readFileSync(new URL(`./shared/${file}`, import.meta.url), 'utf8'));

// Set ALLOW_SAMPLE_MEASURES=true in functions/.env.ef-client-hub only
// while testing with the invented sample questionnaires.
const ALLOW_SAMPLE_MEASURES = defineBoolean('ALLOW_SAMPLE_MEASURES', { default: false });

const handlers = makeHandlers({
  db: getFirestore('clienthub'),
  intakeConfig: readJson('intake.json'),
  clientTypes: readJson('client-types.json'),
  allowSample: () => ALLOW_SAMPLE_MEASURES.value(),
});

const options = {
  cors: [
    /^https:\/\/clients\.executiveframe\.co\.nz$/,
    /^https:\/\/executiveframe-clienthub\.(web\.app|firebaseapp\.com)$/,
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  ],
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
export const issueActivationCode = wrap(handlers.issueActivationCode);
export const setClientType = wrap(handlers.setClientType);
export const setStage = wrap(handlers.setStage);
export const assignMeasure = wrap(handlers.assignMeasure);
export const releaseResults = wrap(handlers.releaseResults);
export const saveFormulationDraft = wrap(handlers.saveFormulationDraft);
export const releaseFormulation = wrap(handlers.releaseFormulation);
export const closeRequest = wrap(handlers.closeRequest);
