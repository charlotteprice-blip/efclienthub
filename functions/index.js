// Executive Frame Client Hub Cloud Functions (codebase "clienthub").
//
// Every function runs in australia-southeast1 and writes to the named
// Firestore database `clienthub` through the Admin SDK. Browsers never write
// to Firestore directly; see firestore.rules.
//
// Built in later stages (see docs/data-model.md for what each one writes):
//   stage 3  saveProfile            details and consent record
//            redeemActivationCode   12 characters, single use, 30 days
//            submitIntake           stores answers, sets client type
//   stage 4  submitMeasure          stores responses in scoring/{assignmentId}
//            scoreMeasure           applies scoringRules, stores a draft only
//            triggerBooking         returns the Splose booking address
//   stage 5  issueActivationCode    practitioner only
//            assignMeasure          practitioner only
//            setClientType          practitioner only
//            releaseResults         practitioner only, copies to results/{uid}
//
// Nothing is exported yet, so deploying this codebase creates no functions.

import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'australia-southeast1', maxInstances: 10 });
