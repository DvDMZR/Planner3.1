// ─── REISEKOSTENÜBERSICHT (Verwaltung) ───────────────────────────────────────
// Steuerungs- und Tracking-Dashboard für Prozess 2: Gutschrift der Reisekosten
// auf die Team-KST durch die interne Buchhaltung. Zeigt je Team (einklappbar)
// das Gesamtminus, die angeforderten Gutschriften und das bereinigte
// KST-Budget; erlaubt Status-/Gegenkonto-Pflege und Detail-/Bearbeiten-Zugriff
// je Kostenpunkt, den Mitarbeiter-basierten Spesen-Import und den
// E-Mail-Versand an die Buchhaltung mit Posten-Auswahl.
// Reine Rechenlogik liegt in app/settlement.js (getSettlementStatus,
// aggregateSettlement, buildAccountingEmail).
const TravelCostsView = ({ s, h }) => {
    const { useState, useMemo } = React;
    const {
        costItems, employees, projects, assignments, empCategories,
        teamKst, accountingRecipient, employeeById, projectById,
        empAliases, fxRates, expenseCategories, currentUser, t,
    } = s;
    const {
        setCostItems, setEmpAliases, setFxRates, setActiveTab,
        setSelectedProjectDetails, computeAutoStatus,
        handleSaveAssignment, showToast, requestConfirm, logAudit,
        downloadCsv,
    } = h;

    const [teamFilter, setTeamFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [empFilter, setEmpFilter] = useState('all');
    // Default: laufendes Jahr – hält Alt-Bestände aus dem Blick, bis sie
    // bewusst über den Jahresfilter geholt werden.
    const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
    const [isImportOpen, setIsImportOpen] = useState(false);
    // Einklappbare Team-Karten und ausklappbare Posten-Details
    const [collapsedTeams, setCollapsedTeams] = useState({});   // { team: bool }
    const [expandedItems, setExpandedItems] = useState({});     // { ciId: bool }
    const [editItem, setEditItem] = useState(null);             // Kostenpunkt im Bearbeiten-Modal
    // Sende-Dialog: Team-Vorauswahl + Checkbox je Reise
    const [isSendOpen, setIsSendOpen] = useState(false);
    const [sendTeam, setSendTeam] = useState('all');
    const [sendSel, setSendSel] = useState({});                 // { ciId: bool }
    // Sortierung der Posten-Tabellen (gilt für alle Team-Karten gemeinsam)
    const [sortKey, setSortKey] = useState('kw');               // emp|project|kw|reportKey|amount|status
    const [sortDir, setSortDir] = useState('asc');

    const fmt2 = (n) => (n || 0).toFixed(2);
    const itemYear = (ci) => (ci.dateFrom || ci.week || '').slice(0, 4);
    const statusLabel = (key) => t(`travel.status.${key}`);

    // Nur Kostenpunkte mit Reisekosten-Anteil (reine Stunden-Posten sind
    // Prozess-1-Material und belasten die KST nicht).
    const travelItems = useMemo(
        () => (costItems || []).filter(ci => settlementAmount(ci) > 0),
        [costItems]);

    const yearOptions = useMemo(() => {
        const years = new Set(travelItems.map(itemYear).filter(Boolean));
        years.add(String(new Date().getFullYear()));
        return [...years].sort().reverse();
    }, [travelItems]);

    const empTeam = (empId) => employeeById.get(empId)?.category || 'Other';

    const filtered = useMemo(() => travelItems.filter(ci =>
        (yearFilter === 'all' || itemYear(ci) === yearFilter)
        && (teamFilter === 'all' || empTeam(ci.empId) === teamFilter)
        && (empFilter === 'all' || ci.empId === empFilter)
        && (statusFilter === 'all' || getSettlementStatus(ci) === statusFilter)
    ), [travelItems, yearFilter, teamFilter, empFilter, statusFilter, employeeById]);

    const groups = useMemo(
        () => aggregateSettlement(filtered, employees, teamKst),
        [filtered, employees, teamKst]);

    const totals = useMemo(() => groups.reduce((acc, g) => ({
        raw: acc.raw + g.raw, toSubmit: acc.toSubmit + g.toSubmit,
        submitted: acc.submitted + g.submitted, adjusted: acc.adjusted + g.adjusted,
    }), { raw: 0, toSubmit: 0, submitted: 0, adjusted: 0 }), [groups]);

    // "Bucht auf Invoice"-Mitarbeiter buchen ihre Reisekosten über einen
    // anderen Kanal (Kunden-Invoice statt KST-Gutschrift) und werden separat
    // bilanziert (g.invoices* statt raw/adjusted) – das heißt aber nicht, dass
    // diese Posten eingefroren sind: sie durchlaufen denselben Status und
    // können ganz normal übermittelt werden.
    const isInvoiceItem = (ci) => !!employeeById.get(ci.empId)?.booksOnInvoice;

    const toSubmitItems = useMemo(
        () => filtered.filter(ci => getSettlementStatus(ci) === 'to_submit'),
        [filtered]);

    // Klick auf einen Spaltenkopf: gleiche Spalte → Richtung drehen,
    // andere Spalte → aufsteigend starten.
    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };
    const sortItems = (items) => {
        const val = (ci) => {
            switch (sortKey) {
                case 'emp':       return employeeById.get(ci.empId)?.name || '';
                case 'project':   return ci.projectId ? (projectById.get(ci.projectId)?.name || '') : '';
                case 'reportKey': return ci.reportKey || '';
                case 'amount':    return settlementAmount(ci);
                case 'status':    return isInvoiceItem(ci) ? SETTLEMENT_STATUS_ORDER.length
                                       : SETTLEMENT_STATUS_ORDER.indexOf(getSettlementStatus(ci));
                default:          return ci.dateFrom || ci.week || '';
            }
        };
        const sign = sortDir === 'asc' ? 1 : -1;
        return [...items].sort((a, b) => {
            const va = val(a), vb = val(b);
            const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'de');
            return cmp * sign;
        });
    };
    const sortHeader = (key, label, extra = '') => (
        <th className={`p-3 text-slate-500 font-medium ${extra}`}>
            <button onClick={() => toggleSort(key)}
                title={t('travel.sortHint')}
                className={`hover:text-slate-800 ${sortKey === key ? 'text-slate-800' : ''}`}>
                {label}{sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
            </button>
        </th>
    );

    const sortedEmployees = useMemo(
        () => [...(employees || [])].sort((a, b) => a.name.localeCompare(b.name)),
        [employees]);

    const kwLabel = (ci) => {
        if (ci.dateFrom) {
            const kwF = formatKW(getWeekString(new Date(ci.dateFrom)));
            const kwT = ci.dateTo ? formatKW(getWeekString(new Date(ci.dateTo))) : kwF;
            return kwF === kwT ? kwF : `${kwF}–${kwT}`;
        }
        return ci.week ? formatKW(ci.week) : '–';
    };

    // Klick auf ein Projekt → Projektdetails (gleiche Navigation wie die
    // Command-Palette: Verwaltung → Projekte → Detailseite).
    const openProject = (projectId) => {
        setSelectedProjectDetails(projectId);
        setActiveTab('setup_proj');
    };

    // ── Mutationen ───────────────────────────────────────────────────────────
    const applyStatus = (ci, next) => {
        // Manueller Wechsel auf 'submitted' stempelt Zeit/Nutzer; jeder andere
        // Status räumt die Stempel wieder ab (Gutschrift-Anforderung zurückgezogen).
        const stamp = next === 'submitted'
            ? { submittedAt: new Date().toISOString(), submittedBy: currentUser?.name || null }
            : { submittedAt: null, submittedBy: null };
        setCostItems(prev => prev.map(c => c.id === ci.id
            ? { ...c, settlementStatus: next, ...stamp } : c));
        const emp = employeeById.get(ci.empId);
        logAudit('settlement_status',
            `Reisekosten ${emp?.name || ci.empId} (${fmt2(settlementAmount(ci))} EUR): ${statusLabel(getSettlementStatus(ci))} → ${statusLabel(next)}`);
    };

    const requestStatusChange = (ci, next) => {
        const cur = getSettlementStatus(ci);
        if (cur === next) return;
        if (cur === 'submitted') {
            // Rückstufung einer bereits angeforderten Gutschrift ist heikel →
            // explizit bestätigen lassen.
            requestConfirm({
                title: t('travel.revertTitle'),
                message: t('travel.revertMsg'),
                confirmLabel: t('travel.revertBtn'),
                danger: true,
                onConfirm: () => applyStatus(ci, next),
            });
        } else {
            applyStatus(ci, next);
        }
    };

    const setTargetAccount = (ciId, value) =>
        setCostItems(prev => prev.map(c => c.id === ciId ? { ...c, targetAccount: value } : c));

    // Einzelposten nachträglich zwischen Projekt und KST verschieben
    // (moveCostLine in settlement.js legt bei Bedarf den internen
    // Schwester-Kostenpunkt der Reise an bzw. löst leere Punkte auf).
    const moveLine = (ci, line) => {
        const doMove = () => {
            const res = moveCostLine(costItems, ci.id, line.id, { kstSuffix: t('expense.kstSplitSuffix') });
            if (!res.moved) {
                if (res.error === 'noProjectSibling') showToast(t('travel.noProjectSibling'), { type: 'warning' });
                return;
            }
            setCostItems(res.items);
            const emp = employeeById.get(ci.empId);
            logAudit('settlement_status',
                `Einzelposten ${(line.amount || 0).toFixed(2)} EUR (${emp?.name || ci.empId}) ${res.direction === 'toKst' ? 'auf KST verschoben' : 'dem Projekt zugeordnet'}`);
            showToast(t(res.direction === 'toKst' ? 'travel.movedToKst' : 'travel.movedToProject'),
                { type: 'success', duration: 3000 });
        };
        if (getSettlementStatus(ci) === 'submitted') {
            requestConfirm({
                title: t('travel.moveSubmittedTitle'),
                message: t('travel.moveSubmittedMsg'),
                confirmLabel: t('travel.moveBtn'),
                danger: true,
                onConfirm: doMove,
            });
        } else {
            doMove();
        }
    };

    // Bulk: alle offenen Posten eines Teams auf der KST belassen (v. a. für
    // Alt-Bestände, die per Lazy-Default auf 'Zu übermitteln' stehen).
    const bulkRemainOnKst = (group) => {
        const ids = group.items.filter(ci => getSettlementStatus(ci) === 'to_submit').map(ci => ci.id);
        if (ids.length === 0) return;
        requestConfirm({
            title: t('travel.bulkRemainTitle'),
            message: t('travel.bulkRemainMsg').replace('{count}', String(ids.length)).replace('{team}', group.team),
            confirmLabel: t('travel.bulkRemainBtn'),
            onConfirm: () => {
                const idSet = new Set(ids);
                setCostItems(prev => prev.map(c => idSet.has(c.id)
                    ? { ...c, settlementStatus: 'remain_on_kst', submittedAt: null, submittedBy: null } : c));
                logAudit('settlement_status', `${ids.length} Reisekosten-Posten (Team ${group.team}) auf "Auf KST verbleiben" gesetzt`);
            },
        });
    };

    // ── E-Mail an die Buchhaltung: Auswahl-Dialog + Bestätigung ─────────────
    const openSendDialog = () => {
        if (toSubmitItems.length === 0) { showToast(t('travel.nothingToSubmit'), { type: 'warning' }); return; }
        // Vorauswahl: alle offenen Posten angehakt
        const sel = {};
        toSubmitItems.forEach(ci => { sel[ci.id] = true; });
        setSendSel(sel);
        setSendTeam('all');
        setIsSendOpen(true);
    };

    // Teams, die im Sende-Dialog zur Auswahl stehen (nur mit offenen Posten)
    const sendTeams = useMemo(
        () => [...new Set(toSubmitItems.map(ci => empTeam(ci.empId)))].sort(),
        [toSubmitItems, employeeById]);
    const sendVisible = useMemo(
        () => toSubmitItems.filter(ci => sendTeam === 'all' || empTeam(ci.empId) === sendTeam),
        [toSubmitItems, sendTeam, employeeById]);
    const sendSelected = useMemo(
        () => toSubmitItems.filter(ci => sendSel[ci.id]),
        [toSubmitItems, sendSel]);
    const sendSelectedTotal = useMemo(
        () => Math.round(sendSelected.reduce((sum, ci) => sum + settlementAmount(ci), 0) * 100) / 100,
        [sendSelected]);
    const allVisibleChecked = sendVisible.length > 0 && sendVisible.every(ci => sendSel[ci.id]);
    const toggleAllVisible = (checked) =>
        setSendSel(prev => {
            const next = { ...prev };
            sendVisible.forEach(ci => { next[ci.id] = checked; });
            return next;
        });

    const markSubmitted = (items, total) => {
        const ids = new Set(items.map(i => i.id));
        const now = new Date().toISOString();
        setCostItems(prev => prev.map(c => ids.has(c.id)
            ? { ...c, settlementStatus: 'submitted', submittedAt: now, submittedBy: currentUser?.name || null } : c));
        logAudit('settlement_submitted',
            `${items.length} Reisekosten-Posten (${fmt2(total)} EUR) an Buchhaltung übermittelt`);
        showToast(t('travel.markedSubmitted'), { type: 'success', duration: 4000 });
    };

    // Legt die Übersicht als ECHTE Tabelle (text/html) plus Klartext-Fallback
    // in die Zwischenablage – in Outlook eingefügt erscheint sie formatiert.
    const copySelection = () => {
        if (sendSelected.length === 0) { showToast(t('travel.nothingToSubmit'), { type: 'warning' }); return; }
        const mail = buildAccountingEmail(sendSelected, employees, projects, teamKst);
        const { html } = buildAccountingEmailHtml(sendSelected, employees, projects, teamKst);
        const text = `${mail.subject}\n\n${mail.body}`;
        const done = () => showToast(t('travel.copiedTable'), { type: 'success', duration: 3000 });
        const fail = () => showToast(t('travel.copyFailed'), { type: 'error' });
        if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            navigator.clipboard.write([new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([text], { type: 'text/plain' }),
            })]).then(done).catch(() => {
                // Fallback: nur Klartext (ältere Browser/Berechtigungen)
                navigator.clipboard?.writeText?.(text).then(done).catch(fail);
            });
        } else if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(fail);
        } else {
            fail();
        }
    };

    const sendSelection = () => {
        if (sendSelected.length === 0) { showToast(t('travel.nothingToSubmit'), { type: 'warning' }); return; }
        if (!(accountingRecipient || '').trim()) {
            showToast(t('travel.noRecipient'), { type: 'error', duration: 7000 });
            return;
        }
        const items = sendSelected;
        const mail = buildAccountingEmail(items, employees, projects, teamKst);
        const url = `mailto:${encodeURIComponent(accountingRecipient)}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;
        // mailto-Links werden von Clients ab ~2000 Zeichen abgeschnitten –
        // dann den Text stattdessen über die Zwischenablage transportieren.
        if (url.length > 1800) {
            showToast(t('travel.mailTooLong'), { type: 'warning', duration: 8000 });
        }
        window.location.href = url;
        setIsSendOpen(false);
        // Automatischer Folge-Dialog: Posten als übermittelt markieren?
        requestConfirm({
            title: t('travel.confirmSubmitTitle'),
            message: t('travel.confirmSubmitMsg')
                .replace('{count}', String(mail.count))
                .replace('{total}', fmt2(mail.total)),
            confirmLabel: t('travel.confirmSubmitBtn'),
            onConfirm: () => markSubmitted(items, mail.total),
        });
    };

    // ── Render ───────────────────────────────────────────────────────────────
    const selectCls = 'p-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gea-400';
    const statTile = (label, value, accent = 'text-slate-900') => (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 min-w-[9rem]">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-lg font-semibold tabular-nums mt-1 ${accent}`}>{value}</p>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Kopf: Titel + Aktionen */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl text-slate-900 font-semibold">{t('travel.title')}</h2>
                        <p className="text-sm text-slate-500 mt-1">{t('travel.subtitle')}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => {
                            // Exportiert die aktuell gefilterten Posten (alle Team-Karten).
                            const rowsCsv = [['Team', t('cats.kst'), t('travel.colEmployee'), t('travel.colProject'), t('travel.colReportKey'), 'KW/Datum', t('travel.colAmount'), t('travel.colStatus'), t('travel.colTarget')]];
                            groups.forEach(g => sortItems(g.items).forEach(ci => {
                                rowsCsv.push([
                                    g.team, g.kst || '',
                                    employeeById.get(ci.empId)?.name || '',
                                    ci.projectId ? (projectById.get(ci.projectId)?.name || '') : '',
                                    ci.reportKey || '',
                                    ci.dateFrom || ci.week || '',
                                    fmt2(settlementAmount(ci)),
                                    statusLabel(getSettlementStatus(ci)),
                                    ci.targetAccount || '',
                                ]);
                            }));
                            downloadCsv(`Reisekosten_${new Date().toISOString().slice(0,10)}.csv`, rowsCsv);
                        }}
                            className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-md hover:bg-gea-50 hover:border-gea-400 text-slate-700 flex items-center gap-2">
                            {t('btn.exportCsv')}
                        </button>
                        <button onClick={() => setIsImportOpen(true)}
                            className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-md hover:bg-gea-50 hover:border-gea-400 text-slate-700 flex items-center gap-2">
                            <IconUpload size={15}/> {t('travel.importBtn')}
                        </button>
                        <button onClick={openSendDialog} disabled={toSubmitItems.length === 0}
                            className="px-4 py-2 text-sm font-medium text-white bg-gea-600 rounded-md hover:bg-gea-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                            <IconExternalLink size={15}/> {t('travel.sendBtn').replace('{count}', String(toSubmitItems.length))}
                        </button>
                    </div>
                </div>

                {/* Filter */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
                    <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className={selectCls}>
                        <option value="all">{t('travel.filterAllTeams')}</option>
                        {(empCategories || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
                        <option value="all">{t('travel.filterAllStatuses')}</option>
                        {SETTLEMENT_STATUS_ORDER.map(k => <option key={k} value={k}>{statusLabel(k)}</option>)}
                    </select>
                    <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} className={selectCls}>
                        <option value="all">{t('travel.filterAllEmployees')}</option>
                        {sortedEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={selectCls}>
                        <option value="all">{t('travel.filterAllYears')}</option>
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <div className="ml-auto flex gap-3 text-xs text-slate-500 items-center flex-wrap">
                        <span>{t('travel.sumRaw')}: <span className="font-semibold text-slate-800 tabular-nums">-{fmt2(totals.raw)} €</span></span>
                        <span>{t('travel.sumSubmitted')}: <span className="font-semibold text-emerald-700 tabular-nums">+{fmt2(totals.submitted)} €</span></span>
                        <span>{t('travel.sumAdjusted')}: <span className="font-semibold text-slate-900 tabular-nums">-{fmt2(totals.adjusted)} €</span></span>
                    </div>
                </div>

                {/* Team-Karten (einklappbar) */}
                {groups.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                        <EmptyState
                            icon={<IconFileText size={28}/>}
                            title={t('travel.emptyTitle')}
                            description={t('travel.emptyDesc')}
                            action={{ label: t('travel.importBtn'), onClick: () => setIsImportOpen(true) }}
                        />
                    </div>
                ) : groups.map(g => {
                    const collapsed = !!collapsedTeams[g.team];
                    return (
                    <div key={g.team} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3">
                            <button onClick={() => setCollapsedTeams(prev => ({ ...prev, [g.team]: !collapsed }))}
                                className="flex items-center gap-2 text-left group"
                                title={collapsed ? t('travel.expand') : t('travel.collapse')}>
                                <span className={`transition-transform text-slate-400 text-xs ${collapsed ? '' : 'rotate-90'}`}>▶</span>
                                <h3 className="text-slate-900 text-base font-medium group-hover:text-gea-700">{t('travel.teamPrefix')} {g.team}</h3>
                            </button>
                            {g.kst ? (
                                <span className="text-xs px-2 py-0.5 rounded-full border font-mono font-medium bg-gea-50 border-gea-200 text-gea-800">
                                    {t('cats.kst')} {g.kst}
                                </span>
                            ) : (
                                <button onClick={() => setActiveTab('setup_cats')}
                                    className="text-xs px-2 py-0.5 rounded-full border font-medium bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
                                    title={t('travel.kstMissingHint')}>
                                    ⚠ {t('travel.kstMissing')}
                                </button>
                            )}
                            {/* Kompakt-Summen im Kopf, damit die Karte auch eingeklappt aussagekräftig ist */}
                            <span className="text-xs text-slate-500 tabular-nums">
                                -{fmt2(g.raw)} € · {t('travel.colAdjusted')}: <span className="font-semibold text-slate-800">-{fmt2(g.adjusted)} €</span>
                            </span>
                            <div className="ml-auto">
                                {g.toSubmit > 0 && (
                                    <button onClick={() => bulkRemainOnKst(g)}
                                        className="text-xs font-medium text-slate-500 hover:text-slate-700 underline decoration-dotted">
                                        {t('travel.bulkRemainBtn')}
                                    </button>
                                )}
                            </div>
                        </div>

                        {!collapsed && (<>
                        <div className="p-4 flex flex-wrap gap-3">
                            {statTile(t('travel.colRaw'), `-${fmt2(g.raw)} €`, 'text-rose-700')}
                            {statTile(t('travel.colToSubmit'), `${fmt2(g.toSubmit)} €`, 'text-amber-700')}
                            {statTile(t('travel.colRemain'), `${fmt2(g.remain)} €`, 'text-slate-700')}
                            {statTile(t('travel.colSubmitted'), `+${fmt2(g.submitted)} €`, 'text-emerald-700')}
                            {statTile(t('travel.colAdjusted'), `-${fmt2(g.adjusted)} €`)}
                            {g.otherKst > 0 && statTile(t('travel.colOtherKst'), `${fmt2(g.otherKst)} €`, 'text-sky-700')}
                            {g.invoicesRaw > 0 && statTile(t('travel.colInvoices'), `-${fmt2(g.invoicesAdjusted)} €`, 'text-violet-700')}
                        </div>

                        <table className="w-full text-left text-sm border-t border-slate-100">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-3 w-8"></th>
                                    {sortHeader('emp', t('travel.colEmployee'))}
                                    {sortHeader('project', t('travel.colProject'))}
                                    {sortHeader('kw', t('util.kw'), 'text-center')}
                                    {sortHeader('reportKey', t('travel.colReportKey'))}
                                    {sortHeader('amount', t('travel.colAmount'), 'text-right')}
                                    <th className="p-3 text-slate-500 font-medium">{t('travel.colTarget')}</th>
                                    {sortHeader('status', t('travel.colStatus'))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortItems(g.items).map(ci => {
                                    const emp = employeeById.get(ci.empId);
                                    const proj = ci.projectId ? projectById.get(ci.projectId) : null;
                                    const status = getSettlementStatus(ci);
                                    const cfg = SETTLEMENT_STATUSES[status];
                                    const invoiceItem = isInvoiceItem(ci);
                                    const open = !!expandedItems[ci.id];
                                    return (
                                        <React.Fragment key={ci.id}>
                                        <tr className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3">
                                                <button onClick={() => setExpandedItems(prev => ({ ...prev, [ci.id]: !open }))}
                                                    title={t('travel.detailsHint')}
                                                    className={`transition-transform text-slate-400 text-xs ${open ? 'rotate-90' : ''}`}>▶</button>
                                            </td>
                                            <td className="p-3 text-slate-800 font-medium">
                                                <span className="inline-flex items-center gap-1.5">
                                                    {emp?.name || '–'}
                                                    {invoiceItem && (
                                                        <span title={t('travel.invoiceChipHint')}
                                                            className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium bg-violet-100 border-violet-200 text-violet-700">
                                                            {t('travel.invoiceChip')}
                                                        </span>
                                                    )}
                                                </span>
                                                {ci.description && <span className="block text-xs text-slate-400 font-normal truncate max-w-[14rem]">{ci.description}</span>}
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {proj ? (
                                                    <button onClick={() => openProject(proj.id)}
                                                        title={t('travel.openProjectHint')}
                                                        className="text-gea-600 hover:text-gea-700 hover:underline font-medium text-left">
                                                        {proj.name}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-slate-100 border-slate-200 text-slate-600">
                                                        {t('travel.internal')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-slate-500 text-xs text-center whitespace-nowrap">{kwLabel(ci)}</td>
                                            <td className="p-3 text-slate-500 text-xs font-mono">{ci.reportKey || '–'}</td>
                                            <td className="p-3 text-right text-slate-900 font-medium tabular-nums whitespace-nowrap">{fmt2(settlementAmount(ci))} €</td>
                                            <td className="p-3">
                                                <input type="text" value={ci.targetAccount || ''}
                                                    onChange={e => setTargetAccount(ci.id, e.target.value)}
                                                    placeholder={proj?.kst || t('travel.targetPlaceholder')}
                                                    title={t('travel.targetHint')}
                                                    className="w-28 p-1.5 border border-slate-300 rounded text-sm font-mono"/>
                                            </td>
                                            <td className="p-3">
                                                {/* Invoice-Posten durchlaufen denselben Status-Workflow wie
                                                    normale Kostenpunkte (nur die Bilanzierung läuft getrennt) –
                                                    kein starrer Chip, volle Statuswahl. */}
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}/>
                                                    <select value={status}
                                                        onChange={e => requestStatusChange(ci, e.target.value)}
                                                        className={`p-1.5 border rounded-md text-xs font-medium ${cfg.chip}`}>
                                                        {SETTLEMENT_STATUS_ORDER.map(k =>
                                                            <option key={k} value={k}>{statusLabel(k)}</option>)}
                                                    </select>
                                                </div>
                                                {status === 'submitted' && ci.submittedAt && (
                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                        {new Date(ci.submittedAt).toLocaleDateString('de-DE')}{ci.submittedBy ? ` · ${ci.submittedBy}` : ''}
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                        {open && (
                                            <tr className="bg-slate-50/60">
                                                <td className="p-0"></td>
                                                <td colSpan={7} className="px-3 pb-3 pt-1">
                                                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                                                        {(ci.lines || []).map(l => {
                                                            const lcfg = COST_LINE_TYPES[l.type] || COST_LINE_TYPES.other;
                                                            // Verschieben nur für Reisekosten-Zeilen (keine Stunden):
                                                            // Projekt-Posten → auf KST herauslösen; interne Posten →
                                                            // zurück zum Projekt-Gegenstück derselben Reise (falls vorhanden).
                                                            const projSibling = (!ci.projectId && l.type !== 'hours')
                                                                ? findTripSibling(costItems, ci, true) : null;
                                                            const canMove = l.type !== 'hours' && (ci.projectId || projSibling);
                                                            return (
                                                                <div key={l.id} className="flex items-center gap-2 text-xs">
                                                                    <span className={`px-2 py-0.5 rounded-full border font-medium shrink-0 ${lcfg.chip}`}>{lcfg.label}</span>
                                                                    {l.type === 'hours' && l.hours != null && (
                                                                        <span className="text-slate-500 tabular-nums">{l.hours}h × {l.hourlyRate}€</span>
                                                                    )}
                                                                    {l.comment && <span className="text-slate-500 truncate">{l.comment}</span>}
                                                                    <span className="text-slate-700 tabular-nums ml-auto">{(l.amount || 0).toFixed(2)} €</span>
                                                                    {canMove && (
                                                                        <button onClick={() => moveLine(ci, l)}
                                                                            title={ci.projectId ? t('travel.moveToKstHint') : t('travel.moveToProjectHint').replace('{project}', projectById.get(projSibling?.projectId)?.name || '')}
                                                                            className="shrink-0 px-2 py-0.5 rounded border border-slate-300 text-slate-500 hover:border-gea-400 hover:text-gea-700 hover:bg-gea-50 font-medium">
                                                                            {ci.projectId ? `→ ${t('travel.moveToKst')}` : `→ ${t('travel.moveToProject')}`}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        <div className="flex items-center gap-3 pt-1.5 border-t border-slate-100 text-xs text-slate-400">
                                                            {ci.expenseReportId && <span>{t('expense.reportId')}: <span className="font-mono">{ci.expenseReportId}</span></span>}
                                                            {ci.dateFrom && <span>{ci.dateFrom}{ci.dateTo ? ` – ${ci.dateTo}` : ''}</span>}
                                                            <button onClick={() => setEditItem(ci)}
                                                                className="ml-auto text-gea-600 hover:text-gea-700 font-medium">{t('btn.edit')}</button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                        </>)}
                    </div>
                    );
                })}

                {/* Sende-Dialog: Auswahl der zu übermittelnden Reisen */}
                {isSendOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                            <ModalHeader title={t('travel.sendModalTitle')} subtitle={t('travel.sendModalHint')} onClose={() => setIsSendOpen(false)}/>
                            <div className="p-5 space-y-3 overflow-y-auto flex-1">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <select value={sendTeam} onChange={e => setSendTeam(e.target.value)} className={selectCls}>
                                        <option value="all">{t('travel.filterAllTeams')}</option>
                                        {sendTeams.map(tm => <option key={tm} value={tm}>{tm}</option>)}
                                    </select>
                                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                                        <input type="checkbox" checked={allVisibleChecked}
                                            onChange={e => toggleAllVisible(e.target.checked)}
                                            className="w-4 h-4 text-gea-600 rounded"/>
                                        {t('travel.selectAllVisible')}
                                    </label>
                                </div>
                                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                                    {sendVisible.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-400">{t('travel.nothingToSubmit')}</div>
                                    ) : sendVisible.map(ci => {
                                        const emp = employeeById.get(ci.empId);
                                        const proj = ci.projectId ? projectById.get(ci.projectId) : null;
                                        const team = empTeam(ci.empId);
                                        return (
                                            <label key={ci.id} className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 select-none">
                                                <input type="checkbox" checked={!!sendSel[ci.id]}
                                                    onChange={e => setSendSel(prev => ({ ...prev, [ci.id]: e.target.checked }))}
                                                    className="w-4 h-4 text-gea-600 rounded shrink-0"/>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-slate-800 font-medium">{emp?.name || '–'}</span>
                                                    <span className="text-slate-400 text-xs ml-2">
                                                        {[team + (teamKst?.[team] ? ` (${t('cats.kst')} ${teamKst[team]})` : ''),
                                                          proj ? proj.name : t('travel.internal'),
                                                          kwLabel(ci)].filter(Boolean).join(' · ')}
                                                    </span>
                                                </div>
                                                {ci.reportKey && <span className="text-xs text-slate-400 font-mono shrink-0">{ci.reportKey}</span>}
                                                <span className="text-slate-900 font-medium tabular-nums shrink-0">{fmt2(settlementAmount(ci))} €</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">
                                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                                    <IconCopy size={14} className="shrink-0 mt-0.5"/>
                                    <span>{t('travel.copyPasteHint')}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div>
                                        <p className="text-xs text-slate-500">{t('travel.selectedSum').replace('{count}', String(sendSelected.length))}</p>
                                        <p className="text-lg text-gea-600 font-semibold tabular-nums">{fmt2(sendSelectedTotal)} €</p>
                                    </div>
                                    <div className="ml-auto flex gap-2">
                                        <button onClick={() => setIsSendOpen(false)}
                                            className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium">
                                            {t('btn.cancel')}
                                        </button>
                                        <button onClick={copySelection} disabled={sendSelected.length === 0}
                                            title={t('travel.copyHint')}
                                            className="px-4 py-2 text-sm font-medium bg-amber-100 border-2 border-amber-400 rounded-md hover:bg-amber-200 text-amber-900 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm">
                                            <IconCopy size={14}/> {t('travel.copyBtn')}
                                        </button>
                                        <button onClick={sendSelection} disabled={sendSelected.length === 0}
                                            className="px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                                            <IconExternalLink size={14}/> {t('travel.openMailBtn')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isImportOpen && (
                    <ExpenseImportModal
                        proj={null}
                        projects={projects}
                        teamKst={teamKst}
                        computeAutoStatus={computeAutoStatus}
                        employees={employees}
                        assignments={assignments}
                        costItems={costItems}
                        setCostItems={setCostItems}
                        handleSaveAssignment={handleSaveAssignment}
                        empAliases={empAliases}
                        setEmpAliases={setEmpAliases}
                        fxRates={fxRates}
                        setFxRates={setFxRates}
                        expenseCategories={expenseCategories}
                        showToast={showToast}
                        onClose={() => setIsImportOpen(false)}
                        t={t}
                    />
                )}

                {editItem && (
                    <CostItemModal
                        projectId={editItem.projectId ?? null}
                        existingItem={editItem}
                        assignments={assignments}
                        employees={employees}
                        costItems={costItems}
                        setCostItems={setCostItems}
                        showToast={showToast}
                        onClose={() => setEditItem(null)}
                        t={t}
                    />
                )}
            </div>
        </div>
    );
};
