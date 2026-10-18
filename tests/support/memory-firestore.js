// A small in memory stand in for the parts of the Firestore Admin SDK the
// Client Hub functions use: doc, collection, add, where (== and in), get,
// set (with merge), update (with dotted paths), batch and runTransaction.
// where supports ==, in, <, <=, > and >=; a missing field never matches a
// range, as in Firestore.
// Used by the function tests and the end to end harness. Rules are not
// applied here; tests/rules.test.js covers them in the real emulator.

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
let counter = 0;
const autoId = () => `id${(counter += 1).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function createMemoryFirestore() {
  const store = new Map(); // path -> data

  function setPath(obj, dotted, value) {
    const keys = dotted.split('.');
    let o = obj;
    for (const k of keys.slice(0, -1)) {
      if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
      o = o[k];
    }
    o[keys.at(-1)] = value;
  }

  const snapshot = (ref) => ({
    id: ref.id,
    ref,
    exists: store.has(ref.path),
    data: () => clone(store.get(ref.path)),
  });

  function docRef(path) {
    const parts = path.split('/');
    const ref = {
      path,
      id: parts.at(-1),
      async get() {
        return snapshot(ref);
      },
      async set(data, opts = {}) {
        const base = opts.merge && store.has(path) ? store.get(path) : {};
        store.set(path, { ...base, ...clone(data) });
      },
      async update(data) {
        if (!store.has(path)) throw Object.assign(new Error(`No document to update: ${path}`), { code: 5 });
        const doc = store.get(path);
        for (const [k, v] of Object.entries(data)) setPath(doc, k, clone(v));
      },
      async delete() {
        store.delete(path);
      },
    };
    return ref;
  }

  function query(name, filters = []) {
    return {
      where(field, op, value) {
        return query(name, [...filters, { field, op, value }]);
      },
      async get() {
        const docs = [...store.entries()]
          .filter(([p]) => p.startsWith(`${name}/`) && p.split('/').length === 2)
          .filter(([, d]) =>
            filters.every(({ field, op, value }) => {
              const v = field.split('.').reduce((o, k) => o?.[k], d);
              if (op === '==') return v === value;
              if (op === 'in') return value.includes(v);
              if (v === undefined || v === null) return false;
              if (op === '<') return v < value;
              if (op === '<=') return v <= value;
              if (op === '>') return v > value;
              if (op === '>=') return v >= value;
              throw new Error(`Unsupported operator ${op}`);
            }),
          )
          .map(([p]) => snapshot(docRef(p)));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    };
  }

  const db = {
    store,
    doc: (path) => docRef(path),
    collection(name) {
      return {
        ...query(name),
        doc: (id = autoId()) => docRef(`${name}/${id}`),
        async add(data) {
          const ref = docRef(`${name}/${autoId()}`);
          await ref.set(data);
          return ref;
        },
      };
    },
    batch() {
      const ops = [];
      return {
        set: (ref, data, opts) => ops.push(() => ref.set(data, opts)),
        update: (ref, data) => ops.push(() => ref.update(data)),
        async commit() {
          for (const op of ops) await op();
        },
      };
    },
    async runTransaction(fn) {
      const ops = [];
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, data, opts) => ops.push(() => ref.set(data, opts)),
        update: (ref, data) => ops.push(() => ref.update(data)),
      };
      const result = await fn(tx);
      for (const op of ops) await op();
      return result;
    },
    // Helpers for tests and the harness.
    read: (path) => clone(store.get(path)),
    list(name) {
      return [...store.entries()].filter(([p]) => p.startsWith(`${name}/`) && p.split('/').length === 2).map(([p, d]) => ({ id: p.split('/')[1], ...clone(d) }));
    },
  };
  return db;
}
