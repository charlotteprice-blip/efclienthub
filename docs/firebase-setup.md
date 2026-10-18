# Firebase setup

From an empty Firebase project to a working Client Hub. Every step runs in the terminal on Charlotte's Mac, from inside the repository folder, except the 3 marked as browser steps.

## 1. Install the tools (once per computer)

```
brew install node@22 openjdk@21
brew install --cask google-cloud-sdk
git clone https://github.com/charlotteprice-blip/efclienthub.git
cd efclienthub
npm install
```

`npm install` also installs the Cloud Functions packages.

## 2. The Firebase project (browser step)

The project `ef-client-hub` (EF Client Hub) is created. In the console: upgrade it to the Blaze plan with a NZ$10 monthly budget alert, add Sarah as Owner under Users and permissions, and open Authentication once, press Get started and switch on Email/Password under Sign-in method.

## 3. Log in

```
npx firebase login
gcloud auth login
gcloud auth application-default login
gcloud config set project ef-client-hub
gcloud auth application-default set-quota-project ef-client-hub
```

If `npx firebase login` says it is already logged in from earlier work but `npm run setup:check` reports that the Firebase CLI cannot list projects, the stored login has gone stale. Run `npx firebase login --reauth` and sign in again.

## 4. Create everything else

```
npm run setup:check
npm run setup
```

`setup` asks before each change. It switches on the Google services, creates the `clienthub` database in Sydney with backups and delete protection, creates and links the Hosting site and Storage bucket, registers the web app and writes `public/js/firebase-config.js`, switches on email and password sign in and authorises the sign in addresses, switches on audit logs, adds `clients.executiveframe.co.nz`, and lists who has broad access. Run `npm run setup:check` again afterwards; every line should read done, apart from the domain, which waits for DNS.

## 5. Allow the sample questionnaires while testing

Create `functions/.env.ef-client-hub` containing:

```
ALLOW_SAMPLE_MEASURES=true
```

Change it to `false` and deploy the functions again before real clients are invited.

## 6. Deploy

```
npm run deploy:rules
npm run deploy:functions
npm run deploy:hosting
```

The first functions deploy takes several minutes and may ask to switch on more Google services; answer yes. The deploy also creates the daily check in job in Cloud Scheduler (`runCheckIns`, 7am New Zealand time). When it asks how many days to keep container images, accept 1. The app is then live at https://executiveframe-clienthub.web.app.

If the deploy ends with "Failed to set invoker" or "Failed to set the IAM Policy on the Service", the organisation's domain restricted sharing policy is stopping browsers from calling the functions. Callable functions are designed to be reachable by any browser; each one checks the Firebase login itself and refuses anyone who is not signed in. `npm run setup -- --only=orgpolicy` sets a project level exception to that policy for ef-client-hub only (it needs the Organization Policy Administrator role on the organisation), and `npm run setup -- --only=invokers` then opens every callable function that was deployed while the policy was in force. Run `npm run deploy:functions` again afterwards.

If every function fails with "missing permission on the build service account", the project's default service account has not been given access, which is normal for projects created inside a Google organisation. `npm run setup -- --only=functionsaccess` grants it the 3 roles it needs (build, Firestore access and logging); then run `npm run deploy:functions` again.

## 7. Staff accounts

Sarah and Charlotte each create an account at https://executiveframe-clienthub.web.app/signup (browser step; they stop at the activation code screen, which is expected). Then:

```
npm run roles -- set sarah@... practitioner
npm run roles -- set charlotte@... admin
npm run roles -- list
```

Each logs out and back in. Sarah now lands on Clients; Charlotte on Activation codes.

## 8. Load questionnaires

```
npm run measures -- upload public/sample/sample-measures.json     testing only
npm run measures -- list
```

Real questionnaires come from the EF Client Hub Codebook (`measures/ef-client-hub-codebook.xlsx`, see measures/README.md). `npm run codebook` rebuilds `measures/library.json` and `measures/cleared.json` from it, and `npm run measures -- upload measures/cleared.json` loads the cleared ones. Only questionnaires marked cleared in the workbook's Hub Library sheet can be assigned.

## 9. Test the journey

1. Sarah issues a code for a test client from Activation codes.
2. In a private browser window, sign up as the test client with a different email, enter the code, agree, answer the intake.
3. Sarah assigns both sample questionnaires; the test client completes them and reaches the booking step.
4. Sarah reviews the drafts, releases results and a formulation; the test client sees them.

## 10. Connect the domain (DNS is a browser step)

`npm run setup:check` prints the DNS records for `clients.executiveframe.co.nz`. Add them at the DNS host for executiveframe.co.nz and log the change in the Site Changes Log. Once `setup:check` shows the domain as done, change `authDomain` in `public/js/firebase-config.js` to `clients.executiveframe.co.nz` and run `npm run deploy:hosting`.

## Before real clients

1. `npm run test:rules` passes (needs Java 21).
2. `ALLOW_SAMPLE_MEASURES=false`, functions redeployed, and the sample questionnaires replaced by cleared ones.
3. `bookingUrl` in `public/config/app.json` set to Sarah's Splose booking page.
4. Sarah has approved the consent, intake and journey wording.
5. `public/sample` and `public/preview` removed or kept deliberately.
6. Open questions in docs/decisions.md answered.

## Working without Firebase

`npm run harness` runs the live app at http://localhost:5174 against an in memory stand in for Firebase that uses the real function logic. Practitioner login: sarah@example.com / sample-pass. Admin: charlotte@example.com / sample-pass.
