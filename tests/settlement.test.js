'use strict';
// Tests für app/settlement.js – Gutschrift-Tracking der Reisekosten (KST).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app');

const app = loadApp();
const {
    SETTLEMENT_STATUSES, SETTLEMENT_STATUS_ORDER, getSettlementStatus,
    settlementAmount, aggregateSettlement, findDuplicateExpenseReport,
    buildAccountingEmail, moveCostLine,
} = app;

const employees = [
    { id: 'emp-1', name: 'Anna Schmidt',  category: 'AS' },
    { id: 'emp-2', name: 'Bernd Meier',   category: 'CMS' },
    { id: 'emp-3', name: 'Carla Novak',   category: 'AS' },
];
const projects = [
    { id: 'proj-1', name: 'Anlage Nord', kst: '77001' },
    { id: 'proj-2', name: 'Anlage Sued' }, // ohne Projekt-KST
];
const teamKst = { AS: '4711', CMS: '4712' };

const ci = (over = {}) => ({
    id: 'ci-x', projectId: 'proj-1', empId: 'emp-1',
    lines: [{ id: 'cl-1', type: 'travel', amount: 100 }],
    amount: 100,
    ...over,
});

// ── Status-Defaulting (Lazy Migration) ──────────────────────────────────────
test('getSettlementStatus: Legacy-Projektkosten defaulten auf to_submit', () => {
    assert.equal(getSettlementStatus(ci()), 'to_submit');
});

test('getSettlementStatus: Kosten ohne Projekt defaulten auf remain_on_kst', () => {
    assert.equal(getSettlementStatus(ci({ projectId: null })), 'remain_on_kst');
    assert.equal(getSettlementStatus(ci({ projectId: undefined })), 'remain_on_kst');
});

test('getSettlementStatus: explizites Feld gewinnt, unbekannte Werte fallen auf Default', () => {
    assert.equal(getSettlementStatus(ci({ settlementStatus: 'submitted' })), 'submitted');
    assert.equal(getSettlementStatus(ci({ projectId: null, settlementStatus: 'to_submit' })), 'to_submit');
    assert.equal(getSettlementStatus(ci({ settlementStatus: 'kaputt' })), 'to_submit');
    assert.equal(getSettlementStatus(null), 'remain_on_kst');
});

test('SETTLEMENT_STATUS_ORDER deckt alle Statuskonfigurationen ab', () => {
    assert.deepEqual([...SETTLEMENT_STATUS_ORDER].sort(), Object.keys(SETTLEMENT_STATUSES).sort());
});

// ── settlementAmount ────────────────────────────────────────────────────────
test('settlementAmount: Stunden-Zeilen zählen nicht als Reisekosten', () => {
    const item = ci({ lines: [
        { id: 'a', type: 'travel', amount: 120.5 },
        { id: 'b', type: 'hours', hours: 8, hourlyRate: 80, amount: 640 },
        { id: 'c', type: 'meals', amount: 30 },
    ]});
    assert.equal(settlementAmount(item), 150.5);
});

test('settlementAmount: robust bei fehlenden lines/amounts', () => {
    assert.equal(settlementAmount({}), 0);
    assert.equal(settlementAmount(null), 0);
    assert.equal(settlementAmount(ci({ lines: [{ id: 'a', type: 'other' }] })), 0);
});

// ── aggregateSettlement ─────────────────────────────────────────────────────
test('aggregateSettlement: gruppiert je Team, rechnet bereinigt = raw − submitted', () => {
    const items = [
        ci({ id: 'c1', empId: 'emp-1' }),                                             // AS, to_submit, 100
        ci({ id: 'c2', empId: 'emp-3', settlementStatus: 'submitted' }),              // AS, submitted, 100
        ci({ id: 'c3', empId: 'emp-3', projectId: null }),                            // AS, remain, 100
        ci({ id: 'c4', empId: 'emp-2', lines: [{ id: 'l', type: 'meals', amount: 50 }] }), // CMS, to_submit, 50
    ];
    const agg = aggregateSettlement(items, employees, teamKst);
    assert.equal(agg.length, 2);
    const as = agg.find(g => g.team === 'AS');
    assert.equal(as.kst, '4711');
    assert.equal(as.raw, 300);
    assert.equal(as.toSubmit, 100);
    assert.equal(as.submitted, 100);
    assert.equal(as.remain, 100);
    assert.equal(as.adjusted, 200);
    assert.equal(as.items.length, 3);
    const cms = agg.find(g => g.team === 'CMS');
    assert.equal(cms.raw, 50);
    assert.equal(cms.adjusted, 50);
});

test('aggregateSettlement: unbekannter Mitarbeiter → Team Other, fehlende KST → leer', () => {
    const agg = aggregateSettlement([ci({ empId: 'emp-unbekannt' })], employees, teamKst);
    assert.equal(agg.length, 1);
    assert.equal(agg[0].team, 'Other');
    assert.equal(agg[0].kst, '');
});

test('aggregateSettlement: reine Stunden-Kostenpunkte werden übersprungen', () => {
    const items = [ci({ lines: [{ id: 'l', type: 'hours', hours: 8, hourlyRate: 80, amount: 640 }] })];
    assert.deepEqual(aggregateSettlement(items, employees, teamKst), []);
});

// ── findDuplicateExpenseReport ──────────────────────────────────────────────
test('findDuplicateExpenseReport: projektlos matcht global', () => {
    const items = [ci({ id: 'c1', expenseReportId: 'R-1', projectId: 'proj-1' })];
    const { duplicate, elsewhere } = findDuplicateExpenseReport(items, 'R-1', null);
    assert.equal(duplicate.id, 'c1');
    assert.equal(elsewhere, null);
});

test('findDuplicateExpenseReport: Projekt-Scope + Warnung bei Treffer anderswo', () => {
    const items = [
        ci({ id: 'c1', expenseReportId: 'R-1', projectId: 'proj-1' }),
        ci({ id: 'c2', expenseReportId: 'R-2', projectId: null }),
    ];
    const r1 = findDuplicateExpenseReport(items, 'R-1', 'proj-1');
    assert.equal(r1.duplicate.id, 'c1');
    assert.equal(r1.elsewhere, null);
    const r2 = findDuplicateExpenseReport(items, 'R-2', 'proj-1');
    assert.equal(r2.duplicate, null);
    assert.equal(r2.elsewhere.id, 'c2');
    const r3 = findDuplicateExpenseReport(items, null, 'proj-1');
    assert.equal(r3.duplicate, null);
});

// ── buildAccountingEmail ────────────────────────────────────────────────────
test('buildAccountingEmail: Tabellenform mit Pflichtdaten je Posten + Gesamtsumme', () => {
    const items = [
        ci({ id: 'c1', empId: 'emp-1', reportKey: '943829',
             lines: [{ id: 'l', type: 'travel', amount: 100.5 }] }),
        ci({ id: 'c2', empId: 'emp-2', projectId: null, targetAccount: '99001',
             lines: [{ id: 'l', type: 'meals', amount: 49.5 }] }),
    ];
    const mail = buildAccountingEmail(items, employees, projects, teamKst);
    assert.equal(mail.count, 2);
    assert.equal(mail.total, 150);
    assert.match(mail.subject, /2 Posten/);
    assert.match(mail.subject, /150\.00 EUR/);
    // Tabellenkopf mit allen Pflichtspalten
    assert.match(mail.body, /Mitarbeiter\s*\| Abrechnungsschluessel\s*\| Betrag \(EUR\)\s*\| Gutschrift auf KST\s*\| Umbuchung auf/);
    // Posten 1: Projekt-KST als Ziel (kein eigenes Gegenkonto gesetzt)
    assert.match(mail.body, /Anna Schmidt\s*\|\s*943829\s*\|\s*100\.50\s*\|\s*4711\s*\|\s*77001/);
    // Posten 2: eigenes Gegenkonto, fehlender reportKey → '-'
    assert.match(mail.body, /Bernd Meier\s*\|\s*-\s*\|\s*49\.50\s*\|\s*4712\s*\|\s*99001/);
    assert.match(mail.body, /GESAMTSUMME: 150\.00 EUR/);
    // Spalten sind auf gleiche Breite aufgefüllt (Tabellen-Layout)
    const rows = mail.body.split('\n').filter(l => l.includes('|') && !l.includes('---'));
    const firstPipe = new Set(rows.map(l => l.indexOf('|')));
    assert.equal(firstPipe.size, 1);
});

test('buildAccountingEmail: fehlende KST/Ziel-Stelle → "-"', () => {
    const items = [ci({ empId: 'emp-unbekannt', projectId: 'proj-2' })];
    const mail = buildAccountingEmail(items, employees, projects, teamKst);
    assert.match(mail.body, /Unbekannt\s*\|\s*-\s*\|\s*100\.00\s*\|\s*-\s*\|\s*-/);
});

// ── moveCostLine (nachträglicher Split je Einzelposten) ─────────────────────
const tripItems = () => [
    { id: 'ci-p', projectId: 'proj-1', empId: 'emp-1', description: 'Spesen Reise',
      dateFrom: '2026-03-02', week: '2026-W10', expenseReportId: 'R-1', reportKey: '943829',
      targetAccount: '77001', settlementStatus: 'to_submit',
      lines: [
          { id: 'l1', type: 'travel', amount: 100 },
          { id: 'l2', type: 'accommodation', amount: 50 },
      ], amount: 150 },
    { id: 'ci-x', projectId: 'proj-2', empId: 'emp-2', lines: [{ id: 'lx', type: 'travel', amount: 9 }], amount: 9 },
];

test('moveCostLine: Projekt → KST legt internen Schwester-Kostenpunkt an', () => {
    const res = moveCostLine(tripItems(), 'ci-p', 'l2', { kstSuffix: 'KST-Anteil' });
    assert.equal(res.moved, true);
    assert.equal(res.direction, 'toKst');
    const proj = res.items.find(c => c.id === 'ci-p');
    assert.deepEqual(proj.lines.map(l => l.id), ['l1']);
    assert.equal(proj.amount, 100);
    const internal = res.items.find(c => c.projectId == null);
    assert.ok(internal);
    assert.equal(internal.id, res.targetId);
    assert.deepEqual(internal.lines.map(l => l.id), ['l2']);
    assert.equal(internal.amount, 50);
    assert.equal(internal.settlementStatus, 'remain_on_kst');
    assert.equal(internal.expenseReportId, 'R-1');
    assert.equal(internal.reportKey, '943829');
    assert.match(internal.description, /KST-Anteil/);
    // Unbeteiligter Kostenpunkt bleibt unangetastet
    assert.ok(res.items.find(c => c.id === 'ci-x'));
});

test('moveCostLine: zweiter Move nutzt den vorhandenen internen Kostenpunkt', () => {
    const first = moveCostLine(tripItems(), 'ci-p', 'l2', { kstSuffix: 'KST-Anteil' });
    const second = moveCostLine(first.items, 'ci-p', 'l1');
    assert.equal(second.moved, true);
    // Quelle ist leer geworden → aufgelöst; nur intern + fremder Punkt übrig
    assert.equal(second.items.find(c => c.id === 'ci-p'), undefined);
    const internal = second.items.find(c => c.projectId == null);
    assert.deepEqual(internal.lines.map(l => l.id).sort(), ['l1', 'l2']);
    assert.equal(internal.amount, 150);
    assert.equal(second.items.length, 2);
});

test('moveCostLine: KST → Projekt über die Abrechnungs-ID zurück', () => {
    const split = moveCostLine(tripItems(), 'ci-p', 'l2', { kstSuffix: 'KST-Anteil' });
    const internalId = split.targetId;
    const back = moveCostLine(split.items, internalId, 'l2');
    assert.equal(back.moved, true);
    assert.equal(back.direction, 'toProject');
    const proj = back.items.find(c => c.id === 'ci-p');
    assert.deepEqual(proj.lines.map(l => l.id).sort(), ['l1', 'l2']);
    assert.equal(proj.amount, 150);
    // Interner Punkt hat seine letzte Zeile verloren → aufgelöst
    assert.equal(back.items.find(c => c.id === internalId), undefined);
});

test('moveCostLine: ohne Projekt-Gegenstück kein Rückweg (noProjectSibling)', () => {
    const items = [{ id: 'ci-i', projectId: null, empId: 'emp-1',
        lines: [{ id: 'l1', type: 'meals', amount: 20 }], amount: 20 }];
    const res = moveCostLine(items, 'ci-i', 'l1');
    assert.equal(res.moved, false);
    assert.equal(res.error, 'noProjectSibling');
    assert.deepEqual(res.items, items);
});

test('moveCostLine: Rückweg über relatedItemId, wenn keine ERP-ID vorhanden', () => {
    const items = [
        { id: 'ci-p', projectId: 'proj-1', empId: 'emp-1', description: 'Manuell',
          lines: [{ id: 'l1', type: 'travel', amount: 30 }, { id: 'l2', type: 'meals', amount: 10 }], amount: 40 },
    ];
    const split = moveCostLine(items, 'ci-p', 'l2', { kstSuffix: 'KST-Anteil' });
    const internal = split.items.find(c => c.projectId == null);
    assert.equal(internal.expenseReportId, null);
    assert.equal(internal.relatedItemId, 'ci-p');
    const back = moveCostLine(split.items, internal.id, 'l2');
    assert.equal(back.moved, true);
    const proj = back.items.find(c => c.id === 'ci-p');
    assert.deepEqual(proj.lines.map(l => l.id).sort(), ['l1', 'l2']);
});

// ── Runde 2: booked_other_kst, Invoices, HTML-Tabelle ───────────────────────
test('aggregateSettlement: booked_other_kst zählt nicht ins Minus', () => {
    const items = [
        ci({ id: 'c1', empId: 'emp-1' }),                                        // to_submit, 100
        ci({ id: 'c2', empId: 'emp-1', settlementStatus: 'booked_other_kst' }),  // fremde KST, 100
    ];
    const agg = aggregateSettlement(items, employees, teamKst);
    const as = agg.find(g => g.team === 'AS');
    assert.equal(as.raw, 100);
    assert.equal(as.otherKst, 100);
    assert.equal(as.adjusted, 100);
    assert.equal(as.items.length, 2); // sichtbar bleibt der Posten trotzdem
});

test('aggregateSettlement: booksOnInvoice-Mitarbeiter → eigener Invoices-Posten', () => {
    const emps = [...employees, { id: 'emp-inv', name: 'Ida Invoice', category: 'AS', booksOnInvoice: true }];
    const items = [
        ci({ id: 'c1', empId: 'emp-1' }),                       // normal, 100
        ci({ id: 'c2', empId: 'emp-inv' }),                     // Invoice, 100
        ci({ id: 'c3', empId: 'emp-inv', settlementStatus: 'submitted' }), // Invoice schlägt Status
    ];
    const agg = aggregateSettlement(items, emps, teamKst);
    const as = agg.find(g => g.team === 'AS');
    assert.equal(as.raw, 100);
    assert.equal(as.invoices, 200);
    assert.equal(as.toSubmit, 100);
    assert.equal(as.submitted, 0);
    assert.equal(as.adjusted, 100);
    assert.equal(as.items.length, 3);
});

test('getSettlementStatus: booked_other_kst ist gültiger expliziter Status', () => {
    assert.equal(getSettlementStatus(ci({ settlementStatus: 'booked_other_kst' })), 'booked_other_kst');
    assert.ok(SETTLEMENT_STATUS_ORDER.includes('booked_other_kst'));
});

test('buildAccountingEmailHtml: echte Tabelle mit Escaping und Summen', () => {
    const { buildAccountingEmailHtml } = app;
    const items = [
        ci({ id: 'c1', empId: 'emp-1', reportKey: '943829',
             lines: [{ id: 'l', type: 'travel', amount: 100.5 }] }),
    ];
    const emps = [{ id: 'emp-1', name: 'Anna <b>Schmidt</b> & Co', category: 'AS' }];
    const res = buildAccountingEmailHtml(items, emps, projects, teamKst);
    assert.equal(res.total, 100.5);
    assert.equal(res.count, 1);
    assert.match(res.html, /<table[^>]*border-collapse/);
    assert.match(res.html, /Abrechnungsschl&uuml;ssel/);
    // HTML im Namen wird escaped, kein rohes <b>
    assert.ok(!res.html.includes('<b>Schmidt</b>'));
    assert.match(res.html, /Anna &lt;b&gt;Schmidt&lt;\/b&gt; &amp; Co/);
    assert.match(res.html, /943829/);
    assert.match(res.html, /100\.50/);
    assert.match(res.html, /GESAMTSUMME/);
    assert.match(res.html, /77001/); // Projekt-KST als Umbuchungsziel
});
