// ─── SPESEN-IMPORT (Expense Tracking) ────────────────────────────────────────
// Modal-Workflow: ERP-Text einfügen → parsen → Mitarbeiter zuordnen (Alias-
// System) → Planungs-Check je Kalenderwoche → Beträge in EUR prüfen/editieren
// → als Kostenpunkt (lines) speichern.
// Zwei Einstiege:
//   - Projekt-Import (project-details): `proj` ist gesetzt, Ziel fixiert.
//   - Mitarbeiter-Import (Reisekostenübersicht): `proj` ist null; das Ziel-
//     Projekt wird aus der Einsatzplanung vorgeschlagen oder der Import wird
//     als interne KST-Kosten (projectId null) gebucht.
const ExpenseImportModal = ({
    proj,
    projects = [],
    teamKst = {},
    computeAutoStatus = null,
    employees,
    assignments,
    costItems,
    setCostItems,
    handleSaveAssignment,
    empAliases,
    setEmpAliases,
    fxRates,
    setFxRates,
    expenseCategories,
    showToast,
    onClose,
    t = (k) => k,
}) => {
    const { useState, useMemo } = React;
    useEscapeToClose(onClose);
    const fixedProject = proj || null;

    const [step, setStep] = useState('paste');        // 'paste' | 'review'
    const [rawText, setRawText] = useState('');
    const [parseError, setParseError] = useState(null);
    const [parsed, setParsed] = useState(null);        // { header, items, warnings }
    // Editierbare Posten: { ...item, included, eur (String für freie Eingabe) }
    const [rows, setRows] = useState([]);
    const [assignedEmpId, setAssignedEmpId] = useState('');
    const [fxRate, setFxRate] = useState('');
    const [addWeeksSel, setAddWeeksSel] = useState({}); // { weekId: bool }
    const [openCats, setOpenCats] = useState({});       // Accordion-Zustand
    // Ziel der Buchung (nur im Mitarbeiter-Import wählbar):
    //   'auto'     – bestgeplantes Projekt aus der Einsatzplanung, sonst intern
    //   'internal' – interne KST-Kosten (projectId null)
    //   'other'    – freie Projektwahl über `otherProjectId`
    //   <projId>   – explizit gewähltes vorgeschlagenes Projekt
    const [targetChoice, setTargetChoice] = useState('auto');
    const [otherProjectId, setOtherProjectId] = useState('');
    // Gegenkonto/Ziel-Stelle für die Umbuchung durch die Buchhaltung; wird mit
    // der Projekt-KST vorbelegt, bis der Nutzer das Feld anfasst.
    const [targetAccount, setTargetAccount] = useState(fixedProject?.kst || '');
    const [targetAccountTouched, setTargetAccountTouched] = useState(false);
    // Gutschrift-Status: null = automatischer Default (Projekt → to_submit,
    // intern → remain_on_kst), sonst explizite Wahl des Nutzers.
    const [settleStatusSel, setSettleStatusSel] = useState(null);

    const safeNum = (v) => {
        const n = parseFloat(String(v).replace(',', '.'));
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    // Projekt-Anzeige wie in den Planungsdialogen: Anlagentyp, Name, Größe,
    // dazu das Land (Kurzcode) zur schnelleren Orientierung.
    const projLabel = (p) => {
        const cc = resolveCountryCode(p.country);
        return [p.projType, p.name, p.size, (cc && cc !== '/' && cc !== '??') ? cc : '']
            .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
            .join(' ');
    };
    const sortedProjects = useMemo(
        () => [...(projects || [])].sort((a, b) => projLabel(a).localeCompare(projLabel(b), 'de')),
        [projects]);

    // Projekt-Suchauswahl: Standard sind angefangene sowie vergangene Projekte,
    // deren Kosten noch nicht übermittelt wurden (active/missing_costs/
    // completed); "Fängt noch an" und "Kosten übermittelt" sind zuschaltbar.
    const [projSearch, setProjSearch] = useState('');
    const [showAllProjects, setShowAllProjects] = useState(false);
    const DEFAULT_PICKER_STATUSES = ['active', 'missing_costs', 'completed'];
    const pickerProjects = useMemo(() => {
        const q = projSearch.trim().toLowerCase();
        return sortedProjects.filter(p => {
            if (!showAllProjects && typeof computeAutoStatus === 'function'
                && !DEFAULT_PICKER_STATUSES.includes(computeAutoStatus(p))
                && p.id !== otherProjectId) return false;
            return !q || projLabel(p).toLowerCase().includes(q);
        });
    }, [sortedProjects, projSearch, showAllProjects, computeAutoStatus, otherProjectId]);
    const activeEmployees = useMemo(
        () => (employees || []).filter(e => e.active !== false),
        [employees]);
    // Konfigurierbare Kategorien (Verwaltung → Kategorien → Spesen-Kategorien)
    const cats = useMemo(() => normalizeExpenseCategories(expenseCategories), [expenseCategories]);
    const catById = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats]);
    const catChip = (cat) => (COST_LINE_TYPES[cat?.lineType] || COST_LINE_TYPES.other).chip;
    // Merker: wurde der Mitarbeiter nur per Namensbestandteil vorgeschlagen?
    const [suggestedEmpId, setSuggestedEmpId] = useState(null);

    // ── Schritt 1 → 2: Parsen ────────────────────────────────────────────────
    const handleParse = () => {
        const result = parseExpenseReport(rawText, expenseCategories);
        if (!result.ok) {
            setParseError(t(result.error === 'empty' ? 'expense.errEmpty' : 'expense.errNoHeader'));
            return;
        }
        if (result.items.length === 0) {
            setParseError(t('expense.errNoItems'));
            return;
        }
        setParseError(null);
        const cur = result.header.currency || 'EUR';
        const rate = (fxRates && Number.isFinite(fxRates[cur])) ? fxRates[cur]
                   : (DEFAULT_FX_RATES[cur] ?? '');
        setFxRate(String(rate));
        setRows(result.items.map(it => ({
            ...it,
            included: true,
            // Bei Projekt-Zuordnung abwählbar: Posten mit toKst landen nicht
            // auf dem Projekt, sondern verbleiben auf der Team-KST.
            toKst: false,
            eur: Number.isFinite(convertToEur(it.amount, it.currency, fxRates))
                ? String(convertToEur(it.amount, it.currency, fxRates))
                : '',
        })));
        // Mitarbeiter auflösen; ohne exakten Match ggf. Vorschlag vorbelegen
        // (z. B. eindeutiger Nachname) – muss vom Nutzer bestätigt werden.
        const emp = findEmployeeForExpense(result.header.employeeName, employees, empAliases);
        if (emp) {
            setAssignedEmpId(emp.id);
            setSuggestedEmpId(null);
        } else {
            const suggestion = suggestEmployeeForExpense(result.header.employeeName, activeEmployees);
            setAssignedEmpId(suggestion ? suggestion.id : '');
            setSuggestedEmpId(suggestion ? suggestion.id : null);
        }
        setParsed(result);
        setStep('review');
    };

    // ── Abgeleitete Review-Daten ─────────────────────────────────────────────
    const matchedEmp = useMemo(() => {
        if (!parsed) return null;
        return findEmployeeForExpense(parsed.header.employeeName, employees, empAliases);
    }, [parsed, employees, empAliases]);
    const effectiveEmpId = matchedEmp ? matchedEmp.id : assignedEmpId;
    const needsManualAssign = parsed && !matchedEmp;

    const currency = parsed?.header.currency || 'EUR';
    const isForeignCurrency = currency !== 'EUR';

    // Mitarbeiter-Import: Auf welchen Projekten war der Mitarbeiter in den
    // KWs der Posten laut Einsatzplanung im Einsatz? → Vorschlagsliste für
    // das Buchungsziel, sortiert nach Zahl der überlappenden Wochen.
    const plannedProjects = useMemo(() => {
        if (fixedProject || !effectiveEmpId || rows.length === 0) return [];
        const itemWeeks = new Set(rows.map(r => r.week));
        const byProject = new Map();
        (assignments || []).forEach(a => {
            if (a.empId !== effectiveEmpId || a.type !== 'project' || !itemWeeks.has(a.week)) return;
            if (!byProject.has(a.reference)) byProject.set(a.reference, new Set());
            byProject.get(a.reference).add(a.week);
        });
        return [...byProject.entries()]
            .map(([pid, weeks]) => ({
                project: (projects || []).find(p => p.id === pid),
                weeks: [...weeks].sort(compareWeekIds),
            }))
            .filter(e => e.project)
            .sort((a, b) => projLabel(a.project).localeCompare(projLabel(b.project), 'de'));
    }, [fixedProject, effectiveEmpId, rows, assignments, projects]);

    // Effektives Buchungsziel aus der Wahl ableiten. 'auto' folgt der
    // Einsatzplanung (Projekt mit den meisten überlappenden Wochen), sonst
    // gilt die explizite Wahl.
    const autoTargetId = plannedProjects.reduce(
        (best, e) => (!best || e.weeks.length > best.weeks.length) ? e : best, null)?.project.id || null;
    const targetProjectId = fixedProject ? fixedProject.id
        : targetChoice === 'auto'     ? autoTargetId
        : targetChoice === 'internal' ? null
        : targetChoice === 'other'    ? (otherProjectId || null)
        : targetChoice;

    const targetProject = fixedProject
        || (targetProjectId ? (projects || []).find(p => p.id === targetProjectId) || null : null);

    // Gegenkonto mit der KST des Ziel-Projekts vorbelegen (Nutzer-Eingabe gewinnt).
    React.useEffect(() => {
        if (targetAccountTouched) return;
        setTargetAccount(targetProject?.kst || '');
    }, [targetProject, targetAccountTouched]);

    // Gutschrift-Status: expliziter Nutzer-Wunsch oder Default nach Kostenart.
    const effectiveSettleStatus = settleStatusSel
        || (targetProjectId ? 'to_submit' : 'remain_on_kst');

    // Planungs-Check: In welchen KWs der Posten war der Mitarbeiter NICHT für
    // das Ziel-Projekt verplant? (entfällt bei interner Buchung)
    const missingWeeks = useMemo(() => {
        if (!effectiveEmpId || rows.length === 0 || !targetProjectId) return [];
        const itemWeeks = [...new Set(rows.map(r => r.week))].sort(compareWeekIds);
        const planned = new Set((assignments || [])
            .filter(a => a.empId === effectiveEmpId && a.type === 'project' && a.reference === targetProjectId)
            .map(a => a.week));
        return itemWeeks.filter(w => !planned.has(w));
    }, [effectiveEmpId, rows, assignments, targetProjectId]);

    // Neu erkannte fehlende Wochen standardmäßig zum Hinzufügen vormerken
    // (der Nutzer kann sie einzeln abwählen).
    React.useEffect(() => {
        setAddWeeksSel(prev => {
            const next = { ...prev };
            missingWeeks.forEach(w => { if (!(w in next)) next[w] = true; });
            return next;
        });
    }, [missingWeeks]);

    // Duplikat-Erkennung über die Abrechnungs-ID: beim Projekt-Import
    // projektbezogen (Ersetzen), beim Mitarbeiter-Import global – die ERP-ID
    // ist firmenweit eindeutig. Treffer auf anderen Projekten lösen nur eine
    // Warnung aus (`elsewhere`).
    const dupInfo = useMemo(() => {
        if (!parsed?.header.reportId) return { duplicate: null, elsewhere: null };
        return findDuplicateExpenseReport(costItems, parsed.header.reportId, targetProjectId);
    }, [parsed, costItems, targetProjectId]);
    const duplicate = dupInfo.duplicate;

    // Ebene 1: Summen je Kategorie (nur eingeschlossene Posten, EUR)
    const sums = useMemo(() => {
        const s = { total: 0 };
        cats.forEach(c => { s[c.id] = 0; });
        rows.forEach(r => {
            if (!r.included) return;
            const v = safeNum(r.eur);
            s[catById.has(r.category) ? r.category : 'other'] += v;
            s.total += v;
        });
        return s;
    }, [rows, cats, catById]);

    const updateRow = (id, patch) =>
        setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    const deleteRow = (id) =>
        setRows(prev => prev.filter(r => r.id !== id));

    // Kurs auf alle Zeilen anwenden (überschreibt manuelle EUR-Korrekturen –
    // deshalb expliziter Button statt Live-Neuberechnung).
    const applyFxRate = () => {
        const rate = safeNum(fxRate);
        if (rate <= 0) return;
        setRows(prev => prev.map(r => ({
            ...r,
            eur: String(Math.round(r.amount * (r.currency === 'EUR' ? 1 : rate) * 100) / 100),
        })));
    };

    const fmtDate = (iso) => {
        const [y, m, d] = (iso || '').split('-');
        return d && m ? `${d}.${m}.${y.slice(2)}` : iso;
    };

    // ── Speichern ────────────────────────────────────────────────────────────
    const handleSave = () => {
        if (!effectiveEmpId) return;
        const included = rows.filter(r => r.included);
        if (included.length === 0) return;

        // Alias lernen, wenn manuell zugeordnet wurde
        if (needsManualAssign) {
            const norm = normalizeEmpName(parsed.header.employeeName);
            if (norm) setEmpAliases(prev => ({ ...prev, [norm]: effectiveEmpId }));
        }
        // Verwendeten Kurs für die Währung persistieren
        if (isForeignCurrency && safeNum(fxRate) > 0) {
            setFxRates(prev => ({ ...(prev || {}), [currency]: safeNum(fxRate) }));
        }
        // Fehlende Wochen zur Planung hinzufügen (0 h = "Unter Vorbehalt")
        missingWeeks.filter(w => addWeeksSel[w]).forEach(week => {
            handleSaveAssignment({ empId: effectiveEmpId, week, type: 'project', reference: targetProjectId, hours: 0 });
        });

        const makeLines = (rs) => rs.map(r => {
            const cat = catById.get(r.category) || catById.get('other');
            // Custom-Kategorien landen in ihrer Export-Kostenart (lineType);
            // ihr Label wandert in den Kommentar, damit die Info erhalten bleibt.
            const labelPrefix = cat.builtin ? null : cat.label;
            return {
                id: makeId('cl'),
                type: cat.lineType,
                amount: safeNum(r.eur),
                comment: [labelPrefix, r.type, r.vendor, r.location, fmtDate(r.date)].filter(Boolean).join(' · '),
            };
        });
        const makeItem = (rs, { base, projId, status, tgtAccount, descSuffix }) => {
            const dates = rs.map(r => r.date).sort();
            const lines = makeLines(rs);
            return {
                // Beim Ersetzen eines Duplikats bleiben dessen übrige Felder
                // erhalten; alles Import-Relevante wird explizit neu gesetzt.
                ...(base || {}),
                id: base?.id || makeId('ci'),
                projectId: projId,
                empId: effectiveEmpId,
                description: [`${t('expense.descPrefix')} ${parsed.header.reportName || ''}`.trim(), descSuffix]
                    .filter(Boolean).join(' · '),
                dateFrom: dates[0] || null,
                dateTo: dates.length > 1 ? dates[dates.length - 1] : null,
                week: dates[0] ? getWeekString(new Date(dates[0])) : null,
                lines,
                amount: lines.reduce((s, l) => s + l.amount, 0),
                expenseReportId: parsed.header.reportId || null,
                // Gutschrift-Tracking (Prozess 2)
                reportKey: parsed.header.reportKey || null,
                targetAccount: tgtAccount,
                settlementStatus: status,
            };
        };

        // Split: Bei Projekt-Zuordnung können einzelne Posten "abgehakt"
        // werden (toKst) – sie landen dann in einem zweiten, internen
        // Kostenpunkt und verbleiben auf der Team-KST.
        const projectRows = targetProjectId ? included.filter(r => !r.toKst) : [];
        const kstRows = targetProjectId ? included.filter(r => r.toKst) : included;
        const reportId = parsed.header.reportId || null;
        // Früheren internen Anteil desselben Reports wiederverwenden (Re-Import)
        const prevInternal = reportId
            ? (costItems || []).find(c => c.expenseReportId === reportId && c.projectId == null) || null
            : null;

        const newItems = [];
        if (projectRows.length > 0) {
            newItems.push(makeItem(projectRows, {
                base: duplicate && duplicate.projectId === targetProjectId ? duplicate : null,
                projId: targetProjectId,
                status: effectiveSettleStatus,
                tgtAccount: targetAccount.trim() || null,
            }));
        }
        if (kstRows.length > 0) {
            const isSplit = !!targetProjectId;
            newItems.push(makeItem(kstRows, {
                base: prevInternal,
                projId: null,
                status: isSplit ? 'remain_on_kst' : effectiveSettleStatus,
                tgtAccount: isSplit ? null : (targetAccount.trim() || null),
                descSuffix: isSplit ? t('expense.kstSplitSuffix') : null,
            }));
        }

        // Frühere Kostenpunkte desselben Reports im verwalteten Scope
        // (Ziel-Projekt + interner Anteil) ersetzen, dann neu anfügen.
        setCostItems(prev => {
            const keep = reportId
                ? prev.filter(c => !(c.expenseReportId === reportId
                    && (c.projectId === targetProjectId || c.projectId == null)))
                : prev;
            return [...keep, ...newItems];
        });
        showToast?.(t('expense.saved'), { type: 'success', duration: 4000 });
        onClose();
    };

    const canSave = step === 'review' && effectiveEmpId
        && rows.some(r => r.included && safeNum(r.eur) > 0);

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
                <ModalHeader title={t('expense.title')}
                    subtitle={fixedProject ? `${t('overview.colProject')}: ${fixedProject.name}` : t('expense.employeeBased')}
                    onClose={onClose}/>

                {step === 'paste' && (
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <p className="text-sm text-slate-600">{t('expense.pasteHint')}</p>
                        <textarea
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            autoFocus
                            placeholder={t('expense.pastePlaceholder')}
                            className="w-full h-72 p-3 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gea-400 focus:border-gea-500 resize-y"/>
                        {parseError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">{parseError}</div>
                        )}
                    </div>
                )}

                {step === 'review' && parsed && (
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        {/* Kopf-Infos */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div><span className="text-slate-400 block">{t('expense.reportName')}</span><span className="text-slate-800 font-medium">{parsed.header.reportName || '–'}</span></div>
                            <div><span className="text-slate-400 block">{t('expense.reportId')}</span><span className="text-slate-800 font-mono">{parsed.header.reportId || '–'}</span></div>
                            <div><span className="text-slate-400 block">{t('expense.status')}</span><span className="text-slate-800">{[parsed.header.approvalStatus, parsed.header.paymentStatus].filter(Boolean).join(' · ') || '–'}</span></div>
                            <div><span className="text-slate-400 block">{t('expense.currency')}</span><span className="text-slate-800 font-medium">{currency}</span></div>
                        </div>

                        {duplicate && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
                                ⚠ {t('expense.duplicateHint')}
                            </div>
                        )}
                        {!duplicate && dupInfo.elsewhere && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
                                ⚠ {t('expense.duplicateElsewhere')}
                            </div>
                        )}
                        {parsed.warnings.filter(w => w.type === 'unparsedRow').length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                {t('expense.unparsedRows')}: {parsed.warnings.filter(w => w.type === 'unparsedRow').length}
                            </div>
                        )}

                        {/* Mitarbeiter-Zuordnung / Alias */}
                        <div className={`p-4 rounded-lg border ${needsManualAssign ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-200'}`}>
                            <div className="text-sm font-medium mb-1 text-slate-800">
                                {t('expense.employee')}: <span className="font-semibold">{parsed.header.employeeName}</span>
                                {parsed.header.employeeId && <span className="text-slate-400 font-normal ml-2">(ID {parsed.header.employeeId})</span>}
                            </div>
                            {!needsManualAssign ? (
                                <div className="text-sm text-emerald-700">✓ {t('expense.matched')}: {matchedEmp.name}</div>
                            ) : suggestedEmpId && assignedEmpId === suggestedEmpId ? (
                                <div className="space-y-2">
                                    <div className="text-sm text-rose-700">{t('expense.notFound')}</div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <select value={assignedEmpId} onChange={e => setAssignedEmpId(e.target.value)}
                                            className="p-2 border border-amber-400 rounded-md text-sm bg-white">
                                            <option value="">{t('expense.selectProfile')}</option>
                                            {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                        <span className="text-xs text-amber-700 font-medium">{t('expense.suggestion')}</span>
                                        <span className="text-xs text-slate-500">{t('expense.aliasHint')}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="text-sm text-rose-700">{t('expense.notFound')}</div>
                                    <div className="flex items-center gap-2">
                                        <select value={assignedEmpId} onChange={e => setAssignedEmpId(e.target.value)}
                                            className="p-2 border border-slate-300 rounded-md text-sm bg-white">
                                            <option value="">{t('expense.selectProfile')}</option>
                                            {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                        {assignedEmpId && <span className="text-xs text-slate-500">{t('expense.aliasHint')}</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Buchungsziel (nur Mitarbeiter-Import): Vorschlag aus
                            der Einsatzplanung, freie Projektwahl oder interne
                            KST-Kosten ohne Projekt. */}
                        {!fixedProject && effectiveEmpId && (
                            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                                <div className="text-sm font-medium text-slate-800">{t('expense.targetTitle')}</div>
                                {plannedProjects.length === 0 && (
                                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800">
                                        ⚠ {t('expense.noPlanningFound')}
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    {plannedProjects.map(({ project, weeks }) => (
                                        <label key={project.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                            <input type="radio" name="expTarget"
                                                checked={targetChoice === project.id || (targetChoice === 'auto' && autoTargetId === project.id)}
                                                onChange={() => setTargetChoice(project.id)}
                                                className="w-4 h-4 text-gea-600"/>
                                            <span className="text-slate-800 font-medium">{projLabel(project)}</span>
                                            <span className="text-xs text-slate-500">
                                                {t('expense.plannedInWeeks').replace('{weeks}', weeks.map(w => formatKW(w)).join(', '))}
                                            </span>
                                        </label>
                                    ))}
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                            <input type="radio" name="expTarget"
                                                checked={targetChoice === 'other'}
                                                onChange={() => setTargetChoice('other')}
                                                className="w-4 h-4 text-gea-600"/>
                                            <span className="text-slate-700">{t('expense.otherProject')}</span>
                                            {targetChoice === 'other' && otherProjectId && (
                                                <span className="text-xs text-gea-700 font-medium truncate">
                                                    {projLabel((projects || []).find(p => p.id === otherProjectId) || {})}
                                                </span>
                                            )}
                                        </label>
                                        {targetChoice === 'other' && (
                                            // Suchauswahl statt <select>: bei vielen Projekten
                                            // filterbar über Typ/Name/Größe/Land; Standard zeigt
                                            // nur laufende + vergangene ohne Kostenübermittlung.
                                            <div className="ml-6 border border-slate-200 rounded-lg bg-white overflow-hidden">
                                                <div className="p-2 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                                                    <input type="text" value={projSearch} autoFocus
                                                        onChange={e => setProjSearch(e.target.value)}
                                                        placeholder={t('expense.searchProject')}
                                                        className="flex-1 min-w-[10rem] p-1.5 border border-slate-300 rounded text-sm"/>
                                                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                                                        <input type="checkbox" checked={showAllProjects}
                                                            onChange={e => setShowAllProjects(e.target.checked)}
                                                            className="w-3.5 h-3.5 text-gea-600 rounded"/>
                                                        {t('expense.showAllProjects')}
                                                    </label>
                                                </div>
                                                <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
                                                    {pickerProjects.length === 0 ? (
                                                        <div className="p-3 text-xs text-slate-400">{t('expense.noProjectMatch')}</div>
                                                    ) : pickerProjects.map(p => (
                                                        <button key={p.id} type="button"
                                                            onClick={() => { setTargetChoice('other'); setOtherProjectId(p.id); }}
                                                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gea-50 ${otherProjectId === p.id ? 'bg-gea-50 text-gea-800 font-medium' : 'text-slate-700'}`}>
                                                            {projLabel(p)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                        <input type="radio" name="expTarget"
                                            checked={targetChoice === 'internal' || (targetChoice === 'auto' && !autoTargetId)}
                                            onChange={() => setTargetChoice('internal')}
                                            className="w-4 h-4 text-gea-600"/>
                                        <span className="text-slate-700">{t('expense.bookInternal')}</span>
                                        <span className="text-xs text-slate-400">{t('expense.bookInternalHint')}</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Verrechnung: Gutschrift-Status + Gegenkonto (Prozess 2) */}
                        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm text-slate-700 font-medium">{t('expense.settlement')}:</span>
                                <select value={effectiveSettleStatus}
                                    onChange={e => setSettleStatusSel(e.target.value)}
                                    className="p-1.5 border border-slate-300 rounded-md text-sm bg-white">
                                    <option value="to_submit">{t('travel.status.to_submit')}</option>
                                    <option value="remain_on_kst">{t('travel.status.remain_on_kst')}</option>
                                    <option value="booked_other_kst">{t('travel.status.booked_other_kst')}</option>
                                </select>
                                <span className="text-sm text-slate-500 ml-2">{t('expense.targetAccount')}:</span>
                                <input type="text" value={targetAccount}
                                    onChange={e => { setTargetAccountTouched(true); setTargetAccount(e.target.value); }}
                                    placeholder={t('expense.targetAccountPlaceholder')}
                                    title={t('expense.targetAccountHint')}
                                    className="w-32 p-1.5 border border-slate-300 rounded text-sm font-mono"/>
                                <span className="text-xs text-slate-400">{t('expense.targetAccountHint')}</span>
                            </div>
                            {targetProjectId && rows.some(r => r.included && r.toKst) && (
                                <p className="text-xs text-amber-700">
                                    {t('expense.kstSplitInfo').replace('{count}',
                                        String(rows.filter(r => r.included && r.toKst).length))}
                                </p>
                            )}
                        </div>

                        {/* Planungs-Check */}
                        {effectiveEmpId && missingWeeks.length > 0 && (
                            <div className="p-4 rounded-lg border bg-amber-50 border-amber-300 space-y-2">
                                <div className="text-sm text-amber-800 font-medium">
                                    {t('expense.notPlanned').replace('{weeks}', missingWeeks.map(w => formatKW(w)).join(', '))}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {missingWeeks.map(w => (
                                        <label key={w} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                            <input type="checkbox" checked={!!addWeeksSel[w]}
                                                onChange={e => setAddWeeksSel(prev => ({ ...prev, [w]: e.target.checked }))}
                                                className="w-4 h-4 text-gea-600 rounded"/>
                                            <span className="text-slate-700">{formatKW(w)} {t('expense.addToPlanning')}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-amber-700">{t('expense.zeroHoursHint')}</p>
                            </div>
                        )}

                        {/* Währungskurs */}
                        {isForeignCurrency && (
                            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-3 flex-wrap">
                                <span className="text-sm text-slate-700 font-medium">{t('expense.fxRate')}:</span>
                                <span className="text-sm text-slate-500">1 {currency} =</span>
                                <input type="text" inputMode="decimal" value={fxRate}
                                    onChange={e => setFxRate(e.target.value)}
                                    className="w-24 p-1.5 border border-slate-300 rounded text-sm text-center"/>
                                <span className="text-sm text-slate-500">EUR</span>
                                <button onClick={applyFxRate}
                                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md hover:bg-gea-50 hover:border-gea-400 text-slate-700">
                                    {t('expense.applyRate')}
                                </button>
                                <span className="text-xs text-slate-400">{t('expense.rateHint')}</span>
                            </div>
                        )}

                        {/* Ebene 1: Kategorie-Summen */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {cats.map(cat => (
                                <div key={cat.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${catChip(cat)}`}>{cat.label}</span>
                                    <p className="text-lg text-slate-900 font-semibold tabular-nums mt-2">{(sums[cat.id] || 0).toFixed(2)} €</p>
                                </div>
                            ))}
                        </div>

                        {/* Ebene 2: Einzelposten je Kategorie (Accordion) */}
                        <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden">
                            {cats.map(cat => {
                                const catRows = rows.filter(r => (catById.has(r.category) ? r.category : 'other') === cat.id);
                                if (catRows.length === 0) return null;
                                const open = openCats[cat.id] !== false; // default: offen
                                return (
                                    <div key={cat.id}>
                                        <button onClick={() => setOpenCats(prev => ({ ...prev, [cat.id]: !open }))}
                                            className="w-full px-4 py-2.5 bg-slate-50 flex items-center gap-2 text-left hover:bg-slate-100 transition-colors">
                                            <span className={`transition-transform text-slate-400 text-xs ${open ? 'rotate-90' : ''}`}>▶</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${catChip(cat)}`}>{cat.label}</span>
                                            <span className="text-xs text-slate-400">({catRows.length})</span>
                                            <span className="ml-auto text-sm text-slate-700 font-medium tabular-nums">{(sums[cat.id] || 0).toFixed(2)} €</span>
                                        </button>
                                        {open && catRows.map(r => (
                                            <div key={r.id} className={`px-4 py-2 flex items-center gap-3 text-sm ${r.included ? '' : 'opacity-40'}`}>
                                                <input type="checkbox" checked={r.included}
                                                    onChange={e => updateRow(r.id, { included: e.target.checked })}
                                                    title={t('expense.includeInTotal')}
                                                    className="w-4 h-4 text-gea-600 rounded shrink-0"/>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-slate-800 font-medium">{r.type}</span>
                                                    <span className="text-slate-400 text-xs ml-2">
                                                        {[fmtDate(r.date), r.vendor, r.location].filter(Boolean).join(' · ')}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-slate-400 tabular-nums shrink-0">{r.amount.toFixed(2)} {r.currency}</span>
                                                {targetProjectId && (
                                                    <label title={t('expense.rowToKstHint')}
                                                        className={`flex items-center gap-1 text-[10px] shrink-0 select-none ${r.included ? 'cursor-pointer text-slate-500' : 'text-slate-300'}`}>
                                                        <input type="checkbox" checked={!!r.toKst} disabled={!r.included}
                                                            onChange={e => updateRow(r.id, { toKst: e.target.checked })}
                                                            className="w-3.5 h-3.5 text-gea-600 rounded"/>
                                                        {t('expense.rowToKst')}
                                                    </label>
                                                )}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <input type="text" inputMode="decimal" value={r.eur}
                                                        onChange={e => updateRow(r.id, { eur: e.target.value })}
                                                        disabled={!r.included}
                                                        className="w-24 p-1.5 border border-slate-300 rounded text-sm text-right tabular-nums disabled:bg-slate-50"/>
                                                    <span className="text-xs text-slate-400">€</span>
                                                </div>
                                                <button onClick={() => deleteRow(r.id)}
                                                    title={t('btn.delete')}
                                                    className="text-rose-400 hover:text-rose-600 shrink-0 p-1">
                                                    <IconX size={15}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3">
                    {step === 'review' ? (
                        <div>
                            <p className="text-xs text-slate-500">{t('expense.total')}</p>
                            <p className="text-xl text-gea-600 font-semibold tabular-nums">{sums.total.toFixed(2)} €</p>
                        </div>
                    ) : <div/>}
                    <div className="flex gap-2">
                        {step === 'review' && (
                            <button onClick={() => { setStep('paste'); setParsed(null); }}
                                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium">
                                ← {t('expense.back')}
                            </button>
                        )}
                        <button onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium">
                            {t('btn.cancel')}
                        </button>
                        {step === 'paste' ? (
                            <button onClick={handleParse} disabled={!rawText.trim()}
                                className="px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                                {t('expense.analyze')}
                            </button>
                        ) : (
                            <button onClick={handleSave} disabled={!canSave}
                                className="px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                                {duplicate ? t('expense.saveReplace') : t('expense.save')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
