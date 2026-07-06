// STATUS_ORDER lives in config.js
const OverviewView = ({
  s,
  h
}) => {
  const {
    activeTab,
    employees,
    projects,
    assignments,
    expenses,
    costItems,
    empCategories,
    projCategories,
    basicTasks,
    basicTasksMeta,
    inactiveBasicTasks,
    basicTasksSubTab,
    offtimeTasks,
    inactiveOfftimeTasks,
    inactiveSupportTasks,
    inactiveTrainingTasks,
    isChangelogOpen,
    weeks,
    selectedProject,
    collapsedCategories,
    collapsedProjCategories,
    collapsedEmpSetup,
    selectedProjectDetails,
    weeksAhead,
    isAssignModalOpen,
    assignContext,
    isCostItemModalOpen,
    editingCostItem,
    isCopyModalOpen,
    copyContext,
    isDeleteMode,
    pastProjectsExpanded,
    isInvoiceModalOpen,
    invoiceSelection,
    invoiceRecipient,
    isProjFormOpen,
    isHelpModalOpen,
    timelineYear,
    empForm,
    editingEmpId,
    projForm,
    editingProjectId,
    newEmpCat,
    newProjCat,
    newBasicTask,
    newOfftimeTask,
    expandedSetupCats,
    syncStatus,
    fsStatus,
    employeeById,
    projectById,
    assignmentsByEmpWeek,
    assignmentsByProject,
    assignmentsByProjectWeek,
    costItemsByProject,
    projectStatusById,
    activeEmployees,
    activeEmpsByCategory,
    activeEmpCategories,
    projectsByCategory,
    projCategoriesFromProjects,
    timelineWeeks,
    currentWeekColRef,
    resourceScrollRef,
    timelineScrollRef,
    t
  } = s;
  const {
    setActiveTab,
    setEmployees,
    setProjects,
    setAssignments,
    setCostItems,
    setEmpCategories,
    setProjCategories,
    setBasicTasks,
    setBasicTasksMeta,
    setInactiveBasicTasks,
    setBasicTasksSubTab,
    setOfftimeTasks,
    setInactiveOfftimeTasks,
    setInactiveSupportTasks,
    setInactiveTrainingTasks,
    setIsChangelogOpen,
    setSelectedProject,
    setCollapsedCategories,
    setCollapsedProjCategories,
    setCollapsedEmpSetup,
    setSelectedProjectDetails,
    setWeeksAhead,
    setIsAssignModalOpen,
    setAssignContext,
    setIsCostItemModalOpen,
    setEditingCostItem,
    setIsCopyModalOpen,
    setCopyContext,
    setIsDeleteMode,
    setPastProjectsExpanded,
    setIsInvoiceModalOpen,
    setInvoiceSelection,
    setInvoiceRecipient,
    setIsProjFormOpen,
    setIsHelpModalOpen,
    setTimelineYear,
    setEmpForm,
    setEditingEmpId,
    setProjForm,
    setEditingProjectId,
    setNewEmpCat,
    setNewProjCat,
    setNewBasicTask,
    setNewOfftimeTask,
    setExpandedSetupCats,
    setSyncStatus,
    setFsStatus,
    getEmpWeeklyHours,
    computeAutoStatus,
    getWeeksForYear,
    getUtilization,
    toggleCategory,
    toggleProjCategory,
    toggleEmpSetup,
    handleSaveAssignment,
    handleDeleteAssignment,
    handleDeleteAssignmentSeries,
    handleDrop,
    exportData,
    importData,
    buildInvoiceData,
    openInvoiceModal,
    scrollToCurrentWeek,
    scrollToWeekById,
    openNewProjectForm
  } = h;
  const fmt = n => n.toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  const currentWeekStr = getWeekString(new Date());
  const activeEmps = activeEmployees;
  const activeProjects = React.useMemo(() => projects.filter(p => computeAutoStatus(p) === 'active').length, [projects, computeAutoStatus]);
  const {
    avgUtil,
    overbookedCount
  } = React.useMemo(() => {
    const utils = activeEmps.map(e => getUtilization(e.id, currentWeekStr).total);
    const avg = activeEmps.length > 0 ? Math.round(utils.reduce((a, b) => a + b, 0) / activeEmps.length) : 0;
    return {
      avgUtil: avg,
      overbookedCount: utils.filter(u => u > 100).length
    };
  }, [activeEmps, getUtilization, currentWeekStr]);

  // Auslastungsverlauf der letzten 8 Wochen (Ø über alle aktiven MA je
  // Woche) – dieselbe Formel wie avgUtil oben, nur pro Woche wiederholt.
  const utilTrend = React.useMemo(() => {
    const out = [];
    for (let i = 7; i >= 0; i--) {
      const week = addWeeks(currentWeekStr, -i);
      const utils = activeEmps.map(e => getUtilization(e.id, week).total);
      const avg = activeEmps.length > 0 ? Math.round(utils.reduce((a, b) => a + b, 0) / activeEmps.length) : 0;
      out.push({
        week,
        avg
      });
    }
    return out;
  }, [activeEmps, getUtilization, currentWeekStr]);
  const jumpToWeek = week => {
    setActiveTab('resource');
    setTimeout(() => scrollToWeekById(resourceScrollRef, timelineWeeks, week, 140), 120);
  };
  const rows = React.useMemo(() => projects.filter(p => ['active', 'planned'].includes(computeAutoStatus(p))).map(p => {
    const projAss = assignmentsByProject.get(p.id) || [];
    let totalHours = 0,
      totalLaborCost = 0;
    for (let i = 0; i < projAss.length; i++) {
      const a = projAss[i];
      if (a.type !== 'project') continue;
      const h = a.hours ?? (a.percent ?? 100) / 100 * HOURS_PER_WEEK;
      totalHours += h;
      if (p.billable !== false) totalLaborCost += h * (p.hourlyRate ?? DEFAULT_HOURLY_RATE);
    }
    const projCosts = costItemsByProject.get(p.id) || [];
    let zusatzkosten = 0;
    for (let i = 0; i < projCosts.length; i++) zusatzkosten += projCosts[i].amount || 0;
    return {
      p,
      totalHours,
      totalLaborCost,
      zusatzkosten,
      gesamtkosten: totalLaborCost + zusatzkosten
    };
  }).sort((a, b) => {
    const so = (STATUS_ORDER[computeAutoStatus(a.p)] ?? 5) - (STATUS_ORDER[computeAutoStatus(b.p)] ?? 5);
    if (so !== 0) return so;
    return (a.p.startWeek || '').localeCompare(b.p.startWeek || '');
  }), [projects, computeAutoStatus, assignmentsByProject, costItemsByProject]);
  const groupedRows = React.useMemo(() => {
    const catOrder = projCategoriesFromProjects.length > 0 ? projCategoriesFromProjects : [...new Set(rows.map(r => r.p.category || ''))];
    const map = new Map();
    catOrder.forEach(c => map.set(c, []));
    rows.forEach(r => {
      const cat = r.p.category || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(r);
    });
    return [...map.entries()].filter(([, rs]) => rs.length > 0);
  }, [rows, projCategoriesFromProjects]);
  const totalGesamtkosten = rows.reduce((acc, r) => acc + r.gesamtkosten, 0);
  const totalHoursAll = rows.reduce((acc, r) => acc + r.totalHours, 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-auto p-8 bg-slate-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-6xl mx-auto space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-4 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white border border-slate-300 border-l-4 border-l-gea-500 rounded-xl p-5 shadow-md"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-600 font-semibold uppercase tracking-wide"
  }, t('overview.activeProjects')), /*#__PURE__*/React.createElement("p", {
    className: "text-3xl font-bold text-gea-700 mt-1"
  }, activeProjects), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500 mt-1"
  }, t('overview.ofTotal', {
    n: projects.length
  }))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white border border-slate-300 border-l-4 border-l-gea-400 rounded-xl p-5 shadow-md"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-600 font-semibold uppercase tracking-wide"
  }, t('overview.employees')), /*#__PURE__*/React.createElement("p", {
    className: "text-3xl font-bold text-slate-800 mt-1"
  }, activeEmps.length), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500 mt-1"
  }, t('overview.activeLabel'))), /*#__PURE__*/React.createElement("div", {
    className: `bg-white border border-l-4 rounded-xl p-5 shadow-md cursor-pointer hover:shadow-lg transition-shadow ${avgUtil >= 100 ? 'border-rose-300 border-l-rose-500' : avgUtil >= 80 ? 'border-amber-300 border-l-amber-500' : 'border-slate-300 border-l-emerald-500'}`,
    onClick: () => {
      setActiveTab('resource');
      setTimeout(() => scrollToCurrentWeek(resourceScrollRef, timelineWeeks, 140), 120);
    },
    title: t('overview.toResource')
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-600 font-semibold uppercase tracking-wide"
  }, t('overview.avgUtil'), " \u2192"), /*#__PURE__*/React.createElement("p", {
    className: `text-3xl font-bold mt-1 ${avgUtil >= 100 ? 'text-rose-600' : avgUtil >= 80 ? 'text-amber-600' : 'text-emerald-600'}`
  }, avgUtil, "%"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500 mt-1"
  }, currentWeekStr)), /*#__PURE__*/React.createElement("div", {
    className: `bg-white border border-l-4 rounded-xl p-5 shadow-md cursor-pointer hover:shadow-lg transition-shadow ${overbookedCount > 0 ? 'border-rose-300 border-l-rose-500' : 'border-slate-300 border-l-slate-400'}`,
    onClick: () => {
      setActiveTab('resource');
      setTimeout(() => scrollToCurrentWeek(resourceScrollRef, timelineWeeks, 140), 120);
    },
    title: t('overview.toResource')
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-600 font-semibold uppercase tracking-wide"
  }, t('overview.overloaded'), " \u2192"), /*#__PURE__*/React.createElement("p", {
    className: `text-3xl font-bold mt-1 ${overbookedCount > 0 ? 'text-rose-600' : 'text-slate-800'}`
  }, overbookedCount), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500 mt-1"
  }, overbookedCount > 0 ? t('overview.overloadedCount') : t('overview.allOk')))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white border border-slate-300 rounded-xl p-5 shadow-md"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-600 font-semibold uppercase tracking-wide"
  }, t('overview.utilTrend')), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400"
  }, t('overview.utilTrendHint'))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-end gap-2"
  }, utilTrend.map(({
    week,
    avg
  }) => {
    const isCurrent = week === currentWeekStr;
    const barColor = avg >= 100 ? 'bg-rose-500' : avg >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
    const heightPct = Math.max(4, Math.min(100, avg / 150 * 100));
    return /*#__PURE__*/React.createElement("button", {
      key: week,
      onClick: () => jumpToWeek(week),
      title: `${formatKW(week)}: ${avg}%`,
      className: "flex-1 flex flex-col items-center gap-1.5 group"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-full h-16 bg-slate-50 rounded flex items-end overflow-hidden"
    }, /*#__PURE__*/React.createElement("div", {
      className: `w-full ${barColor} transition-all group-hover:opacity-80 ${isCurrent ? 'ring-2 ring-gea-500 ring-inset' : ''}`,
      style: {
        height: `${heightPct}%`
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: `text-[10px] ${isCurrent ? 'text-gea-700 font-bold' : 'text-slate-400'}`
    }, week.split('-W')[1]));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-xl text-gea-800 font-semibold"
  }, t('overview.title')), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4 text-sm text-slate-500"
  }, /*#__PURE__*/React.createElement("span", null, t('overview.projects', {
    n: rows.length
  })), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-300"
  }, "|"), /*#__PURE__*/React.createElement("span", null, fmt(totalHoursAll), " ", t('overview.hoursTotal')), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-300"
  }, "|"), /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-slate-700"
  }, fmt(totalGesamtkosten), " ", t('overview.costsTotal')))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gea-50 border-b-2 border-gea-200"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-4 text-gea-800 font-semibold max-w-[300px]"
  }, t('overview.colProject')), /*#__PURE__*/React.createElement("th", {
    className: "p-4 text-gea-800 font-semibold whitespace-nowrap min-w-[100px]"
  }, t('overview.colCountry')), /*#__PURE__*/React.createElement("th", {
    className: "p-4 text-gea-800 font-semibold whitespace-nowrap min-w-[100px]"
  }, t('overview.colStatus')), /*#__PURE__*/React.createElement("th", {
    className: "p-4 text-gea-800 font-semibold whitespace-nowrap"
  }, "IBN"), /*#__PURE__*/React.createElement("th", {
    className: "p-4 text-gea-800 font-semibold text-right"
  }, t('overview.colHours')), /*#__PURE__*/React.createElement("th", {
    className: "p-4 text-gea-800 font-semibold text-right"
  }, t('overview.colLabor')), /*#__PURE__*/React.createElement("th", {
    className: "p-4 text-gea-800 font-semibold text-right"
  }, t('overview.colExtra')), /*#__PURE__*/React.createElement("th", {
    className: "p-4 text-gea-800 font-semibold text-right"
  }, t('overview.colTotal')))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-slate-200"
  }, groupedRows.map(([cat, catRows]) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: cat
  }, /*#__PURE__*/React.createElement("tr", {
    className: "bg-slate-50 border-y border-slate-200"
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: 8,
    className: "px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider"
  }, cat || t('overview.noCategory'))), catRows.map(({
    p,
    totalHours,
    totalLaborCost,
    zusatzkosten,
    gesamtkosten
  }) => {
    const cc = resolveCountryCode(p.country);
    return /*#__PURE__*/React.createElement("tr", {
      key: p.id,
      className: "hover:bg-slate-50 cursor-pointer transition-colors",
      onClick: () => {
        setSelectedProjectDetails(p.id);
        setActiveTab('setup_proj');
      }
    }, /*#__PURE__*/React.createElement("td", {
      className: "p-4 max-w-[300px]"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: `w-2.5 h-2.5 rounded-full flex-shrink-0 ${resolveProjectColor(p.color).dot}`
    }), /*#__PURE__*/React.createElement("div", {
      className: "flex-1 min-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: "font-medium text-slate-900 truncate"
    }, p.name), /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-400 font-mono truncate"
    }, p.projectNumber || '–')))), /*#__PURE__*/React.createElement("td", {
      className: "p-4"
    }, /*#__PURE__*/React.createElement("span", {
      className: `text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${cc === '??' ? 'bg-rose-50 border-rose-200 text-rose-600' : cc === '/' ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`,
      title: "Land"
    }, cc)), /*#__PURE__*/React.createElement("td", {
      className: "p-4"
    }, /*#__PURE__*/React.createElement(StatusBadge, {
      status: computeAutoStatus(p),
      t: t
    })), /*#__PURE__*/React.createElement("td", {
      className: "p-4 text-slate-500 text-xs font-mono"
    }, p.ibnWeek || '–'), /*#__PURE__*/React.createElement("td", {
      className: "p-4 text-right text-slate-700 tabular-nums"
    }, fmt(totalHours), " h"), /*#__PURE__*/React.createElement("td", {
      className: "p-4 text-right text-slate-700 tabular-nums"
    }, p.billable !== false ? `${fmt(totalLaborCost)} €` : /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400 text-xs"
    }, "\u2013")), /*#__PURE__*/React.createElement("td", {
      className: "p-4 text-right text-slate-700 tabular-nums"
    }, zusatzkosten > 0 ? `${fmt(zusatzkosten)} €` : /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400"
    }, "\u2013")), /*#__PURE__*/React.createElement("td", {
      className: "p-4 text-right font-semibold text-slate-900 tabular-nums"
    }, gesamtkosten > 0 ? `${fmt(gesamtkosten)} €` : /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400 font-normal"
    }, "\u2013")));
  }))), rows.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 8,
    className: "p-0"
  }, /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement(IconBriefcase, {
      size: 32
    }),
    title: t('overview.noProjects'),
    description: t('overview.noProjectsDesc'),
    action: {
      label: t('proj.new'),
      onClick: () => {
        setActiveTab('setup_proj');
        openNewProjectForm();
      }
    }
  })))), rows.length > 0 && /*#__PURE__*/React.createElement("tfoot", {
    className: "border-t-2 border-gea-200 bg-gea-50"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "p-4 text-gea-800 font-semibold text-sm",
    colSpan: 4
  }, t('overview.total')), /*#__PURE__*/React.createElement("td", {
    className: "p-4 text-right font-semibold text-slate-900 tabular-nums"
  }, fmt(totalHoursAll), " h"), /*#__PURE__*/React.createElement("td", {
    className: "p-4 text-right font-semibold text-slate-900 tabular-nums"
  }, fmt(rows.reduce((a, r) => a + r.totalLaborCost, 0)), " \u20AC"), /*#__PURE__*/React.createElement("td", {
    className: "p-4 text-right font-semibold text-slate-900 tabular-nums"
  }, fmt(rows.reduce((a, r) => a + r.zusatzkosten, 0)), " \u20AC"), /*#__PURE__*/React.createElement("td", {
    className: "p-4 text-right font-bold text-gea-700 tabular-nums"
  }, fmt(totalGesamtkosten), " \u20AC")))))));
};