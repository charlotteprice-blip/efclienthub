// Grants, removes and lists Client Hub roles. Roles are custom claims on
// the shared Firebase account, read by firestore.rules:
//   practitioner  reads all client records, drafts and results (Sarah)
//   admin         runs codes, the library and config without reading
//                 clinical content (Charlotte's own account)
//
//   npm run roles -- list
//   npm run roles -- set sarah@example.com practitioner
//   npm run roles -- remove someone@example.com
//
// Needs Google application default credentials for an owner of the project:
//   gcloud auth application-default login
//
// The person must log out and back in before a change takes effect.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT = process.env.CLIENTHUB_PROJECT ?? 'ef-client-hub';
const ROLES = ['practitioner', 'admin'];
const [command, email, role] = process.argv.slice(2);

function usage(message) {
  if (message) console.error(`\n${message}`);
  console.error('\nUsage:\n  npm run roles -- list\n  npm run roles -- set <email> practitioner|admin\n  npm run roles -- remove <email>\n');
  process.exit(1);
}

if (!['list', 'set', 'remove'].includes(command)) usage();

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT });
const auth = getAuth(app);
const db = getFirestore(app, 'clienthub');

async function audit(action, target) {
  await db.collection('auditLog').add({ actorUid: 'terminal', action, targetUid: target, at: FieldValue.serverTimestamp() });
}

try {
  if (command === 'list') {
    let next;
    const rows = [];
    do {
      const page = await auth.listUsers(1000, next);
      for (const u of page.users) if (u.customClaims?.role) rows.push(`${u.customClaims.role.padEnd(13)} ${u.email ?? u.uid}`);
      next = page.pageToken;
    } while (next);
    console.log(rows.length ? `\n${rows.join('\n')}\n` : '\nNo one holds a Client Hub role yet.\n');
  } else {
    if (!email) usage('Give the email address of an existing account.');
    const user = await auth.getUserByEmail(email).catch(() => null);
    if (!user) usage(`No account uses ${email}. The person signs up once first, then you grant the role.`);
    const claims = { ...(user.customClaims ?? {}) };
    if (command === 'set') {
      if (!ROLES.includes(role)) usage(`Role must be ${ROLES.join(' or ')}.`);
      claims.role = role;
      await auth.setCustomUserClaims(user.uid, claims);
      await audit(`granted role ${role}`, user.uid);
      console.log(`\n${email} now holds the ${role} role. They need to log out and back in.\n`);
    } else {
      delete claims.role;
      await auth.setCustomUserClaims(user.uid, claims);
      await auth.revokeRefreshTokens(user.uid);
      await audit('removed role', user.uid);
      console.log(`\n${email} no longer holds a Client Hub role, and their sessions were ended.\n`);
    }
  }
} catch (e) {
  if (/credential|ADC|default credentials/i.test(e.message)) {
    usage('No Google credentials found. Run: gcloud auth application-default login');
  }
  console.error(`\n${e.message}\n`);
  process.exit(1);
}
