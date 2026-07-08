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
  t = k => k
}) => {
  const {
    useState,
    useMemo
  } = React;
  useEscapeToClose(onClose);
  const fixedProject = proj || null;
  const [step, setStep] = useState('paste'); // 'paste' | 'review'
  const [rawText, setRawText] = useState('');
  const [parseError, setParseError] = useState(null);
  const [parsed, setParsed] = useState(null); // { header, items, warnings }
  // Editierbare Posten: { ...item, included, eur (String für freie Eingabe) }
  const [rows, setRows] = useState([]);
  const [assignedEmpId, setAssignedEmpId] = useState('');
  const [fxRate, setFxRate] = useState('');
  const [addWeeksSel, setAddWeeksSel] = useState({}); // { weekId: bool }
  const [openCats, setOpenCats] = useState({}); // Accordion-Zustand
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
  const safeNum = v => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  // Projekt-Anzeige wie in den Planungsdialogen: Anlagentyp, Name, Größe.
  const projLabel = p => [p.projType, p.name, p.size].filter(v => v !== undefined && v !== null && String(v).trim() !== '').join(' ');
  const sortedProjects = useMemo(() => [...(projects || [])].sort((a, b) => projLabel(a).localeCompare(projLabel(b), 'de')), [projects]);
  const activeEmployees = useMemo(() => (employees || []).filter(e => e.active !== false), [employees]);
  // Konfigurierbare Kategorien (Verwaltung → Kategorien → Spesen-Kategorien)
  const cats = useMemo(() => normalizeExpenseCategories(expenseCategories), [expenseCategories]);
  const catById = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats]);
  const catChip = cat => (COST_LINE_TYPES[cat?.lineType] || COST_LINE_TYPES.other).chip;
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
    const rate = fxRates && Number.isFinite(fxRates[cur]) ? fxRates[cur] : DEFAULT_FX_RATES[cur] ?? '';
    setFxRate(String(rate));
    setRows(result.items.map(it => ({
      ...it,
      included: true,
      // Bei Projekt-Zuordnung abwählbar: Posten mit toKst landen nicht
      // auf dem Projekt, sondern verbleiben auf der Team-KST.
      toKst: false,
      eur: Number.isFinite(convertToEur(it.amount, it.currency, fxRates)) ? String(convertToEur(it.amount, it.currency, fxRates)) : ''
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
    return [...byProject.entries()].map(([pid, weeks]) => ({
      project: (projects || []).find(p => p.id === pid),
      weeks: [...weeks].sort(compareWeekIds)
    })).filter(e => e.project).sort((a, b) => projLabel(a.project).localeCompare(projLabel(b.project), 'de'));
  }, [fixedProject, effectiveEmpId, rows, assignments, projects]);

  // Effektives Buchungsziel aus der Wahl ableiten. 'auto' folgt der
  // Einsatzplanung (Projekt mit den meisten überlappenden Wochen), sonst
  // gilt die explizite Wahl.
  const autoTargetId = plannedProjects.reduce((best, e) => !best || e.weeks.length > best.weeks.length ? e : best, null)?.project.id || null;
  const targetProjectId = fixedProject ? fixedProject.id : targetChoice === 'auto' ? autoTargetId : targetChoice === 'internal' ? null : targetChoice === 'other' ? otherProjectId || null : targetChoice;
  const targetProject = fixedProject || (targetProjectId ? (projects || []).find(p => p.id === targetProjectId) || null : null);

  // Gegenkonto mit der KST des Ziel-Projekts vorbelegen (Nutzer-Eingabe gewinnt).
  React.useEffect(() => {
    if (targetAccountTouched) return;
    setTargetAccount(targetProject?.kst || '');
  }, [targetProject, targetAccountTouched]);

  // Gutschrift-Status: expliziter Nutzer-Wunsch oder Default nach Kostenart.
  const effectiveSettleStatus = settleStatusSel || (targetProjectId ? 'to_submit' : 'remain_on_kst');

  // Planungs-Check: In welchen KWs der Posten war der Mitarbeiter NICHT für
  // das Ziel-Projekt verplant? (entfällt bei interner Buchung)
  const missingWeeks = useMemo(() => {
    if (!effectiveEmpId || rows.length === 0 || !targetProjectId) return [];
    const itemWeeks = [...new Set(rows.map(r => r.week))].sort(compareWeekIds);
    const planned = new Set((assignments || []).filter(a => a.empId === effectiveEmpId && a.type === 'project' && a.reference === targetProjectId).map(a => a.week));
    return itemWeeks.filter(w => !planned.has(w));
  }, [effectiveEmpId, rows, assignments, targetProjectId]);

  // Neu erkannte fehlende Wochen standardmäßig zum Hinzufügen vormerken
  // (der Nutzer kann sie einzeln abwählen).
  React.useEffect(() => {
    setAddWeeksSel(prev => {
      const next = {
        ...prev
      };
      missingWeeks.forEach(w => {
        if (!(w in next)) next[w] = true;
      });
      return next;
    });
  }, [missingWeeks]);

  // Duplikat-Erkennung über die Abrechnungs-ID: beim Projekt-Import
  // projektbezogen (Ersetzen), beim Mitarbeiter-Import global – die ERP-ID
  // ist firmenweit eindeutig. Treffer auf anderen Projekten lösen nur eine
  // Warnung aus (`elsewhere`).
  const dupInfo = useMemo(() => {
    if (!parsed?.header.reportId) return {
      duplicate: null,
      elsewhere: null
    };
    return findDuplicateExpenseReport(costItems, parsed.header.reportId, targetProjectId);
  }, [parsed, costItems, targetProjectId]);
  const duplicate = dupInfo.duplicate;

  // Ebene 1: Summen je Kategorie (nur eingeschlossene Posten, EUR)
  const sums = useMemo(() => {
    const s = {
      total: 0
    };
    cats.forEach(c => {
      s[c.id] = 0;
    });
    rows.forEach(r => {
      if (!r.included) return;
      const v = safeNum(r.eur);
      s[catById.has(r.category) ? r.category : 'other'] += v;
      s.total += v;
    });
    return s;
  }, [rows, cats, catById]);
  const updateRow = (id, patch) => setRows(prev => prev.map(r => r.id === id ? {
    ...r,
    ...patch
  } : r));
  const deleteRow = id => setRows(prev => prev.filter(r => r.id !== id));

  // Kurs auf alle Zeilen anwenden (überschreibt manuelle EUR-Korrekturen –
  // deshalb expliziter Button statt Live-Neuberechnung).
  const applyFxRate = () => {
    const rate = safeNum(fxRate);
    if (rate <= 0) return;
    setRows(prev => prev.map(r => ({
      ...r,
      eur: String(Math.round(r.amount * (r.currency === 'EUR' ? 1 : rate) * 100) / 100)
    })));
  };
  const fmtDate = iso => {
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
      if (norm) setEmpAliases(prev => ({
        ...prev,
        [norm]: effectiveEmpId
      }));
    }
    // Verwendeten Kurs für die Währung persistieren
    if (isForeignCurrency && safeNum(fxRate) > 0) {
      setFxRates(prev => ({
        ...(prev || {}),
        [currency]: safeNum(fxRate)
      }));
    }
    // Fehlende Wochen zur Planung hinzufügen (0 h = "Unter Vorbehalt")
    missingWeeks.filter(w => addWeeksSel[w]).forEach(week => {
      handleSaveAssignment({
        empId: effectiveEmpId,
        week,
        type: 'project',
        reference: targetProjectId,
        hours: 0
      });
    });
    const makeLines = rs => rs.map(r => {
      const cat = catById.get(r.category) || catById.get('other');
      // Custom-Kategorien landen in ihrer Export-Kostenart (lineType);
      // ihr Label wandert in den Kommentar, damit die Info erhalten bleibt.
      const labelPrefix = cat.builtin ? null : cat.label;
      return {
        id: makeId('cl'),
        type: cat.lineType,
        amount: safeNum(r.eur),
        comment: [labelPrefix, r.type, r.vendor, r.location, fmtDate(r.date)].filter(Boolean).join(' · ')
      };
    });
    const makeItem = (rs, {
      base,
      projId,
      status,
      tgtAccount,
      descSuffix
    }) => {
      const dates = rs.map(r => r.date).sort();
      const lines = makeLines(rs);
      return {
        // Beim Ersetzen eines Duplikats bleiben dessen übrige Felder
        // erhalten; alles Import-Relevante wird explizit neu gesetzt.
        ...(base || {}),
        id: base?.id || makeId('ci'),
        projectId: projId,
        empId: effectiveEmpId,
        description: [`${t('expense.descPrefix')} ${parsed.header.reportName || ''}`.trim(), descSuffix].filter(Boolean).join(' · '),
        dateFrom: dates[0] || null,
        dateTo: dates.length > 1 ? dates[dates.length - 1] : null,
        week: dates[0] ? getWeekString(new Date(dates[0])) : null,
        lines,
        amount: lines.reduce((s, l) => s + l.amount, 0),
        expenseReportId: parsed.header.reportId || null,
        // Gutschrift-Tracking (Prozess 2)
        reportKey: parsed.header.reportKey || null,
        targetAccount: tgtAccount,
        settlementStatus: status
      };
    };

    // Split: Bei Projekt-Zuordnung können einzelne Posten "abgehakt"
    // werden (toKst) – sie landen dann in einem zweiten, internen
    // Kostenpunkt und verbleiben auf der Team-KST.
    const projectRows = targetProjectId ? included.filter(r => !r.toKst) : [];
    const kstRows = targetProjectId ? included.filter(r => r.toKst) : included;
    const reportId = parsed.header.reportId || null;
    // Früheren internen Anteil desselben Reports wiederverwenden (Re-Import)
    const prevInternal = reportId ? (costItems || []).find(c => c.expenseReportId === reportId && c.projectId == null) || null : null;
    const newItems = [];
    if (projectRows.length > 0) {
      newItems.push(makeItem(projectRows, {
        base: duplicate && duplicate.projectId === targetProjectId ? duplicate : null,
        projId: targetProjectId,
        status: effectiveSettleStatus,
        tgtAccount: targetAccount.trim() || null
      }));
    }
    if (kstRows.length > 0) {
      const isSplit = !!targetProjectId;
      newItems.push(makeItem(kstRows, {
        base: prevInternal,
        projId: null,
        status: isSplit ? 'remain_on_kst' : effectiveSettleStatus,
        tgtAccount: isSplit ? null : targetAccount.trim() || null,
        descSuffix: isSplit ? t('expense.kstSplitSuffix') : null
      }));
    }

    // Frühere Kostenpunkte desselben Reports im verwalteten Scope
    // (Ziel-Projekt + interner Anteil) ersetzen, dann neu anfügen.
    setCostItems(prev => {
      const keep = reportId ? prev.filter(c => !(c.expenseReportId === reportId && (c.projectId === targetProjectId || c.projectId == null))) : prev;
      return [...keep, ...newItems];
    });
    showToast?.(t('expense.saved'), {
      type: 'success',
      duration: 4000
    });
    onClose();
  };
  const canSave = step === 'review' && effectiveEmpId && rows.some(r => r.included && safeNum(r.eur) > 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
  }, /*#__PURE__*/React.createElement(ModalHeader, {
    title: t('expense.title'),
    subtitle: fixedProject ? `${t('overview.colProject')}: ${fixedProject.name}` : t('expense.employeeBased'),
    onClose: onClose
  }), step === 'paste' && /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto p-6 space-y-4"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-600"
  }, t('expense.pasteHint')), /*#__PURE__*/React.createElement("textarea", {
    value: rawText,
    onChange: e => setRawText(e.target.value),
    autoFocus: true,
    placeholder: t('expense.pastePlaceholder'),
    className: "w-full h-72 p-3 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gea-400 focus:border-gea-500 resize-y"
  }), parseError && /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700"
  }, parseError)), step === 'review' && parsed && /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto p-6 space-y-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 text-xs"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 block"
  }, t('expense.reportName')), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800 font-medium"
  }, parsed.header.reportName || '–')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 block"
  }, t('expense.reportId')), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800 font-mono"
  }, parsed.header.reportId || '–')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 block"
  }, t('expense.status')), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800"
  }, [parsed.header.approvalStatus, parsed.header.paymentStatus].filter(Boolean).join(' · ') || '–')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 block"
  }, t('expense.currency')), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800 font-medium"
  }, currency))), duplicate && /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800"
  }, "\u26A0 ", t('expense.duplicateHint')), !duplicate && dupInfo.elsewhere && /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800"
  }, "\u26A0 ", t('expense.duplicateElsewhere')), parsed.warnings.filter(w => w.type === 'unparsedRow').length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700"
  }, t('expense.unparsedRows'), ": ", parsed.warnings.filter(w => w.type === 'unparsedRow').length), /*#__PURE__*/React.createElement("div", {
    className: `p-4 rounded-lg border ${needsManualAssign ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-200'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium mb-1 text-slate-800"
  }, t('expense.employee'), ": ", /*#__PURE__*/React.createElement("span", {
    className: "font-semibold"
  }, parsed.header.employeeName), parsed.header.employeeId && /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-normal ml-2"
  }, "(ID ", parsed.header.employeeId, ")")), !needsManualAssign ? /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-emerald-700"
  }, "\u2713 ", t('expense.matched'), ": ", matchedEmp.name) : suggestedEmpId && assignedEmpId === suggestedEmpId ? /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-rose-700"
  }, t('expense.notFound')), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement("select", {
    value: assignedEmpId,
    onChange: e => setAssignedEmpId(e.target.value),
    className: "p-2 border border-amber-400 rounded-md text-sm bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t('expense.selectProfile')), activeEmployees.map(e => /*#__PURE__*/React.createElement("option", {
    key: e.id,
    value: e.id
  }, e.name))), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-amber-700 font-medium"
  }, t('expense.suggestion')), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-500"
  }, t('expense.aliasHint')))) : /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-rose-700"
  }, t('expense.notFound')), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("select", {
    value: assignedEmpId,
    onChange: e => setAssignedEmpId(e.target.value),
    className: "p-2 border border-slate-300 rounded-md text-sm bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t('expense.selectProfile')), activeEmployees.map(e => /*#__PURE__*/React.createElement("option", {
    key: e.id,
    value: e.id
  }, e.name))), assignedEmpId && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-500"
  }, t('expense.aliasHint'))))), !fixedProject && effectiveEmpId && /*#__PURE__*/React.createElement("div", {
    className: "p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium text-slate-800"
  }, t('expense.targetTitle')), plannedProjects.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800"
  }, "\u26A0 ", t('expense.noPlanningFound')), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1.5"
  }, plannedProjects.map(({
    project,
    weeks
  }) => /*#__PURE__*/React.createElement("label", {
    key: project.id,
    className: "flex items-center gap-2 text-sm cursor-pointer select-none"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "expTarget",
    checked: targetChoice === project.id || targetChoice === 'auto' && autoTargetId === project.id,
    onChange: () => setTargetChoice(project.id),
    className: "w-4 h-4 text-gea-600"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800 font-medium"
  }, projLabel(project)), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-500"
  }, t('expense.plannedInWeeks').replace('{weeks}', weeks.map(w => formatKW(w)).join(', '))))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-sm cursor-pointer select-none"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "expTarget",
    checked: targetChoice === 'other',
    onChange: () => setTargetChoice('other'),
    className: "w-4 h-4 text-gea-600"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-700"
  }, t('expense.otherProject')), /*#__PURE__*/React.createElement("select", {
    value: otherProjectId,
    onChange: e => {
      setTargetChoice('other');
      setOtherProjectId(e.target.value);
    },
    className: "p-1.5 border border-slate-300 rounded-md text-sm bg-white flex-1 min-w-0"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t('expense.selectProject')), sortedProjects.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, projLabel(p))))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-sm cursor-pointer select-none"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "expTarget",
    checked: targetChoice === 'internal' || targetChoice === 'auto' && !autoTargetId,
    onChange: () => setTargetChoice('internal'),
    className: "w-4 h-4 text-gea-600"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-700"
  }, t('expense.bookInternal')), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400"
  }, t('expense.bookInternalHint'))))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-slate-700 font-medium"
  }, t('expense.settlement'), ":"), /*#__PURE__*/React.createElement("select", {
    value: effectiveSettleStatus,
    onChange: e => setSettleStatusSel(e.target.value),
    className: "p-1.5 border border-slate-300 rounded-md text-sm bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: "to_submit"
  }, t('travel.status.to_submit')), /*#__PURE__*/React.createElement("option", {
    value: "remain_on_kst"
  }, t('travel.status.remain_on_kst'))), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-slate-500 ml-2"
  }, t('expense.targetAccount'), ":"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: targetAccount,
    onChange: e => {
      setTargetAccountTouched(true);
      setTargetAccount(e.target.value);
    },
    placeholder: t('expense.targetAccountPlaceholder'),
    title: t('expense.targetAccountHint'),
    className: "w-32 p-1.5 border border-slate-300 rounded text-sm font-mono"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400"
  }, t('expense.targetAccountHint'))), targetProjectId && rows.some(r => r.included && r.toKst) && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-amber-700"
  }, t('expense.kstSplitInfo').replace('{count}', String(rows.filter(r => r.included && r.toKst).length)))), effectiveEmpId && missingWeeks.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "p-4 rounded-lg border bg-amber-50 border-amber-300 space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-amber-800 font-medium"
  }, t('expense.notPlanned').replace('{weeks}', missingWeeks.map(w => formatKW(w)).join(', '))), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-3"
  }, missingWeeks.map(w => /*#__PURE__*/React.createElement("label", {
    key: w,
    className: "flex items-center gap-2 text-sm cursor-pointer select-none"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!addWeeksSel[w],
    onChange: e => setAddWeeksSel(prev => ({
      ...prev,
      [w]: e.target.checked
    })),
    className: "w-4 h-4 text-gea-600 rounded"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-700"
  }, formatKW(w), " ", t('expense.addToPlanning'))))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-amber-700"
  }, t('expense.zeroHoursHint'))), isForeignCurrency && /*#__PURE__*/React.createElement("div", {
    className: "p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-slate-700 font-medium"
  }, t('expense.fxRate'), ":"), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-slate-500"
  }, "1 ", currency, " ="), /*#__PURE__*/React.createElement("input", {
    type: "text",
    inputMode: "decimal",
    value: fxRate,
    onChange: e => setFxRate(e.target.value),
    className: "w-24 p-1.5 border border-slate-300 rounded text-sm text-center"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-slate-500"
  }, "EUR"), /*#__PURE__*/React.createElement("button", {
    onClick: applyFxRate,
    className: "px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md hover:bg-gea-50 hover:border-gea-400 text-slate-700"
  }, t('expense.applyRate')), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400"
  }, t('expense.rateHint'))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3"
  }, cats.map(cat => /*#__PURE__*/React.createElement("div", {
    key: cat.id,
    className: "rounded-lg border border-slate-200 bg-slate-50/50 p-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: `text-[10px] px-2 py-0.5 rounded-full border font-medium ${catChip(cat)}`
  }, cat.label), /*#__PURE__*/React.createElement("p", {
    className: "text-lg text-slate-900 font-semibold tabular-nums mt-2"
  }, (sums[cat.id] || 0).toFixed(2), " \u20AC")))), /*#__PURE__*/React.createElement("div", {
    className: "border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden"
  }, cats.map(cat => {
    const catRows = rows.filter(r => (catById.has(r.category) ? r.category : 'other') === cat.id);
    if (catRows.length === 0) return null;
    const open = openCats[cat.id] !== false; // default: offen
    return /*#__PURE__*/React.createElement("div", {
      key: cat.id
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpenCats(prev => ({
        ...prev,
        [cat.id]: !open
      })),
      className: "w-full px-4 py-2.5 bg-slate-50 flex items-center gap-2 text-left hover:bg-slate-100 transition-colors"
    }, /*#__PURE__*/React.createElement("span", {
      className: `transition-transform text-slate-400 text-xs ${open ? 'rotate-90' : ''}`
    }, "\u25B6"), /*#__PURE__*/React.createElement("span", {
      className: `text-xs px-2 py-0.5 rounded-full border font-medium ${catChip(cat)}`
    }, cat.label), /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-400"
    }, "(", catRows.length, ")"), /*#__PURE__*/React.createElement("span", {
      className: "ml-auto text-sm text-slate-700 font-medium tabular-nums"
    }, (sums[cat.id] || 0).toFixed(2), " \u20AC")), open && catRows.map(r => /*#__PURE__*/React.createElement("div", {
      key: r.id,
      className: `px-4 py-2 flex items-center gap-3 text-sm ${r.included ? '' : 'opacity-40'}`
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: r.included,
      onChange: e => updateRow(r.id, {
        included: e.target.checked
      }),
      title: t('expense.includeInTotal'),
      className: "w-4 h-4 text-gea-600 rounded shrink-0"
    }), /*#__PURE__*/React.createElement("div", {
      className: "flex-1 min-w-0"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-800 font-medium"
    }, r.type), /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400 text-xs ml-2"
    }, [fmtDate(r.date), r.vendor, r.location].filter(Boolean).join(' · '))), /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-400 tabular-nums shrink-0"
    }, r.amount.toFixed(2), " ", r.currency), targetProjectId && /*#__PURE__*/React.createElement("label", {
      title: t('expense.rowToKstHint'),
      className: `flex items-center gap-1 text-[10px] shrink-0 select-none ${r.included ? 'cursor-pointer text-slate-500' : 'text-slate-300'}`
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: !!r.toKst,
      disabled: !r.included,
      onChange: e => updateRow(r.id, {
        toKst: e.target.checked
      }),
      className: "w-3.5 h-3.5 text-gea-600 rounded"
    }), t('expense.rowToKst')), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-1 shrink-0"
    }, /*#__PURE__*/React.createElement("input", {
      type: "text",
      inputMode: "decimal",
      value: r.eur,
      onChange: e => updateRow(r.id, {
        eur: e.target.value
      }),
      disabled: !r.included,
      className: "w-24 p-1.5 border border-slate-300 rounded text-sm text-right tabular-nums disabled:bg-slate-50"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-400"
    }, "\u20AC")), /*#__PURE__*/React.createElement("button", {
      onClick: () => deleteRow(r.id),
      title: t('btn.delete'),
      className: "text-rose-400 hover:text-rose-600 shrink-0 p-1"
    }, /*#__PURE__*/React.createElement(IconX, {
      size: 15
    })))));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "p-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3"
  }, step === 'review' ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500"
  }, t('expense.total')), /*#__PURE__*/React.createElement("p", {
    className: "text-xl text-gea-600 font-semibold tabular-nums"
  }, sums.total.toFixed(2), " \u20AC")) : /*#__PURE__*/React.createElement("div", null), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, step === 'review' && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setStep('paste');
      setParsed(null);
    },
    className: "px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium"
  }, "\u2190 ", t('expense.back')), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium"
  }, t('btn.cancel')), step === 'paste' ? /*#__PURE__*/React.createElement("button", {
    onClick: handleParse,
    disabled: !rawText.trim(),
    className: "px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
  }, t('expense.analyze')) : /*#__PURE__*/React.createElement("button", {
    onClick: handleSave,
    disabled: !canSave,
    className: "px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
  }, duplicate ? t('expense.saveReplace') : t('expense.save'))))));
};