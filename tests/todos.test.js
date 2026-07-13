'use strict';
// Tests für app/todos.js (Fälligkeiten-Widget der Übersicht).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app.js');

const app = loadApp();

// computeAutoStatus wird in der App aus dem abgeleiteten projectStatusById
// gespeist – für die Tests reicht ein Stub über ein status-Feld am Projekt.
const statusStub = (p) => p._status;

test('buildTodos: missing_costs-Projekte landen in der Liste', () => {
    const todos = app.buildTodos({
        projects: [
            { id: 'p1', name: 'Alpha', _status: 'missing_costs', ibnWeek: '2026-W20' },
            { id: 'p2', name: 'Beta',  _status: 'planned',       ibnWeek: '2026-W40' },
        ],
        computeAutoStatus: statusStub,
        costItems: [], employees: [],
        currentWeek: '2026-W28', ageWeeks: 4,
    });
    assert.equal(todos.length, 1);
    assert.equal(todos[0].kind, 'missing_costs');
    assert.equal(todos[0].projectId, 'p1');
});

test('buildTodos: overdue_ibn nur wenn IBN älter als Schwelle und nicht abgeschlossen', () => {
    const base = { _status: 'active', name: 'X' };
    const todos = app.buildTodos({
        projects: [
            // IBN 10 Wochen vorbei, offen → fällig
            { ...base, id: 'p1', ibnWeek: '2026-W18' },
            // IBN erst 2 Wochen vorbei (innerhalb Schwelle 4) → nicht fällig
            { ...base, id: 'p2', ibnWeek: '2026-W26' },
            // IBN lange vorbei, aber abgeschlossen → nicht fällig
            { ...base, id: 'p3', ibnWeek: '2026-W10', projectCompleted: true },
            // IBN lange vorbei, Kosten eingereicht → nicht fällig
            { ...base, id: 'p4', ibnWeek: '2026-W10', costsSubmitted: true },
            // Kein IBN gepflegt → nicht fällig
            { ...base, id: 'p5' },
        ],
        computeAutoStatus: statusStub,
        costItems: [], employees: [],
        currentWeek: '2026-W28', ageWeeks: 4,
    });
    assert.deepEqual(todos.map(td => td.projectId), ['p1']);
    assert.equal(todos[0].kind, 'overdue_ibn');
});

test('buildTodos: stale_travel für alte to_submit-Posten mit Reisekostenanteil', () => {
    const employees = [{ id: 'e1', name: 'Anna' }];
    const mk = (id, week, extra = {}) => ({
        id, empId: 'e1', projectId: 'px', week,
        lines: [{ type: 'travel', amount: 100 }],
        ...extra,
    });
    const todos = app.buildTodos({
        projects: [], computeAutoStatus: statusStub, employees,
        costItems: [
            mk('c1', '2026-W20'),                               // alt → fällig
            mk('c2', '2026-W27'),                               // frisch → nicht fällig
            mk('c3', '2026-W10', { settlementStatus: 'submitted' }), // erledigt → nicht fällig
            // Nur-Stunden-Posten belastet die KST nicht → nie fällig
            { id: 'c4', empId: 'e1', projectId: 'px', week: '2026-W10',
              lines: [{ type: 'hours', amount: 800, hours: 10, hourlyRate: 80 }] },
            // Ohne week, aber mit dateFrom → Woche wird abgeleitet
            mk('c5', null, { dateFrom: '2026-01-05' }),
        ],
        currentWeek: '2026-W28', ageWeeks: 4,
    });
    assert.deepEqual(todos.map(td => td.costItemId), ['c5', 'c1']);
    assert.equal(todos[0].kind, 'stale_travel');
    assert.equal(todos[0].empName, 'Anna');
    assert.equal(todos[1].amount, 100);
});

test('buildTodos: Sortierung nach Dringlichkeit, dann ältester Woche', () => {
    const todos = app.buildTodos({
        projects: [
            { id: 'p1', name: 'B', _status: 'active', ibnWeek: '2026-W10' },
            { id: 'p2', name: 'A', _status: 'missing_costs', ibnWeek: '2026-W22' },
        ],
        computeAutoStatus: statusStub,
        employees: [{ id: 'e1', name: 'Anna' }],
        costItems: [{ id: 'c1', empId: 'e1', projectId: 'px', week: '2026-W05',
                      lines: [{ type: 'travel', amount: 50 }] }],
        currentWeek: '2026-W28', ageWeeks: 4,
    });
    assert.deepEqual(todos.map(td => td.kind),
        ['missing_costs', 'stale_travel', 'overdue_ibn']);
});
