// ─── VERLAUF / AUDIT-LOG ─────────────────────────────────────────────────────
const AuditView = ({
  s,
  h
}) => {
  const {
    useState
  } = React;
  const {
    currentUser,
    auditLog,
    employees,
    projects,
    t
  } = s;
  const {
    setAssignments,
    setEmployees,
    setProjects,
    setCostItems,
    setAuditLog,
    downloadCsv
  } = h;
  const [filter, setFilter] = useState('all'); // 'all' | '7d' | '24h'
  const [undoConfirm, setUndoConfirm] = useState(null); // id of entry being confirmed

  if (!currentUser) {
    return /*#__PURE__*/React.createElement("main", {
      className: "flex-1 flex items-center justify-center text-slate-400 text-sm"
    }, t('audit.loginRequired'));
  }
  const now = Date.now();
  const filtered = auditLog.filter(entry => {
    if (filter === '24h') return now - new Date(entry.timestamp).getTime() < 86400000;
    if (filter === '7d') return now - new Date(entry.timestamp).getTime() < 604800000;
    return true;
  });
  const applyUndo = entry => {
    const {
      undoData
    } = entry;
    if (!undoData) return;
    const {
      type
    } = undoData;
    if (type === 'del_assignment') {
      setAssignments(prev => prev.filter(a => !undoData.ids.includes(a.id)));
    } else if (type === 'restore_assignment') {
      if (!undoData.prev) return;
      setAssignments(prev => {
        const exists = prev.some(a => a.id === undoData.prev.id);
        if (exists) return prev.map(a => a.id === undoData.prev.id ? undoData.prev : a);
        return [...prev, undoData.prev];
      });
    } else if (type === 'del_assignments') {
      setAssignments(prev => prev.filter(a => !undoData.ids.includes(a.id)));
    } else if (type === 'restore_assignments') {
      setAssignments(prev => {
        const restoreIds = new Set(undoData.prevItems.map(a => a.id));
        const kept = prev.filter(a => !restoreIds.has(a.id));
        return [...kept, ...undoData.prevItems];
      });
    } else if (type === 'del_employee') {
      setEmployees(prev => prev.filter(e => e.id !== undoData.id));
    } else if (type === 'restore_employee') {
      if (!undoData.prev) return;
      setEmployees(prev => {
        const exists = prev.some(e => e.id === undoData.prev.id);
        if (exists) return prev.map(e => e.id === undoData.prev.id ? undoData.prev : e);
        return [...prev, undoData.prev];
      });
    } else if (type === 'del_project') {
      setProjects(prev => prev.filter(p => p.id !== undoData.id));
    } else if (type === 'restore_project') {
      if (!undoData.prev) return;
      setProjects(prev => {
        const exists = prev.some(p => p.id === undoData.prev.id);
        if (exists) return prev.map(p => p.id === undoData.prev.id ? undoData.prev : p);
        return [...prev, undoData.prev];
      });
    } else if (type === 'restore_project_cascade') {
      if (!undoData.prev) return;
      setProjects(prev => prev.some(p => p.id === undoData.prev.id) ? prev : [...prev, undoData.prev]);
      if (Array.isArray(undoData.assignments) && undoData.assignments.length > 0) {
        setAssignments(prev => {
          const ids = new Set(prev.map(a => a.id));
          return [...prev, ...undoData.assignments.filter(a => !ids.has(a.id))];
        });
      }
      if (Array.isArray(undoData.costItems) && undoData.costItems.length > 0 && setCostItems) {
        setCostItems(prev => {
          const ids = new Set(prev.map(c => c.id));
          return [...prev, ...undoData.costItems.filter(c => !ids.has(c.id))];
        });
      }
    } else if (type === 'restore_employee_cascade') {
      if (!undoData.prev) return;
      setEmployees(prev => prev.some(e => e.id === undoData.prev.id) ? prev : [...prev, undoData.prev]);
      if (Array.isArray(undoData.assignments) && undoData.assignments.length > 0) {
        setAssignments(prev => {
          const ids = new Set(prev.map(a => a.id));
          return [...prev, ...undoData.assignments.filter(a => !ids.has(a.id))];
        });
      }
      if (Array.isArray(undoData.costItems) && undoData.costItems.length > 0 && setCostItems) {
        setCostItems(prev => {
          const ids = new Set(prev.map(c => c.id));
          return [...prev, ...undoData.costItems.filter(c => !ids.has(c.id))];
        });
      }
    }

    // Remove this entry from the log after undo
    setAuditLog(prev => prev.filter(e => e.id !== entry.id));
    setUndoConfirm(null);
  };
  const actionLabels = {
    assignment_create: t('audit.action.assignCreate'),
    assignment_copy: t('audit.action.assignCopy'),
    assignment_update: t('audit.action.assignUpdate'),
    assignment_delete: t('audit.action.assignDelete'),
    assignment_delete_series: t('audit.action.assignDeleteSeries'),
    assignment_drop: t('audit.action.assignDrop'),
    employee_create: t('audit.action.empCreate'),
    employee_update: t('audit.action.empUpdate'),
    employee_delete: t('audit.action.empDelete'),
    project_create: t('audit.action.projCreate'),
    project_update: t('audit.action.projUpdate'),
    project_delete: t('audit.action.projDelete')
  };
  const actionColors = {
    assignment_create: 'bg-emerald-100 text-emerald-800',
    assignment_copy: 'bg-blue-100 text-blue-800',
    assignment_update: 'bg-amber-100 text-amber-800',
    assignment_delete: 'bg-rose-100 text-rose-800',
    assignment_delete_series: 'bg-rose-100 text-rose-800',
    assignment_drop: 'bg-amber-100 text-amber-800',
    employee_create: 'bg-emerald-100 text-emerald-800',
    employee_update: 'bg-amber-100 text-amber-800',
    employee_delete: 'bg-rose-100 text-rose-800',
    project_create: 'bg-emerald-100 text-emerald-800',
    project_update: 'bg-amber-100 text-amber-800',
    project_delete: 'bg-rose-100 text-rose-800'
  };
  return /*#__PURE__*/React.createElement("main", {
    className: "flex-1 overflow-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-6xl mx-auto p-6 space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "text-xl font-semibold text-slate-900 mb-1"
  }, t('audit.title')), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-500"
  }, t('audit.subtitle'))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1 shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const rowsCsv = [[t('audit.colTime'), t('audit.colUser'), t('audit.colAction'), t('audit.colDesc')]];
      filtered.forEach(e => rowsCsv.push([new Date(e.timestamp).toLocaleString('de-DE'), e.userName || '', e.action || '', e.description || '']));
      downloadCsv(`Verlauf_${new Date().toISOString().slice(0, 10)}.csv`, rowsCsv);
    },
    className: "px-3 py-1.5 text-xs rounded-lg font-medium bg-white border border-slate-300 text-slate-600 hover:border-gea-400 hover:text-gea-600 transition-colors mr-2"
  }, t('btn.exportCsv')), [['all', t('audit.filterAll')], ['7d', t('audit.filter7d')], ['24h', t('audit.filter24h')]].map(([val, label]) => /*#__PURE__*/React.createElement("button", {
    key: val,
    onClick: () => setFilter(val),
    className: `px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${filter === val ? 'bg-gea-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`
  }, label)))), filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "bg-white border border-slate-200 rounded-xl"
  }, /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement(IconHistory, {
      size: 32
    }),
    title: t('audit.noEntries'),
    description: t('audit.noEntriesEmptyDesc')
  })) : /*#__PURE__*/React.createElement("div", {
    className: "bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "bg-slate-50 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-44"
  }, t('audit.colTime')), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28"
  }, t('audit.colUser')), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-40"
  }, t('audit.colAction')), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
  }, t('audit.colDesc')), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-32"
  }))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-slate-100"
  }, filtered.map(entry => /*#__PURE__*/React.createElement("tr", {
    key: entry.id,
    className: "hover:bg-slate-50 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-xs text-slate-500 whitespace-nowrap"
  }, new Date(entry.timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-medium text-slate-700 truncate block max-w-[6rem]",
    title: entry.userName
  }, entry.userName)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: `text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[entry.action] || 'bg-slate-100 text-slate-600'}`
  }, actionLabels[entry.action] || entry.action)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-xs text-slate-700",
    title: entry.description
  }, entry.description), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, entry.undoData && (undoConfirm === entry.id ? /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1 justify-end"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-500"
  }, t('audit.sure')), /*#__PURE__*/React.createElement("button", {
    onClick: () => applyUndo(entry),
    className: "px-2 py-1 text-xs rounded bg-rose-600 text-white hover:bg-rose-700 transition-colors font-medium"
  }, t('audit.yes')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setUndoConfirm(null),
    className: "px-2 py-1 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
  }, t('audit.no'))) : /*#__PURE__*/React.createElement(Tooltip, {
    text: t('audit.undoTip'),
    side: "left"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setUndoConfirm(entry.id),
    className: "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors ml-auto"
  }, /*#__PURE__*/React.createElement(IconUndo, {
    size: 13
  }), " ", t('audit.undo')))))))))), auditLog.length > 0 && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 text-right"
  }, auditLog.length !== 1 ? t('audit.entriesPlural', {
    n: auditLog.length
  }) : t('audit.entries', {
    n: auditLog.length
  }))));
};