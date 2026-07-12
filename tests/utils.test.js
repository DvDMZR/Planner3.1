'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app.js');

const app = loadApp();

// ── ISO-Wochen-Logik ─────────────────────────────────────────────────────────

test('getWeekString: bekannte Fixpunkte', () => {
    // 2026-01-01 ist ein Donnerstag → KW 1 von 2026.
    assert.equal(app.getWeekString(new Date(2026, 0, 1)), '2026-W01');
    // 2024-12-30 (Montag) gehört zu KW 1 von 2025.
    assert.equal(app.getWeekString(new Date(2024, 11, 30)), '2025-W01');
    // 2027-01-01 (Freitag) gehört noch zu KW 53 von 2026 (53-Wochen-Jahr).
    assert.equal(app.getWeekString(new Date(2027, 0, 1)), '2026-W53');
});

test('addWeeks: läuft korrekt über die Jahresgrenze eines 53-Wochen-Jahres', () => {
    assert.equal(app.addWeeks('2026-W52', 1), '2026-W53');
    assert.equal(app.addWeeks('2026-W53', 1), '2027-W01');
    assert.equal(app.addWeeks('2027-W01', -1), '2026-W53');
});

test('addWeeks: DST-Umstellung (Oktober) driftet nicht', () => {
    // Wochenintervalle über die Sommer-/Winterzeit-Umstellung müssen exakt
    // 7-Tage-Schritte bleiben (historischer Bug, siehe Changelog v0.7.3.1).
    let w = '2026-W42'; // Mitte Oktober
    for (let i = 0; i < 6; i++) w = app.addWeeks(w, 1);
    assert.equal(w, '2026-W48');
});

test('weekIdToMonday/getWeekString: Roundtrip über ein ganzes Jahr', () => {
    let w = '2026-W01';
    for (let i = 0; i < 60; i++) {
        const monday = app.weekIdToMonday(w);
        assert.equal(app.getWeekString(new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate())), w);
        w = app.addWeeks(w, 1);
    }
});

test('compareWeekIds: numerischer Vergleich, defensiv bei Müll', () => {
    assert.ok(app.compareWeekIds('2026-W02', '2026-W10') < 0);
    assert.ok(app.compareWeekIds('2026-W53', '2027-W01') < 0);
    assert.equal(app.compareWeekIds('2026-W05', '2026-W05'), 0);
    // Ungepaddet vs. gepaddet – hier versagt der Lex-Vergleich, der Comparator nicht.
    assert.ok(app.compareWeekIds('2026-W9', '2026-W10') < 0);
    assert.equal(app.compareWeekIds(null, '2026-W01'), 0);
    assert.equal(app.compareWeekIds('kaputt', '2026-W01'), 0);
});

test('generateWeeksForYear: 2026 hat 53 Wochen, 2025 hat 52', () => {
    assert.equal(app.generateWeeksForYear(2026).length, 53);
    assert.equal(app.generateWeeksForYear(2025).length, 52);
});

test('formatKW: kompakte Anzeige, defensiv bei Müll', () => {
    assert.equal(app.formatKW('2026-W05'), 'KW 5/26');
    assert.equal(app.formatKW(null), '?');
    assert.equal(app.formatKW('unfug'), 'unfug');
});

// ── Länder-Auflösung ─────────────────────────────────────────────────────────

test('resolveCountryCode: ISO-Code, Klartext, Umlaute, leer, Unsinn', () => {
    assert.equal(app.resolveCountryCode('de'), 'DE');
    assert.equal(app.resolveCountryCode('Deutschland'), 'DE');
    assert.equal(app.resolveCountryCode('Österreich'), 'AT');
    assert.equal(app.resolveCountryCode('oesterreich'), 'AT');
    assert.equal(app.resolveCountryCode(''), '/');
    assert.equal(app.resolveCountryCode(null), '/');
    assert.equal(app.resolveCountryCode('Mordor'), '??');
});

// ── Zuweisungs-Stunden ───────────────────────────────────────────────────────

test('getAssignmentHours: hours direkt, percent-Fallback, Default-Wochenstunden', () => {
    assert.equal(app.getAssignmentHours({ hours: 17.5 }, 35), 17.5);
    assert.equal(app.getAssignmentHours({ percent: 50 }, 35), 17.5);
    assert.equal(app.getAssignmentHours({}, 40), 40);       // percent default 100
    assert.equal(app.getAssignmentHours({ percent: 50 }, 0), 20); // 0 → HOURS_PER_WEEK=40
});

// ── Session-/Import-Validierung ──────────────────────────────────────────────

test('validateRestoredSession: nur minimal korrekte Shapes passieren', () => {
    assert.deepEqual(app.validateRestoredSession({ id: 'u1', name: 'A', role: 'admin' }),
        { id: 'u1', name: 'A', role: 'admin' });
    assert.equal(app.validateRestoredSession({ id: 'u1', name: 'A', role: 'superadmin' }), null);
    assert.equal(app.validateRestoredSession({ name: 'A', role: 'admin' }), null);
    assert.equal(app.validateRestoredSession('kaputt'), null);
    assert.equal(app.validateRestoredSession(null), null);
});

test('validateImportedState: droppt unbekannte Keys und appUsers', () => {
    const r = app.validateImportedState({
        employees: [{ id: 'e1', name: 'X' }],
        appUsers: [{ id: 'admin', pinHash: 'böse' }],
        __proto__polluted: true,
        evilKey: 'x',
    });
    assert.equal(r.ok, true);
    assert.equal(r.data.appUsers, undefined);
    assert.equal(r.data.evilKey, undefined);
    assert.ok(r.droppedKeys.includes('appUsers'));
    assert.ok(r.droppedKeys.includes('evilKey'));
    assert.equal(r.data.employees.length, 1);
});

test('validateImportedState: Zeilen-Guards und Typ-Prüfungen', () => {
    const r = app.validateImportedState({
        assignments: [
            { empId: 'e1', week: '2026-W01', type: 'project' },
            { empId: 42, week: '2026-W01', type: 'project' },   // falscher Typ
            'kaputt', null,
        ],
        projects: 'kein-array',
        basicTasksMeta: ['array statt map'],
        invoiceRecipient: 42,
    });
    assert.equal(r.ok, true);
    assert.equal(r.data.assignments.length, 1);
    assert.equal(r.data.projects, undefined);
    assert.equal(r.data.basicTasksMeta, undefined);
    assert.equal(r.data.invoiceRecipient, undefined);
});

test('validateImportedState: neuere Schema-Version wird abgelehnt', () => {
    const r = app.validateImportedState({ schemaVersion: app.SCHEMA_VERSION + 1 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'futureVersion');
});

test('validateImportedState: costItems ohne projectId (interne KST-Kosten) überleben', () => {
    const r = app.validateImportedState({
        costItems: [
            { id: 'c1', projectId: 'p1', empId: 'e1', lines: [], amount: 0 },
            { id: 'c2', projectId: null, empId: 'e1', lines: [], amount: 0 },  // intern
            { id: 'c3', empId: 'e1', lines: [], amount: 0 },                   // projectId fehlt ganz
            { id: 'c4', projectId: 'p1', lines: [], amount: 0 },               // KEINE empId → raus
            { id: 'c5', projectId: 42, empId: 'e1' },                          // kaputter Typ → raus
        ],
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.data.costItems.map(c => c.id), ['c1', 'c2', 'c3']);
});

test('validateImportedState: teamKst/accountingRecipient werden validiert übernommen', () => {
    const ok = app.validateImportedState({
        teamKst: { AS: '4711' },
        accountingRecipient: 'buchhaltung@example.com',
    });
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.data.teamKst, { AS: '4711' });
    assert.equal(ok.data.accountingRecipient, 'buchhaltung@example.com');

    const bad = app.validateImportedState({
        teamKst: ['array statt map'],
        accountingRecipient: 42,
    });
    assert.equal(bad.ok, true);
    assert.equal(bad.data.teamKst, undefined);
    assert.equal(bad.data.accountingRecipient, undefined);
});

// ── Audit-Merge ──────────────────────────────────────────────────────────────

test('mergeAuditLogs: Union per id, neueste zuerst, Cap 500', () => {
    const a = [{ id: '1', timestamp: '2026-01-01' }, { id: '2', timestamp: '2026-01-03' }];
    const b = [{ id: '2', timestamp: '2026-01-03' }, { id: '3', timestamp: '2026-01-02' }];
    const m = app.mergeAuditLogs(a, b);
    assert.deepEqual(m.map(e => e.id), ['2', '3', '1']);

    const big = Array.from({ length: 600 }, (_, i) => ({ id: `x${i}`, timestamp: `t${i}` }));
    assert.equal(app.mergeAuditLogs(big, []).length, 500);
    assert.equal(app.mergeAuditLogs([{ id: null }, { bogus: 1 }], []).length, 0);
});

// ── Team-Namen (werden zu Dateinamen) ────────────────────────────────────────

test('isValidTeamName: erlaubt reale Team-Namen, blockt Pfad-Zeichen', () => {
    for (const good of ['AS', 'I&C', 'CSS', 'Team 2', 'Nord-Ost', 'Team_A', 'Größe']) {
        assert.equal(app.isValidTeamName(good), true, good);
    }
    for (const bad of ['a/b', 'a\\b', '..', 'x..y', "O'Brien", 'a#b', 'a%b',
                       '', ' ', '-lead', 'x'.repeat(31), null, 42]) {
        assert.equal(app.isValidTeamName(bad), false, String(bad));
    }
});

// ── PIN-Hashing (Roundtrip, keine Sicherheitsbewertung) ──────────────────────

test('hashPin/verifyPin: Roundtrip und Ablehnung falscher PINs', async () => {
    const salt = app.generatePinSalt();
    const hash = await app.hashPin('1234', salt);
    assert.equal(await app.verifyPin('1234', hash, salt, 'pbkdf2-100k'), true);
    assert.equal(await app.verifyPin('9999', hash, salt, 'pbkdf2-100k'), false);
    assert.equal(await app.verifyPin('1234', null, salt, 'pbkdf2-100k'), false);
});

// ── Rechnungs-Status (abgeleitet, Prozess 1) ─────────────────────────────────

test('getInvoiceState: leitet den Rechnungs-Status korrekt ab', () => {
    // Kein Projekt / nichts passiert → offen
    assert.equal(app.getInvoiceState(null), 'open');
    assert.equal(app.getInvoiceState({}), 'open');
    // Export gelaufen (neuer wie Legacy-Wert) → exportiert
    assert.equal(app.getInvoiceState({ invoiceStatus: 'exportiert' }), 'exported');
    assert.equal(app.getInvoiceState({ invoiceStatus: 'x' }), 'exported');
    // Manuelles Häkchen "Kosten eingereicht" gewinnt immer
    assert.equal(app.getInvoiceState({ costsSubmitted: true }), 'submitted');
    assert.equal(app.getInvoiceState({ costsSubmitted: true, invoiceStatus: 'exportiert' }), 'submitted');
});

// ── Projekt-Budget (Soll/Ist-Ampel) ──────────────────────────────────────────

test('budgetUsage: Prozent und Ampel-Level', () => {
    // Kein/ungültiges/negatives Budget → keine Anzeige
    assert.equal(app.budgetUsage(null, 500), null);
    assert.equal(app.budgetUsage('', 500), null);
    assert.equal(app.budgetUsage(0, 500), null);
    assert.equal(app.budgetUsage(-100, 500), null);
    // Schwellen: <80 ok, 80–100 warn, >100 over
    assert.deepEqual(app.budgetUsage(1000, 500),  { pct: 50,  level: 'ok' });
    assert.deepEqual(app.budgetUsage(1000, 799),  { pct: 80,  level: 'ok' });   // Level nutzt ungerundete 79,9%
    assert.deepEqual(app.budgetUsage(1000, 800),  { pct: 80,  level: 'warn' });
    assert.deepEqual(app.budgetUsage(1000, 1000), { pct: 100, level: 'warn' });
    assert.deepEqual(app.budgetUsage(1000, 1010), { pct: 101, level: 'over' });
    // Budget als String (Formular-Altbestand) wird geparst
    assert.deepEqual(app.budgetUsage('2000', 500), { pct: 25, level: 'ok' });
    // Fehlende Ist-Kosten zählen als 0
    assert.deepEqual(app.budgetUsage(1000, undefined), { pct: 0, level: 'ok' });
});
