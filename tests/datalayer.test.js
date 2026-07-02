'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app.js');

const app = loadApp();

// ── CostItem-Migration ───────────────────────────────────────────────────────

test('migrateCostItem: Legacy Stunden/Rate + Extras → lines, Summe korrekt', () => {
    // Im Legacy-Modal waren Stunden/Rate und mainAmount ein Entweder-oder-
    // Toggle: sind hours+hourlyRate gesetzt, wird mainAmount NICHT zusätzlich
    // als Zeile emittiert.
    const legacy = {
        id: 'ci1', projectId: 'p1', empId: 'e1',
        type: 'Reisekosten', mainAmount: 100,
        hours: 8, hourlyRate: 80,
        extraCosts: [{ id: 'ec1', type: 'Hotel', amount: '120.50' }],
    };
    const m = app.migrateCostItem(legacy);
    assert.equal(m.lines.length, 2);
    assert.equal(m.amount, 8 * 80 + 120.5);
    assert.equal(m.type, undefined);
    assert.equal(m.extraCosts, undefined);
    assert.equal(m.lines.find(l => l.type === 'hours').amount, 640);
});

test('migrateCostItem: Legacy mainAmount ohne Stunden → typisierte Zeile', () => {
    const m = app.migrateCostItem({ id: 'ci2', projectId: 'p1', type: 'Reisekosten', mainAmount: 100 });
    assert.equal(m.lines.length, 1);
    assert.equal(m.lines[0].type, 'travel');
    assert.equal(m.amount, 100);
});

test('migrateCostItem: idempotent – zweite Migration ändert nichts', () => {
    const legacy = { id: 'ci1', projectId: 'p1', type: 'Sonstiges', mainAmount: 50 };
    const once = app.migrateCostItem(legacy);
    const twice = app.migrateCostItem(once);
    assert.deepEqual(twice, once);
});

test('migrateCostItem: null/leere Eingaben crashen nicht', () => {
    assert.equal(app.migrateCostItem(null), null);
    const m = app.migrateCostItem({ id: 'x', projectId: 'p' });
    assert.deepEqual(m.lines, []);
    assert.equal(m.amount, 0);
});

// ── Split-Dateien: Roundtrip ─────────────────────────────────────────────────

const sampleState = () => ({
    employees: [
        { id: 'e1', name: 'Anna', category: 'AS' },
        { id: 'e2', name: 'Ben',  category: 'CMS' },
        { id: 'e3', name: 'Cleo' }, // ohne Team → 'Other'
    ],
    projects: [{ id: 'p1', name: 'Turbine' }],
    assignments: [
        { id: 'a1', empId: 'e1', week: '2026-W01', type: 'project', reference: 'p1' },
        { id: 'a2', empId: 'e3', week: '2026-W02', type: 'support', reference: '24/7 Support' },
    ],
    costItems: [{ id: 'c1', projectId: 'p1', empId: 'e2', lines: [], amount: 0 }],
    empCategories: ['AS', 'CMS', 'Other'],
    projCategories: ['Wind'],
    projTypes: ['MW'],
    basicTasks: ['Office'], basicTasksMeta: {},
    inactiveBasicTasks: [], offtimeTasks: ['Urlaub'], inactiveOfftimeTasks: [],
    inactiveSupportTasks: [], inactiveTrainingTasks: [], customTrainingTasks: [],
    invoiceRecipient: 'buchhaltung@example.com',
    empAliases: { 'jakub mechlinski': 'e1' },
    fxRates: { PLN: 0.23 },
    appUsers: [{ id: 'admin', role: 'admin', pinHash: 'h', pinSalt: 's', pinAlgo: 'pbkdf2-100k' }],
    auditLog: [{ id: 'log1', timestamp: '2026-01-01' }],
    autoBackup: { intervalMin: 60 },
    emailTemplate: null,
});

test('buildSplitFiles: Zuweisungen landen in der Datei ihres Teams', () => {
    const files = app.buildSplitFiles(sampleState());
    assert.deepEqual(files['assignments-AS.json'].assignments.map(a => a.id), ['a1']);
    assert.deepEqual(files['assignments-Other.json'].assignments.map(a => a.id), ['a2']);
    assert.deepEqual(files['cost-items-CMS.json'].costItems.map(c => c.id), ['c1']);
    assert.deepEqual(files['users.json'].appUsers.map(u => u.id), ['admin']);
});

test('buildSplitFiles: _needsSeed-Platzhalter werden nicht persistiert', () => {
    const st = sampleState();
    st.appUsers = [{ id: 'admin', role: 'admin', _needsSeed: true }];
    const files = app.buildSplitFiles(st);
    assert.deepEqual(files['users.json'].appUsers, []);
});

test('buildSplitFiles → mergeSplitFiles: verlustfreier Roundtrip', () => {
    const state = sampleState();
    const files = app.buildSplitFiles(state);
    const assignmentsByTeam = {};
    const costItemsByTeam = {};
    for (const [fn, payload] of Object.entries(files)) {
        if (fn.startsWith('assignments-')) assignmentsByTeam[fn.slice(12, -5)] = payload.assignments;
        if (fn.startsWith('cost-items-'))  costItemsByTeam[fn.slice(11, -5)]  = payload.costItems;
    }
    const merged = app.mergeSplitFiles({
        employees: files['employees.json'].employees,
        projects:  files['projects.json'].projects,
        settings:  files['settings.json'],
        categoryDefs: files['category-defs.json'],
        tasks:     files['tasks.json'],
        inactive:  files['inactive.json'],
        users:     files['users.json'],
        audit:     files['audit.json'],
        assignmentsByTeam, costItemsByTeam,
    });
    assert.deepEqual(new Set(merged.assignments.map(a => a.id)), new Set(['a1', 'a2']));
    assert.deepEqual(merged.employees, state.employees);
    assert.deepEqual(merged.projects, state.projects);
    assert.deepEqual(merged.empCategories, state.empCategories);
    assert.deepEqual(merged.appUsers, state.appUsers);
    assert.deepEqual(merged.auditLog, state.auditLog);
    assert.equal(merged.invoiceRecipient, state.invoiceRecipient);
    // Spesen-Import-Felder überleben den Roundtrip (settings.json)
    assert.deepEqual(merged.empAliases, state.empAliases);
    assert.deepEqual(merged.fxRates, state.fxRates);
});

test('mergeSplitFiles: Fallback-Kaskade auf legacy categories.json', () => {
    const merged = app.mergeSplitFiles({
        settings: {},
        categories: { empCategories: ['LegacyTeam'], basicTasks: ['Alt'] },
        assignmentsByTeam: {}, costItemsByTeam: {},
    });
    assert.deepEqual(merged.empCategories, ['LegacyTeam']);
    assert.deepEqual(merged.basicTasks, ['Alt']);
});

// ── saveSplitState: Diff-Writes, Wipe-Guard, meta.json-Marker ────────────────

const runSave = async (state, lastSaved) => {
    const writes = [];
    await app.saveSplitState(state, lastSaved, async (fn, payload) => {
        writes.push(fn);
    });
    return writes;
};

test('saveSplitState: schreibt nur geänderte Dateien, meta.json zuletzt', async () => {
    const state = sampleState();
    const lastSaved = {};
    app.seedLastSaved(state, lastSaved);
    // Nichts geändert → keine Writes, auch kein meta.json.
    assert.deepEqual(await runSave(state, lastSaved), []);

    // Ein Projekt ändern → genau projects.json + meta.json.
    const st2 = { ...state, projects: [{ id: 'p1', name: 'Turbine XL' }] };
    const writes = await runSave(st2, lastSaved);
    assert.deepEqual(writes, ['projects.json', 'meta.json']);
    assert.equal(writes[writes.length - 1], 'meta.json');
});

test('saveSplitState: Wipe-Guard blockt non-empty → empty', async () => {
    const state = sampleState();
    const lastSaved = {};
    app.seedLastSaved(state, lastSaved);

    const wiped = { ...state, employees: [], appUsers: [] };
    const writes = await runSave(wiped, lastSaved);
    assert.ok(!writes.includes('employees.json'), 'employees.json darf nicht gewiped werden');
    assert.ok(!writes.includes('users.json'), 'users.json darf nicht gewiped werden');
    // lastSaved unangetastet → nächster Save mit echten Daten geht durch.
    assert.ok(JSON.parse(lastSaved['employees.json']).employees.length > 0);
});

test('saveSplitState: entferntes Team wird geleert (kein Datenrest)', async () => {
    const state = sampleState();
    const lastSaved = {};
    app.seedLastSaved(state, lastSaved);
    // Team AS verschwindet aus den Kategorien und hat keine Zuweisungen mehr.
    const st2 = { ...state, empCategories: ['CMS', 'Other'],
        employees: state.employees.filter(e => e.id !== 'e1'),
        assignments: state.assignments.filter(a => a.empId !== 'e1') };
    const writes = await runSave(st2, lastSaved);
    assert.ok(writes.includes('assignments-AS.json'), 'AS-Datei muss geleert werden');
    assert.deepEqual(JSON.parse(lastSaved['assignments-AS.json']), { assignments: [] });
});

test('saveSplitState: Rückgabewert = Anzahl geschriebener Dateien (ohne meta.json)', async () => {
    const state = sampleState();
    const lastSaved = {};
    app.seedLastSaved(state, lastSaved);
    assert.equal(await app.saveSplitState(state, lastSaved, async () => {}), 0);
    const st2 = { ...state, projects: [{ id: 'p1', name: 'Turbine XL' }] };
    assert.equal(await app.saveSplitState(st2, lastSaved, async () => {}), 1);
});

// ── pLimit ───────────────────────────────────────────────────────────────────

test('pLimit: hält das Parallelitätslimit ein und führt alle Tasks aus', async () => {
    let running = 0, peak = 0, done = 0;
    const tasks = Array.from({ length: 10 }, () => async () => {
        running++; peak = Math.max(peak, running);
        await new Promise(r => setTimeout(r, 5));
        running--; done++;
    });
    await app.pLimit(tasks, 4);
    assert.equal(done, 10);
    assert.ok(peak <= 4, `peak=${peak}`);
});
