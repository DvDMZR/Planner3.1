// ─── FÄLLIGKEITEN (Übersicht) ────────────────────────────────────────────────
// Reine Ableitungslogik für das Fälligkeiten-Widget der Übersicht: keine
// eigene Datenhaltung, jede "Aufgabe" wird bei Bedarf aus dem vorhandenen
// Zustand abgeleitet und verschwindet von selbst, sobald ihre Ursache
// behoben ist. Kein DOM/React – abgedeckt durch tests/todos.test.js.
// Benötigt getSettlementStatus/settlementAmount (settlement.js) sowie
// compareWeekIds/addWeeks/getWeekString (utils.js).

// Reihenfolge = Dringlichkeit im Widget.
const TODO_KIND_ORDER = ['missing_costs', 'stale_travel', 'overdue_ibn'];

// Baut die Fälligkeitsliste. Regeln:
//   missing_costs – IBN vorbei, Zuweisungen vorhanden, keine Kosten erfasst
//                   (Status kommt fertig aus computeAutoStatus).
//   stale_travel  – Reisekosten-Posten steht seit mehr als ageWeeks Wochen
//                   auf 'zu übermitteln' (KST-Gutschrift nicht angefordert).
//   overdue_ibn   – IBN seit mehr als ageWeeks Wochen vorbei, Projekt aber
//                   weder abgeschlossen noch Kosten eingereicht (und nicht
//                   schon als missing_costs gemeldet).
// Liefert [{ kind, week, projectId?, name?, costItemId?, empName?, amount? }],
// sortiert nach Dringlichkeit (TODO_KIND_ORDER), innerhalb gleicher Art
// älteste Woche zuerst.
const buildTodos = ({ projects, computeAutoStatus, costItems, employees, currentWeek, ageWeeks }) => {
    const todos = [];
    const maxAge = ageWeeks ?? TODO_AGE_WEEKS;
    const threshold = addWeeks(currentWeek, -maxAge);

    (projects || []).forEach(p => {
        const status = computeAutoStatus(p);
        if (status === 'missing_costs') {
            todos.push({ kind: 'missing_costs', projectId: p.id, name: p.name, week: p.ibnWeek || '' });
        } else if (status === 'active'
            && !p.projectCompleted && !p.costsSubmitted
            && p.ibnWeek && compareWeekIds(p.ibnWeek, threshold) < 0) {
            todos.push({ kind: 'overdue_ibn', projectId: p.id, name: p.name, week: p.ibnWeek });
        }
    });

    const empById = new Map((employees || []).map(e => [e.id, e]));
    (costItems || []).forEach(ci => {
        if (!ci || getSettlementStatus(ci) !== 'to_submit') return;
        if (settlementAmount(ci) <= 0) return;
        const week = ci.week
            || (ci.dateFrom ? getWeekString(new Date(ci.dateFrom)) : '');
        if (!week || compareWeekIds(week, threshold) >= 0) return;
        todos.push({
            kind: 'stale_travel',
            costItemId: ci.id,
            empName: empById.get(ci.empId)?.name || '?',
            week,
            amount: settlementAmount(ci),
        });
    });

    todos.sort((a, b) => {
        const ko = TODO_KIND_ORDER.indexOf(a.kind) - TODO_KIND_ORDER.indexOf(b.kind);
        if (ko !== 0) return ko;
        return compareWeekIds(a.week || '', b.week || '');
    });
    return todos;
};
// ─────────────────────────────────────────────────────────────────────────────
