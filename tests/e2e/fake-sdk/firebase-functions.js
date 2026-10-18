// Test stand in for callable Cloud Functions, backed by tests/e2e/server.mjs.
export const getFunctions = () => ({});
export const connectFunctionsEmulator = () => {};
export function httpsCallable(_functions, name) {
  return async (data) => {
    const res = await fetch(`/__fake/call/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, uid: localStorage.getItem('fake-auth-uid') }),
    });
    const json = await res.json();
    if (!res.ok) throw Object.assign(new Error(json.message), { code: `functions/${json.code}` });
    return { data: json.result };
  };
}
