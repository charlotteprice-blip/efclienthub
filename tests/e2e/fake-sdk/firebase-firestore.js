// Test stand in for the Firestore web SDK reads, backed by tests/e2e/server.mjs.
async function post(path, body) {
  const res = await fetch(`/__fake/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}
export const getFirestore = () => ({});
export const connectFirestoreEmulator = () => {};
export const doc = (_db, ...segments) => ({ path: segments.join('/') });
export const collection = (_db, name) => ({ collection: name, constraints: [] });
export const where = (field, op, value) => ({ type: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ type: 'orderBy', field, dir });
export const query = (col, ...constraints) => ({ collection: col.collection, constraints });
export async function getDoc(ref) {
  const { data } = await post('get', { path: ref.path });
  return { id: ref.path.split('/').pop(), exists: () => data !== null, data: () => data };
}
export async function getDocs(q) {
  const { docs } = await post('query', { collection: q.collection, constraints: q.constraints ?? [] });
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}
