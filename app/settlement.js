// ─── REISEKOSTEN-GUTSCHRIFTEN (KST-Settlement, "Prozess 2") ──────────────────
// Reine Logik für das Gutschrift-Tracking gegenüber der internen Buchhaltung:
// Status-Defaulting, KST-Aggregation je Team und der E-Mail-Body-Builder.
// Strikt getrennt von Prozess 1 (Kostenübermittlung ans Auftragszentrum,
// handleInvoiceSendEmail/invoiceRecipient) – hier geht es ausschließlich um
// die Rückbuchung der Reisekosten auf die Team-Kostenstelle.
// Kein DOM/React – wird von tests/settlement.test.js abgedeckt.

// Status eines Kostenpunkts im Gutschrift-Prozess. Labels laufen über i18n
// (travel.status.<key>); hier liegen nur Schlüssel, Reihenfolge und Chips.
// 'booked_other_kst' = Reise wurde von Anfang an auf eine fremde KST gebucht –
// sie belastet die Team-KST nicht und zählt nicht ins Gesamtminus.
const SETTLEMENT_STATUSES = {
    to_submit:        { chip: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-500' },
    remain_on_kst:    { chip: 'bg-slate-100 text-slate-600 border-slate-200',       dot: 'bg-slate-400' },
    booked_other_kst: { chip: 'bg-sky-100 text-sky-700 border-sky-200',             dot: 'bg-sky-500' },
    submitted:        { chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};
const SETTLEMENT_STATUS_ORDER = ['to_submit', 'remain_on_kst', 'booked_other_kst', 'submitted'];

// Lazy Defaulting: Bestandsdaten tragen kein settlementStatus-Feld. Der
// Default wird beim Lesen abgeleitet und erst beim ersten Anfassen
// persistiert – so bleiben alte cost-items-Dateien byte-identisch.
// Projektkosten → 'to_submit' (müssen von der Buchhaltung gutgeschrieben
// werden), interne Kosten ohne Projekt → 'remain_on_kst'.
const getSettlementStatus = (ci) => {
    if (!ci) return 'remain_on_kst';
    if (ci.settlementStatus && SETTLEMENT_STATUSES[ci.settlementStatus]) return ci.settlementStatus;
    return ci.projectId ? 'to_submit' : 'remain_on_kst';
};

// Reisekosten-relevanter Betrag eines Kostenpunkts: alle Zeilen AUSSER
// 'hours' (Stunden sind interne Arbeitsleistung, keine Auslage, die die
// Team-KST belastet).
const settlementAmount = (ci) =>
    (ci && Array.isArray(ci.lines) ? ci.lines : [])
        .reduce((s, l) => s + (l && l.type !== 'hours' ? (l.amount || 0) : 0), 0);

// Aggregation je Team-KST für das Dashboard. Kostenpunkte werden – wie beim
// Team-Split der Datendateien (groupByTeam) – über das Team des Mitarbeiters
// zugeordnet; unbekannte Mitarbeiter fallen auf 'Other'. Kostenpunkte ohne
// Reisekosten-Anteil (nur Stunden-Zeilen) werden übersprungen.
//
// Mitarbeiter mit booksOnInvoice buchen ihre Reisekosten über einen anderen
// Kanal (Kunden-Invoice statt KST-Gutschrift) – sie belasten die Team-KST
// daher NICHT (raus aus raw/adjusted). Das heißt aber nicht, dass diese
// Posten eingefroren sind: sie durchlaufen denselben Status-Workflow
// (to_submit/remain_on_kst/booked_other_kst/submitted) wie normale
// Kostenpunkte und werden separat unter invoices* bilanziert.
//
// Liefert (nach Teamname sortiert):
//   [{ team, kst, raw, toSubmit, remain, otherKst, submitted, adjusted,
//      invoicesRaw, invoicesToSubmit, invoicesSubmitted, invoicesAdjusted, items }]
//   raw              = Gesamtminus der KST (Reisekosten, die die Team-KST belasten)
//   otherKst         = auf fremde KST gebuchte Reisen – belasten die Team-KST NICHT
//   adjusted         = bereinigtes Minus nach angeforderten Gutschriften (raw − submitted)
//   invoicesRaw      = Gesamtsumme der Invoice-Kosten (eigener Kanal, nicht in raw)
//   invoicesAdjusted = offener Invoice-Betrag (invoicesRaw − invoicesSubmitted)
const aggregateSettlement = (costItems, employees, teamKst) => {
    const empById = new Map((employees || []).map(e => [e.id, e]));
    const groups = new Map();
    (costItems || []).forEach(ci => {
        const amount = settlementAmount(ci);
        if (amount <= 0) return;
        const emp = empById.get(ci.empId);
        const team = emp?.category || 'Other';
        let g = groups.get(team);
        if (!g) {
            g = { team, kst: (teamKst || {})[team] || '', raw: 0,
                  toSubmit: 0, remain: 0, otherKst: 0, submitted: 0, adjusted: 0,
                  invoicesRaw: 0, invoicesToSubmit: 0, invoicesSubmitted: 0, invoicesAdjusted: 0,
                  items: [] };
            groups.set(team, g);
        }
        g.items.push(ci);
        const status = getSettlementStatus(ci);
        if (emp?.booksOnInvoice) {
            g.invoicesRaw += amount;
            if (status === 'to_submit') g.invoicesToSubmit += amount;
            else if (status === 'submitted') g.invoicesSubmitted += amount;
            return;
        }
        if (status === 'booked_other_kst') { g.otherKst += amount; return; }
        g.raw += amount;
        if (status === 'to_submit') g.toSubmit += amount;
        else if (status === 'submitted') g.submitted += amount;
        else g.remain += amount;
    });
    const round2 = (n) => Math.round(n * 100) / 100;
    return [...groups.values()]
        .map(g => ({ ...g,
            raw: round2(g.raw), toSubmit: round2(g.toSubmit), remain: round2(g.remain),
            otherKst: round2(g.otherKst),
            submitted: round2(g.submitted), adjusted: round2(g.raw - g.submitted),
            invoicesRaw: round2(g.invoicesRaw), invoicesToSubmit: round2(g.invoicesToSubmit),
            invoicesSubmitted: round2(g.invoicesSubmitted),
            invoicesAdjusted: round2(g.invoicesRaw - g.invoicesSubmitted) }))
        .sort((a, b) => a.team.localeCompare(b.team));
};

// Duplikat-Prüfung über die ERP-Abrechnungs-ID. Die ID ist firmenweit
// eindeutig, daher prüft der projektlose (Mitarbeiter-)Import GLOBAL über
// alle Kostenpunkte. Der Projekt-Import behält seine projektbezogene
// Ersetzen-Semantik (`duplicate`) und meldet Treffer auf anderen Projekten /
// intern nur als Warnung (`elsewhere`).
const findDuplicateExpenseReport = (costItems, reportId, projectId) => {
    if (!reportId) return { duplicate: null, elsewhere: null };
    const matches = (costItems || []).filter(c => c && c.expenseReportId === reportId);
    if (projectId == null) {
        return { duplicate: matches[0] || null, elsewhere: null };
    }
    return {
        duplicate:  matches.find(c => c.projectId === projectId) || null,
        elsewhere:  matches.find(c => c.projectId !== projectId) || null,
    };
};

// Schwester-Kostenpunkt derselben Reise finden: gleiche Abrechnung (ERP-ID)
// bzw. explizite Verknüpfung (relatedItemId aus einem früheren Verschieben),
// gleicher Mitarbeiter, gegenteiliger Buchungstyp (Projekt ↔ intern).
const findTripSibling = (costItems, source, wantProject) =>
    (costItems || []).find(c => c && c.id !== source.id
        && c.empId === source.empId
        && (wantProject ? c.projectId != null : c.projectId == null)
        && ((source.expenseReportId && c.expenseReportId === source.expenseReportId)
            || c.relatedItemId === source.id
            || source.relatedItemId === c.id)) || null;

// Einzelposten einer Reise nachträglich zwischen Projekt-Kostenpunkt und
// internem KST-Kostenpunkt verschieben. Rein funktional: liefert die neue
// costItems-Liste, mutiert nichts.
//   - Quelle ist ein Projekt-Kostenpunkt → Zeile wandert in den internen
//     Schwester-Kostenpunkt derselben Reise (wird bei Bedarf angelegt,
//     Status 'remain_on_kst').
//   - Quelle ist intern → Zeile wandert zurück in den Projekt-Schwester-
//     Kostenpunkt; ohne identifizierbares Projekt-Gegenstück (error
//     'noProjectSibling') passiert nichts.
//   - Verliert die Quelle ihre letzte Zeile, wird sie komplett entfernt.
// opts.kstSuffix: Beschreibungs-Zusatz für einen neu angelegten internen
// Kostenpunkt (i18n-Label, z. B. "KST-Anteil").
const moveCostLine = (costItems, sourceItemId, lineId, opts = {}) => {
    const items = costItems || [];
    const source = items.find(c => c && c.id === sourceItemId);
    const line = source && (source.lines || []).find(l => l.id === lineId);
    if (!source || !line) return { items, moved: false, error: 'notFound' };
    const toKst = source.projectId != null;
    const sibling = findTripSibling(items, source, !toKst);
    if (!toKst && !sibling) return { items, moved: false, error: 'noProjectSibling' };

    const sumOf = (ls) => Math.round(ls.reduce((s, l) => s + (l.amount || 0), 0) * 100) / 100;
    const newSourceLines = (source.lines || []).filter(l => l.id !== lineId);
    const created = sibling ? null : {
        id: makeId('ci'),
        projectId: null,
        empId: source.empId,
        description: [source.description, opts.kstSuffix].filter(Boolean).join(' · '),
        dateFrom: source.dateFrom || null,
        dateTo: source.dateTo || null,
        week: source.week || null,
        lines: [],
        amount: 0,
        expenseReportId: source.expenseReportId || null,
        reportKey: source.reportKey || null,
        targetAccount: null,
        settlementStatus: 'remain_on_kst',
        // Verknüpfung für den Rückweg, falls die Reise keine ERP-ID trägt
        relatedItemId: source.id,
    };
    const targetId = (sibling || created).id;

    const out = [];
    items.forEach(c => {
        if (c.id === source.id) {
            // Quelle ohne letzte Zeile komplett auflösen
            if (newSourceLines.length > 0) out.push({ ...c, lines: newSourceLines, amount: sumOf(newSourceLines) });
        } else if (c.id === targetId) {
            const lines = [...(c.lines || []), line];
            out.push({ ...c, lines, amount: sumOf(lines) });
        } else {
            out.push(c);
        }
    });
    if (created) out.push({ ...created, lines: [line], amount: sumOf([line]) });

    return { items: out, moved: true, targetId, direction: toKst ? 'toKst' : 'toProject' };
};

// Komprimierte Gesamtübersicht für die Buchhaltungs-E-Mail in Tabellenform:
// eine Zeile pro Posten mit den Pflichtdaten Mitarbeiter, Abrechnungs-
// schlüssel, Betrag, Team-KST (Gutschrift) und Ziel-Stelle/Gegenkonto
// (Umbuchung; Fallback auf die Projekt-KST). Spalten werden auf gleiche
// Breite aufgefüllt, damit die Übersicht in Monospace-Darstellung als
// Tabelle lesbar ist. Bewusst ASCII-sicher formuliert (wie die bestehende
// Rechnungs-E-Mail), da mailto-Clients Umlaute unterschiedlich behandeln.
const buildAccountingEmail = (items, employees, projects, teamKst) => {
    const empById = new Map((employees || []).map(e => [e.id, e]));
    const projById = new Map((projects || []).map(p => [p.id, p]));
    const fmt2 = (n) => n.toFixed(2);

    let total = 0;
    const header = ['Mitarbeiter', 'Abrechnungsschluessel', 'Betrag (EUR)', 'Gutschrift auf KST', 'Umbuchung auf'];
    const tableRows = (items || []).map(ci => {
        const emp = empById.get(ci.empId);
        const team = emp?.category || 'Other';
        const kst = (teamKst || {})[team] || '-';
        const proj = ci.projectId ? projById.get(ci.projectId) : null;
        const target = ci.targetAccount || proj?.kst || '-';
        const amount = settlementAmount(ci);
        total += amount;
        return [emp?.name || 'Unbekannt', ci.reportKey || '-', fmt2(amount), kst, target];
    });
    total = Math.round(total * 100) / 100;

    // Spaltenbreiten über Kopf + Datenzeilen ermitteln und auffüllen.
    const widths = header.map((h, i) =>
        Math.max(h.length, ...tableRows.map(r => r[i].length), 0));
    const renderRow = (cols) => cols.map((c, i) => c.padEnd(widths[i])).join(' | ').trimEnd();
    const sepRow = widths.map(w => '-'.repeat(w)).join('-|-');

    const lines = [];
    lines.push('Guten Tag,');
    lines.push('');
    lines.push('bitte um Gutschrift der folgenden Reisekosten auf die jeweilige Team-Kostenstelle:');
    lines.push('');
    lines.push(renderRow(header));
    lines.push(sepRow);
    tableRows.forEach(r => lines.push(renderRow(r)));
    lines.push(sepRow);
    lines.push(`GESAMTSUMME: ${fmt2(total)} EUR`);
    lines.push('');
    lines.push('Mit freundlichen Gruessen');

    return {
        subject: `Reisekosten-Gutschrift: ${(items || []).length} Posten - ${fmt2(total)} EUR`,
        body: lines.join('\n'),
        total,
        count: (items || []).length,
    };
};

// Dieselbe Übersicht als echte HTML-Tabelle für die Zwischenablage
// (text/html). In Outlook/Word eingefügt erscheint sie als formatierte
// Tabelle. Inline-Styles statt CSS-Klassen, weil Mail-Clients externe
// Styles beim Einfügen verwerfen. Alle Feldwerte werden HTML-escaped.
const escapeHtml = (v) => String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const buildAccountingEmailHtml = (items, employees, projects, teamKst) => {
    const empById = new Map((employees || []).map(e => [e.id, e]));
    const projById = new Map((projects || []).map(p => [p.id, p]));
    const fmt2 = (n) => n.toFixed(2);
    const td = 'border:1px solid #94a3b8;padding:4px 10px;font-size:13px;';
    const tdNum = td + 'text-align:right;font-variant-numeric:tabular-nums;';
    const th = td + 'background:#e2e8f0;font-weight:600;text-align:left;';

    let total = 0;
    const rowsHtml = (items || []).map(ci => {
        const emp = empById.get(ci.empId);
        const team = emp?.category || 'Other';
        const kst = (teamKst || {})[team] || '-';
        const proj = ci.projectId ? projById.get(ci.projectId) : null;
        const target = ci.targetAccount || proj?.kst || '-';
        const amount = settlementAmount(ci);
        total += amount;
        return `<tr><td style="${td}">${escapeHtml(emp?.name || 'Unbekannt')}</td>`
            + `<td style="${td}">${escapeHtml(ci.reportKey || '-')}</td>`
            + `<td style="${tdNum}">${fmt2(amount)}</td>`
            + `<td style="${td}">${escapeHtml(kst)}</td>`
            + `<td style="${td}">${escapeHtml(target)}</td></tr>`;
    }).join('');
    total = Math.round(total * 100) / 100;

    const html =
        '<p>Guten Tag,</p>'
        + '<p>bitte um Gutschrift der folgenden Reisekosten auf die jeweilige Team-Kostenstelle:</p>'
        + '<table style="border-collapse:collapse;border:1px solid #94a3b8;">'
        + '<thead><tr>'
        + `<th style="${th}">Mitarbeiter</th>`
        + `<th style="${th}">Abrechnungsschl&uuml;ssel</th>`
        + `<th style="${th}">Betrag (EUR)</th>`
        + `<th style="${th}">Gutschrift auf KST</th>`
        + `<th style="${th}">Umbuchung auf</th>`
        + '</tr></thead>'
        + `<tbody>${rowsHtml}</tbody>`
        + '<tfoot><tr>'
        + `<td style="${th}" colspan="2">GESAMTSUMME</td>`
        + `<td style="${th}text-align:right;">${fmt2(total)}</td>`
        + `<td style="${th}" colspan="2"></td>`
        + '</tr></tfoot></table>'
        + '<p>Mit freundlichen Gr&uuml;&szlig;en</p>';

    return { html, total, count: (items || []).length };
};
// ─────────────────────────────────────────────────────────────────────────────
