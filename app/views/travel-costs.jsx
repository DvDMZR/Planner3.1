// ─── REISEKOSTENÜBERSICHT (Verwaltung) ───────────────────────────────────────
// Steuerungs- und Tracking-Dashboard für Prozess 2: Gutschrift der Reisekosten
// auf die Team-KST durch die interne Buchhaltung. Zeigt je Team das
// Gesamtminus, die angeforderten Gutschriften und das bereinigte KST-Budget;
// erlaubt Status-/Gegenkonto-Pflege je Kostenpunkt, den Mitarbeiter-basierten
// Spesen-Import und den E-Mail-Versand an die Buchhaltung.
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
        handleSaveAssignment, showToast, requestConfirm, logAudit,
    } = h;

    const [teamFilter, setTeamFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [empFilter, setEmpFilter] = useState('all');
    // Default: laufendes Jahr – hält Alt-Bestände aus dem Blick, bis sie
    // bewusst über den Jahresfilter geholt werden.
    const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
    const [isImportOpen, setIsImportOpen] = useState(false);

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

    const toSubmitItems = useMemo(
        () => filtered.filter(ci => getSettlementStatus(ci) === 'to_submit'),
        [filtered]);

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

    // ── E-Mail an die Buchhaltung + Bestätigungs-Dialog ──────────────────────
    const buildMail = () => buildAccountingEmail(toSubmitItems, employees, projects, teamKst);

    const markSubmitted = (items, total) => {
        const ids = new Set(items.map(i => i.id));
        const now = new Date().toISOString();
        setCostItems(prev => prev.map(c => ids.has(c.id)
            ? { ...c, settlementStatus: 'submitted', submittedAt: now, submittedBy: currentUser?.name || null } : c));
        logAudit('settlement_submitted',
            `${items.length} Reisekosten-Posten (${fmt2(total)} EUR) an Buchhaltung übermittelt`);
        showToast(t('travel.markedSubmitted'), { type: 'success', duration: 4000 });
    };

    const copyToClipboard = () => {
        if (toSubmitItems.length === 0) { showToast(t('travel.nothingToSubmit'), { type: 'warning' }); return; }
        const mail = buildMail();
        const text = `${mail.subject}\n\n${mail.body}`;
        const done = () => showToast(t('travel.copied'), { type: 'success', duration: 3000 });
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => {
                showToast(t('travel.copyFailed'), { type: 'error' });
            });
        } else {
            showToast(t('travel.copyFailed'), { type: 'error' });
        }
    };

    const sendToAccounting = () => {
        if (toSubmitItems.length === 0) { showToast(t('travel.nothingToSubmit'), { type: 'warning' }); return; }
        if (!(accountingRecipient || '').trim()) {
            showToast(t('travel.noRecipient'), { type: 'error', duration: 7000 });
            return;
        }
        const items = toSubmitItems;
        const mail = buildMail();
        const url = `mailto:${encodeURIComponent(accountingRecipient)}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;
        // mailto-Links werden von Clients ab ~2000 Zeichen abgeschnitten –
        // dann den Text stattdessen über die Zwischenablage transportieren.
        if (url.length > 1800) {
            showToast(t('travel.mailTooLong'), { type: 'warning', duration: 8000 });
        }
        window.location.href = url;
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
                        <button onClick={() => setIsImportOpen(true)}
                            className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-md hover:bg-gea-50 hover:border-gea-400 text-slate-700 flex items-center gap-2">
                            <IconUpload size={15}/> {t('travel.importBtn')}
                        </button>
                        <button onClick={copyToClipboard}
                            title={t('travel.copyHint')}
                            className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-md hover:bg-gea-50 hover:border-gea-400 text-slate-700 flex items-center gap-2">
                            <IconCopy size={15}/> {t('travel.copyBtn')}
                        </button>
                        <button onClick={sendToAccounting} disabled={toSubmitItems.length === 0}
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

                {/* Team-Karten */}
                {groups.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                        <EmptyState
                            icon={<IconFileText size={28}/>}
                            title={t('travel.emptyTitle')}
                            description={t('travel.emptyDesc')}
                            action={{ label: t('travel.importBtn'), onClick: () => setIsImportOpen(true) }}
                        />
                    </div>
                ) : groups.map(g => (
                    <div key={g.team} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3">
                            <h3 className="text-slate-900 text-base font-medium">{t('travel.teamPrefix')} {g.team}</h3>
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
                            <div className="ml-auto">
                                {g.toSubmit > 0 && (
                                    <button onClick={() => bulkRemainOnKst(g)}
                                        className="text-xs font-medium text-slate-500 hover:text-slate-700 underline decoration-dotted">
                                        {t('travel.bulkRemainBtn')}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-4 flex flex-wrap gap-3">
                            {statTile(t('travel.colRaw'), `-${fmt2(g.raw)} €`, 'text-rose-700')}
                            {statTile(t('travel.colToSubmit'), `${fmt2(g.toSubmit)} €`, 'text-amber-700')}
                            {statTile(t('travel.colRemain'), `${fmt2(g.remain)} €`, 'text-slate-700')}
                            {statTile(t('travel.colSubmitted'), `+${fmt2(g.submitted)} €`, 'text-emerald-700')}
                            {statTile(t('travel.colAdjusted'), `-${fmt2(g.adjusted)} €`)}
                        </div>

                        <table className="w-full text-left text-sm border-t border-slate-100">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-3 text-slate-500 font-medium">{t('travel.colEmployee')}</th>
                                    <th className="p-3 text-slate-500 font-medium">{t('travel.colProject')}</th>
                                    <th className="p-3 text-slate-500 font-medium text-center">{t('util.kw')}</th>
                                    <th className="p-3 text-slate-500 font-medium">{t('travel.colReportKey')}</th>
                                    <th className="p-3 text-slate-500 font-medium text-right">{t('travel.colAmount')}</th>
                                    <th className="p-3 text-slate-500 font-medium">{t('travel.colTarget')}</th>
                                    <th className="p-3 text-slate-500 font-medium">{t('travel.colStatus')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {g.items.map(ci => {
                                    const emp = employeeById.get(ci.empId);
                                    const proj = ci.projectId ? projectById.get(ci.projectId) : null;
                                    const status = getSettlementStatus(ci);
                                    const cfg = SETTLEMENT_STATUSES[status];
                                    return (
                                        <tr key={ci.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 text-slate-800 font-medium">
                                                {emp?.name || '–'}
                                                {ci.description && <span className="block text-xs text-slate-400 font-normal truncate max-w-[14rem]">{ci.description}</span>}
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {proj ? proj.name : (
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ))}

                {isImportOpen && (
                    <ExpenseImportModal
                        proj={null}
                        projects={projects}
                        teamKst={teamKst}
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
            </div>
        </div>
    );
};
