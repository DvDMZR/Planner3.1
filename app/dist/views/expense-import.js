// ─── SPESEN-IMPORT (Expense Tracking) ────────────────────────────────────────
// Modal-Workflow: ERP-Text einfügen → parsen → Mitarbeiter zuordnen (Alias-
// System) → Planungs-Check je Kalenderwoche → Beträge in EUR prüfen/editieren
// → als Kostenpunkt (lines) im Projekt speichern.
const ExpenseImportModal = ({
  proj,
  employees,
  assignments,
  costItems,
  setCostItems,
  handleSaveAssignment,
  empAliases,
  setEmpAliases,
  fxRates,
  setFxRates,
  showToast,
  onClose,
  t = k => k
}) => {
  const {
    useState,
    useMemo
  } = React;
  useEscapeToClose(onClose);
  const projectId = proj.id;
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

  const safeNum = v => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const activeEmployees = useMemo(() => (employees || []).filter(e => e.active !== false), [employees]);

  // ── Schritt 1 → 2: Parsen ────────────────────────────────────────────────
  const handleParse = () => {
    const result = parseExpenseReport(rawText);
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
      eur: Number.isFinite(convertToEur(it.amount, it.currency, fxRates)) ? String(convertToEur(it.amount, it.currency, fxRates)) : ''
    })));
    // Fehlende Planungswochen standardmäßig zum Hinzufügen vormerken
    const emp = findEmployeeForExpense(result.header.employeeName, employees, empAliases);
    setAssignedEmpId(emp ? emp.id : '');
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

  // Planungs-Check: In welchen KWs der Posten war der Mitarbeiter NICHT für
  // dieses Projekt verplant?
  const missingWeeks = useMemo(() => {
    if (!effectiveEmpId || rows.length === 0) return [];
    const itemWeeks = [...new Set(rows.map(r => r.week))].sort(compareWeekIds);
    const planned = new Set((assignments || []).filter(a => a.empId === effectiveEmpId && a.type === 'project' && a.reference === projectId).map(a => a.week));
    return itemWeeks.filter(w => !planned.has(w));
  }, [effectiveEmpId, rows, assignments, projectId]);

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

  // Duplikat-Erkennung über die Abrechnungs-ID
  const duplicate = useMemo(() => {
    if (!parsed?.header.reportId) return null;
    return (costItems || []).find(c => c.projectId === projectId && c.expenseReportId === parsed.header.reportId) || null;
  }, [parsed, costItems, projectId]);

  // Ebene 1: Summen je Hauptkategorie (nur eingeschlossene Posten, EUR)
  const CATEGORY_ORDER = ['travel', 'accommodation', 'meals', 'other'];
  const sums = useMemo(() => {
    const s = {
      travel: 0,
      accommodation: 0,
      meals: 0,
      other: 0,
      total: 0
    };
    rows.forEach(r => {
      if (!r.included) return;
      const v = safeNum(r.eur);
      s[r.category] += v;
      s.total += v;
    });
    return s;
  }, [rows]);
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
        reference: projectId,
        hours: 0
      });
    });
    const dates = included.map(r => r.date).sort();
    const lines = included.map(r => ({
      id: makeId('cl'),
      type: r.category,
      amount: safeNum(r.eur),
      comment: [r.type, r.vendor, r.location, fmtDate(r.date)].filter(Boolean).join(' · ')
    }));
    const item = {
      id: duplicate?.id || makeId('ci'),
      projectId,
      empId: effectiveEmpId,
      description: `${t('expense.descPrefix')} ${parsed.header.reportName || ''}`.trim(),
      dateFrom: dates[0] || null,
      dateTo: dates.length > 1 ? dates[dates.length - 1] : null,
      week: dates[0] ? getWeekString(new Date(dates[0])) : null,
      lines,
      amount: lines.reduce((s, l) => s + l.amount, 0),
      expenseReportId: parsed.header.reportId || null
    };
    if (duplicate) {
      setCostItems(costItems.map(c => c.id === duplicate.id ? item : c));
    } else {
      setCostItems([...costItems, item]);
    }
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
    subtitle: `${t('overview.colProject')}: ${proj.name}`,
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
  }, "\u26A0 ", t('expense.duplicateHint')), parsed.warnings.filter(w => w.type === 'unparsedRow').length > 0 && /*#__PURE__*/React.createElement("div", {
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
  }, "\u2713 ", t('expense.matched'), ": ", matchedEmp.name) : /*#__PURE__*/React.createElement("div", {
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
  }, t('expense.aliasHint'))))), effectiveEmpId && missingWeeks.length > 0 && /*#__PURE__*/React.createElement("div", {
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
  }, CATEGORY_ORDER.map(cat => {
    const cfg = COST_LINE_TYPES[cat];
    return /*#__PURE__*/React.createElement("div", {
      key: cat,
      className: "rounded-lg border border-slate-200 bg-slate-50/50 p-3"
    }, /*#__PURE__*/React.createElement("span", {
      className: `text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.chip}`
    }, cfg.invoiceLabel), /*#__PURE__*/React.createElement("p", {
      className: "text-lg text-slate-900 font-semibold tabular-nums mt-2"
    }, sums[cat].toFixed(2), " \u20AC"));
  })), /*#__PURE__*/React.createElement("div", {
    className: "border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden"
  }, CATEGORY_ORDER.map(cat => {
    const catRows = rows.filter(r => r.category === cat);
    if (catRows.length === 0) return null;
    const cfg = COST_LINE_TYPES[cat];
    const open = openCats[cat] !== false; // default: offen
    return /*#__PURE__*/React.createElement("div", {
      key: cat
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpenCats(prev => ({
        ...prev,
        [cat]: !open
      })),
      className: "w-full px-4 py-2.5 bg-slate-50 flex items-center gap-2 text-left hover:bg-slate-100 transition-colors"
    }, /*#__PURE__*/React.createElement("span", {
      className: `transition-transform text-slate-400 text-xs ${open ? 'rotate-90' : ''}`
    }, "\u25B6"), /*#__PURE__*/React.createElement("span", {
      className: `text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.chip}`
    }, cfg.invoiceLabel), /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-400"
    }, "(", catRows.length, ")"), /*#__PURE__*/React.createElement("span", {
      className: "ml-auto text-sm text-slate-700 font-medium tabular-nums"
    }, sums[cat].toFixed(2), " \u20AC")), open && catRows.map(r => /*#__PURE__*/React.createElement("div", {
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
    }, r.amount.toFixed(2), " ", r.currency), /*#__PURE__*/React.createElement("div", {
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