// Firebase web app settings for project ef-client-hub.
// These values identify the project and are not secret; access is
// controlled by Authentication and the security rules.
// Charlotte: replace the placeholders with the values from the Firebase
// console, Project settings, Your apps, for the Client Hub web app.

export const firebaseConfig = {
  apiKey: 'AIzaSyDDzJ4W5VliWxKjRYxvfMEkLsTNrOYkr1U',
  // Switch to 'clients.executiveframe.co.nz' once the custom domain is live.
  authDomain: 'executiveframe-clienthub.web.app',
  projectId: 'ef-client-hub',
  storageBucket: 'executiveframe-clienthub',
  messagingSenderId: '311513487129',
  appId: '1:311513487129:web:b99595a1248a80a2429788',
};

export const FIRESTORE_DATABASE = 'clienthub';
export const FUNCTIONS_REGION = 'australia-southeast1';
