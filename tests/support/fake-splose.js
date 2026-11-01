// A stand in for the Splose API client in functions/splose.js, with the
// same read methods, for the function tests and the end to end harness.
// Fixture data is invented: no real patient appears here.

export function createFakeSplose({ patients = [], appointments = [], forms = [], cases = [], services = [], fail = null } = {}) {
  const state = { calls: 0, fail };
  const count = () => {
    state.calls += 1;
    if (state.fail) throw state.fail;
  };
  const forPatient = (list, patientId) => list.filter((x) => Number(x.patientId) === Number(patientId));
  return {
    get calls() {
      return state.calls;
    },
    set fail(e) {
      state.fail = e;
    },
    async patient(id) {
      count();
      const p = patients.find((x) => Number(x.id) === Number(id));
      if (!p) throw Object.assign(new Error('Not found in Splose.'), { name: 'SploseError', status: 404 });
      return p;
    },
    async patients({ firstname, lastname, email } = {}) {
      count();
      const has = (v, q) => !q || String(v ?? '').toLowerCase().includes(String(q).toLowerCase());
      return patients.filter((p) => has(p.firstname, firstname) && has(p.lastname, lastname) && has(p.email, email));
    },
    async appointments({ patientId, start_gt } = {}) {
      count();
      const since = start_gt ? Date.parse(start_gt) : 0;
      return appointments.filter((a) => (!patientId || (a.appointmentPatients ?? []).some((p) => Number(p.patientId) === Number(patientId))) && Date.parse(a.start) > since);
    },
    async patientForms({ patientId } = {}) {
      count();
      return patientId ? forPatient(forms, patientId) : forms;
    },
    async cases({ patientId } = {}) {
      count();
      return patientId ? forPatient(cases, patientId) : cases;
    },
    async services() {
      count();
      return services;
    },
  };
}

// A small practice: 4 services, 2 patients, a run of appointments and forms.
// Times are given relative to `now` so the harness always has an upcoming
// session.
export function sampleSplose(now = Date.now()) {
  const h = 60 * 60 * 1000;
  const d = 24 * h;
  const iso = (t) => new Date(t).toISOString();
  const appt = (id, patientId, serviceId, at, status) => ({
    id,
    start: iso(at),
    end: iso(at + h),
    serviceId,
    locationId: 1,
    practitionerId: 1,
    maxPatients: 1,
    appointmentPatients: [{ appointmentId: id, patientId, caseId: null, status, note: null, doNotInvoice: false, invoiceId: null, cancellationReason: null, cancellationRate: null, cancellationNote: null, statusUpdatedAt: null }],
    archived: false,
    deletedAt: null,
    createdAt: iso(at - 7 * d),
    updatedAt: iso(at),
  });
  return createFakeSplose({
    services: [
      { id: 11, name: 'Initial consultation' },
      { id: 12, name: 'Assessment feedback' },
      { id: 13, name: 'Coaching session' },
      { id: 14, name: 'Review' },
    ],
    patients: [
      { id: 101, firstname: 'Alex', lastname: 'Sample', email: 'alex@example.com', archived: false },
      { id: 102, firstname: 'Sam', lastname: 'Sample', preferredName: 'Sammy', email: 'sam@example.com', archived: false },
      { id: 103, firstname: 'Dev', lastname: 'Test', email: 'dev.test@example.com', archived: false },
    ],
    appointments: [
      appt(1, 101, 11, now - 30 * d, 'Completed'),
      appt(2, 101, 12, now - 10 * d, 'Arrived'),
      appt(3, 101, 13, now - 3 * d, 'Did not arrive'),
      appt(4, 101, 13, now + 4 * d, null),
      appt(5, 101, 13, now + 18 * d, null),
      appt(6, 102, 11, now + 2 * d, null),
      appt(7, 103, 11, now - 20 * d, 'Completed'),
      appt(8, 103, 12, now + 6 * d, null),
    ],
    forms: [
      { id: 501, title: 'Client intake form', patientId: 101, status: 'Completed', submittedAt: iso(now - 29 * d).replace(/^(\d{4})-(\d{2})-(\d{2})T/, '$1:$2:$3 ').slice(0, 19), createdAt: iso(now - 31 * d), archived: false },
      { id: 502, title: 'Sleep diary', patientId: 101, status: 'Incomplete', submittedAt: null, createdAt: iso(now - 9 * d), archived: false },
      { id: 503, title: 'Client intake form', patientId: 102, status: 'In progress', submittedAt: null, createdAt: iso(now - 1 * d), archived: false },
    ],
    cases: [{ id: 901, patientId: 101, isOpen: true, trackType: 'Appointments', appointmentCount: 10, hours: null, expiryDate: null }],
  });
}
