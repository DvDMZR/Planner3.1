'use strict';
// Tests für app/settlement.js – Gutschrift-Tracking der Reisekosten (KST).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app');

const app = loadApp();
const {
    SETTLEMENT_STATUSES, SETTLEMENT_STATUS_ORDER, getSettlementStatus,
    settlementAmount, aggregateSettlement, findDuplicateExpenseReport,
    buildAccountingEmail,
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
test('buildAccountingEmail: Pflichtdaten je Posten + Gesamtsumme', () => {
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
    // Posten 1: Projekt-KST als Ziel (kein eigenes Gegenkonto gesetzt)
    assert.match(mail.body, /Anna Schmidt \| Abrechnungsschluessel: 943829 \| Betrag: 100\.50 EUR \| Gutschrift auf KST: 4711 \| Umbuchung auf: 77001/);
    // Posten 2: eigenes Gegenkonto, fehlender reportKey → '-'
    assert.match(mail.body, /Bernd Meier \| Abrechnungsschluessel: - \| Betrag: 49\.50 EUR \| Gutschrift auf KST: 4712 \| Umbuchung auf: 99001/);
    assert.match(mail.body, /GESAMTSUMME: 150\.00 EUR/);
});

test('buildAccountingEmail: fehlende KST/Ziel-Stelle → "-"', () => {
    const items = [ci({ empId: 'emp-unbekannt', projectId: 'proj-2' })];
    const mail = buildAccountingEmail(items, employees, projects, teamKst);
    assert.match(mail.body, /Unbekannt \| Abrechnungsschluessel: - \| Betrag: 100\.00 EUR \| Gutschrift auf KST: - \| Umbuchung auf: -/);
});
