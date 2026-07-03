const ProjectDetailsView = ({
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
    empAliases,
    fxRates,
    expenseCategories,
    language,
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
    showToast,
    setEmpAliases,
    setFxRates
  } = h;
  const [isExpenseImportOpen, setIsExpenseImportOpen] = React.useState(false);
  const proj = projectById.get(selectedProjectDetails);
  const projId = proj?.id;
  const projAssignments = React.useMemo(() => (assignmentsByProject.get(projId) || []).filter(a => a.type === 'project'), [assignmentsByProject, projId]);
  const projCostItems = React.useMemo(() => costItemsByProject.get(projId) || [], [costItemsByProject, projId]);
  const assignmentsByEmpId = React.useMemo(() => {
    const m = new Map();
    projAssignments.forEach(a => {
      let arr = m.get(a.empId);
      if (!arr) {
        arr = [];
        m.set(a.empId, arr);
      }
      arr.push(a);
    });
    return m;
  }, [projAssignments]);
  const assignedEmpIds = React.useMemo(() => [...assignmentsByEmpId.keys()], [assignmentsByEmpId]);
  const presenceWeeks = React.useMemo(() => [...new Set(projAssignments.map(a => a.week))].sort(), [projAssignments]);
  const {
    totalHours,
    totalLaborCost,
    totalOtherCost,
    grandTotal
  } = React.useMemo(() => {
    let totalHours = 0,
      totalLaborCost = 0,
      totalOtherCost = 0;
    for (const [, empAss] of assignmentsByEmpId) {
      const hrs = empAss.reduce((acc, a) => acc + (a.hours ?? a.percent / 100 * HOURS_PER_WEEK), 0);
      totalHours += hrs;
      if (proj?.billable !== false) totalLaborCost += hrs * (proj?.hourlyRate ?? DEFAULT_HOURLY_RATE);
    }
    projCostItems.forEach(ci => {
      totalOtherCost += ci.amount || 0;
    });
    return {
      totalHours,
      totalLaborCost,
      totalOtherCost,
      grandTotal: totalLaborCost + totalOtherCost
    };
  }, [assignmentsByEmpId, projCostItems, proj?.billable, proj?.hourlyRate]);
  if (!proj) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-auto bg-slate-50 flex flex-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 border-b border-slate-300 bg-white flex items-center gap-4 flex-wrap shadow-sm"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSelectedProjectDetails(null),
    className: "p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors flex-shrink-0"
  }, /*#__PURE__*/React.createElement(IconArrowLeft, {
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl text-slate-900 font-medium truncate"
  }, proj.name), proj.projectNumber && /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200"
  }, proj.projectNumber)), /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-500 flex items-center gap-2 mt-1 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: `w-2 h-2 rounded-full ${resolveProjectColor(proj.color).dot}`
  }), proj.category), proj.projType && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "text-xs bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded font-medium"
  }, proj.projType)), proj.size != null && proj.size !== '' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "text-xs bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded font-medium"
  }, "Size ", proj.size)), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, proj.startWeek, " \u2013 ", proj.ibnWeek), proj.address && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, proj.address)), proj.sharepointLink && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("a", {
    href: proj.sharepointLink,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "flex items-center gap-1 text-gea-600 hover:text-gea-700 hover:underline"
  }, /*#__PURE__*/React.createElement(IconExternalLink, {
    size: 13
  }), " SharePoint")))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 flex-wrap"
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: computeAutoStatus(proj),
    t: t
  }), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer select-none"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!proj.projectCompleted,
    onChange: e => setProjects(projects.map(p => p.id === proj.id ? {
      ...p,
      projectCompleted: e.target.checked
    } : p)),
    className: "w-4 h-4 text-gea-600 rounded"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-medium text-slate-700"
  }, t('projDetail.completed'))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer select-none"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!proj.costsSubmitted,
    onChange: e => setProjects(projects.map(p => p.id === proj.id ? {
      ...p,
      costsSubmitted: e.target.checked
    } : p)),
    className: "w-4 h-4 text-gea-600 rounded"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-medium text-slate-700"
  }, t('projDetail.costsSubmitted'))), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setProjForm({
        name: proj.name,
        category: proj.category || projCategories[0] || '',
        projectNumber: proj.projectNumber || '',
        address: proj.address || '',
        country: proj.country || '',
        startWeek: proj.startWeek,
        ibnWeek: proj.ibnWeek,
        color: resolveProjectColor(proj.color).id,
        projType: proj.projType || '',
        size: proj.size != null ? String(proj.size) : '',
        sharepointLink: proj.sharepointLink || '',
        notes: proj.notes || ''
      });
      setEditingProjectId(proj.id);
      setIsProjFormOpen(true);
    },
    className: "bg-white border border-slate-300 hover:bg-gea-50 hover:border-gea-400 text-slate-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors"
  }, /*#__PURE__*/React.createElement(IconEdit, {
    size: 15
  }), " ", t('btn.edit')), /*#__PURE__*/React.createElement("button", {
    onClick: openInvoiceModal,
    className: "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors"
  }, /*#__PURE__*/React.createElement(IconFileText, {
    size: 15
  }), " ", t('projDetail.invoice')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setIsExpenseImportOpen(true),
    className: "bg-white border border-slate-300 hover:bg-gea-50 hover:border-gea-400 text-slate-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors"
  }, /*#__PURE__*/React.createElement(IconFileText, {
    size: 15
  }), " ", t('expense.importBtn')), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditingCostItem(null);
      setIsCostItemModalOpen(true);
    },
    className: "bg-gea-600 hover:bg-gea-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors"
  }, /*#__PURE__*/React.createElement(IconPlus, {
    size: 15
  }), " ", t('projDetail.costItem')))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 max-w-7xl mx-auto w-full space-y-6"
  }, assignedEmpIds.length > 0 && presenceWeeks.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-slate-900 text-base font-medium"
  }, t('projDetail.presence')), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400"
  }, presenceWeeks.length, " ", t('projDetail.weeks'))), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "text-xs border-collapse w-full"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 text-left text-slate-500 font-medium border-r border-slate-200 bg-slate-50 w-40 sticky left-0"
  }, t('projDetail.colEmployee')), presenceWeeks.map(w => /*#__PURE__*/React.createElement("th", {
    key: w,
    className: "p-2 text-center text-slate-500 font-medium border-r border-slate-200 bg-slate-50 min-w-[52px]"
  }, t('util.kw'), w.split('-W')[1])), /*#__PURE__*/React.createElement("th", {
    className: "p-2 text-center text-slate-500 font-medium bg-slate-50 min-w-[60px]"
  }, t('projDetail.colHours')))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-slate-100"
  }, assignedEmpIds.map(empId => {
    const emp = employeeById.get(empId);
    const empAss = assignmentsByEmpId.get(empId) || [];
    const empHours = empAss.reduce((acc, a) => acc + (a.hours ?? a.percent / 100 * HOURS_PER_WEEK), 0);
    return /*#__PURE__*/React.createElement("tr", {
      key: empId,
      className: "hover:bg-slate-50"
    }, /*#__PURE__*/React.createElement("td", {
      className: "p-3 text-slate-800 font-medium border-r border-slate-200 sticky left-0 bg-white"
    }, emp?.name || t('projDetail.unknown')), presenceWeeks.map(w => {
      const a = empAss.find(x => x.week === w);
      return /*#__PURE__*/React.createElement("td", {
        key: w,
        className: "p-1 text-center border-r border-slate-100"
      }, a ? /*#__PURE__*/React.createElement("button", {
        onClick: () => {
          setAssignContext({
            empId,
            week: w,
            existing: a
          });
          setIsAssignModalOpen(true);
        },
        className: "mx-auto w-9 h-7 rounded flex items-center justify-center bg-gea-100 text-gea-700 font-medium leading-none hover:bg-gea-200 transition-colors cursor-pointer"
      }, a.hours ?? Math.round((a.percent ?? 100) / 100 * HOURS_PER_WEEK), "h") : /*#__PURE__*/React.createElement("div", {
        className: "mx-auto w-9 h-7 rounded bg-slate-50"
      }));
    }), /*#__PURE__*/React.createElement("td", {
      className: "p-2 text-center text-slate-900 font-medium"
    }, empHours, "h"));
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-slate-900 text-base font-medium"
  }, t('projDetail.costItems')), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditingCostItem(null);
      setIsCostItemModalOpen(true);
    },
    className: "text-gea-600 text-sm font-medium hover:text-gea-700 flex items-center gap-1"
  }, /*#__PURE__*/React.createElement(IconPlus, {
    size: 15
  }), " ", t('btn.add'))), projCostItems.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "p-10 text-center text-slate-400 text-sm"
  }, t('projDetail.noCostItems')) : /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-slate-50 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 text-slate-500 font-medium"
  }, t('projDetail.colEmployee')), /*#__PURE__*/React.createElement("th", {
    className: "p-3 text-slate-500 font-medium"
  }, t('projDetail.colOccasion')), /*#__PURE__*/React.createElement("th", {
    className: "p-3 text-slate-500 font-medium text-center"
  }, t('util.kw')), /*#__PURE__*/React.createElement("th", {
    className: "p-3 text-slate-500 font-medium"
  }, t('projDetail.colItems')), /*#__PURE__*/React.createElement("th", {
    className: "p-3 text-slate-500 font-medium text-right"
  }, t('projDetail.colAmount')), /*#__PURE__*/React.createElement("th", {
    className: "p-3"
  }))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-slate-100"
  }, projCostItems.map(ci => {
    const emp = employeeById.get(ci.empId);
    const ciLines = ci.lines || [];
    return /*#__PURE__*/React.createElement("tr", {
      key: ci.id,
      className: "hover:bg-slate-50 transition-colors align-top"
    }, /*#__PURE__*/React.createElement("td", {
      className: "p-3 text-slate-800 font-medium"
    }, emp?.name || '–'), /*#__PURE__*/React.createElement("td", {
      className: "p-3 text-slate-600"
    }, ci.description || '–'), /*#__PURE__*/React.createElement("td", {
      className: "p-3 text-slate-500 text-xs text-center"
    }, (() => {
      if (ci.dateFrom) {
        const kwF = parseInt(getWeekString(new Date(ci.dateFrom)).split('-W')[1]);
        const kwT = ci.dateTo ? parseInt(getWeekString(new Date(ci.dateTo)).split('-W')[1]) : kwF;
        const kw = t('util.kw');
        return kwF === kwT ? `${kw}${kwF}` : `${kw}${kwF}–${kw}${kwT}`;
      }
      return ci.week ? `${t('util.kw')}${ci.week.split('-W')[1]}` : '–';
    })()), /*#__PURE__*/React.createElement("td", {
      className: "p-3"
    }, ciLines.length === 0 ? /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400 text-xs"
    }, "\u2013") : /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-1"
    }, ciLines.map(l => {
      const cfg = COST_LINE_TYPES[l.type] || COST_LINE_TYPES.other;
      const amt = l.amount || 0;
      return /*#__PURE__*/React.createElement("div", {
        key: l.id,
        className: "flex items-center gap-2 text-xs"
      }, /*#__PURE__*/React.createElement("span", {
        className: `px-2 py-0.5 rounded-full border font-medium shrink-0 ${cfg.chip}`
      }, cfg.label), l.type === 'hours' && l.hours != null && /*#__PURE__*/React.createElement("span", {
        className: "text-slate-500 tabular-nums"
      }, l.hours, "h \xD7 ", l.hourlyRate, "\u20AC"), l.comment && /*#__PURE__*/React.createElement("span", {
        className: "text-slate-500 truncate"
      }, l.comment), /*#__PURE__*/React.createElement("span", {
        className: "text-slate-700 tabular-nums ml-auto"
      }, amt.toFixed(2), " \u20AC"));
    }))), /*#__PURE__*/React.createElement("td", {
      className: "p-3 text-right text-slate-900 font-medium tabular-nums"
    }, (ci.amount || 0).toFixed(2), " \u20AC"), /*#__PURE__*/React.createElement("td", {
      className: "p-3 text-right"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setEditingCostItem(ci);
        setIsCostItemModalOpen(true);
      },
      className: "text-gea-600 text-xs font-medium hover:text-gea-700"
    }, t('btn.edit'))));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-50 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-slate-900 text-base font-medium"
  }, t('projDetail.summary'))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 grid grid-cols-2 gap-4 md:grid-cols-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg border border-slate-200 bg-slate-50/50 p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-7 h-7 rounded-md bg-slate-200 flex items-center justify-center"
  }, /*#__PURE__*/React.createElement(IconClock, {
    size: 14,
    className: "text-slate-500"
  })), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-500 font-medium uppercase tracking-wide"
  }, t('projDetail.hours'))), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl text-slate-900 font-semibold tabular-nums"
  }, totalHours, "h")), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg border border-slate-200 bg-slate-50/50 p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center"
  }, /*#__PURE__*/React.createElement(IconUsers, {
    size: 14,
    className: "text-blue-600"
  })), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-500 font-medium uppercase tracking-wide"
  }, t('projDetail.laborCosts'))), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl text-slate-900 font-semibold tabular-nums"
  }, totalLaborCost.toFixed(2), " \u20AC"), proj.billable === false && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 mt-1"
  }, t('projDetail.notCalc'))), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg border border-slate-200 bg-slate-50/50 p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center"
  }, /*#__PURE__*/React.createElement(IconFileText, {
    size: 14,
    className: "text-amber-600"
  })), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-500 font-medium uppercase tracking-wide"
  }, t('projDetail.extraCosts'))), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl text-slate-900 font-semibold tabular-nums"
  }, totalOtherCost.toFixed(2), " \u20AC")), /*#__PURE__*/React.createElement("div", {
    className: "rounded-xl border-2 border-gea-300 bg-gradient-to-br from-gea-50 to-gea-100 p-4 shadow-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-7 h-7 rounded-md bg-gea-500 flex items-center justify-center"
  }, /*#__PURE__*/React.createElement(IconBarChart, {
    size: 14,
    className: "text-white"
  })), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gea-700 font-medium uppercase tracking-wide"
  }, t('projDetail.total'))), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl text-gea-800 font-bold tabular-nums"
  }, grandTotal.toFixed(2), " \u20AC"))), /*#__PURE__*/React.createElement("div", {
    className: "px-6 pb-5 pt-1 flex items-center gap-4 border-t border-slate-100"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer select-none"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: proj.billable !== false,
    onChange: () => setProjects(projects.map(p => p.id === proj.id ? {
      ...p,
      billable: !p.billable
    } : p)),
    className: "w-4 h-4 text-gea-600 rounded"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-slate-700"
  }, t('projDetail.calcHours'))), proj.billable !== false && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-slate-500"
  }, t('projDetail.hourRate')), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    step: "1",
    value: proj.hourlyRate ?? DEFAULT_HOURLY_RATE,
    onChange: e => setProjects(projects.map(p => p.id === proj.id ? {
      ...p,
      hourlyRate: parseFloat(e.target.value) || 0
    } : p)),
    className: "w-20 p-1.5 border border-slate-300 rounded text-sm text-center font-medium"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-slate-400"
  }, "\u20AC/h"))))), isExpenseImportOpen && /*#__PURE__*/React.createElement(ExpenseImportModal, {
    proj: proj,
    employees: employees,
    assignments: assignments,
    costItems: costItems,
    setCostItems: setCostItems,
    handleSaveAssignment: handleSaveAssignment,
    empAliases: empAliases,
    setEmpAliases: setEmpAliases,
    fxRates: fxRates,
    setFxRates: setFxRates,
    expenseCategories: expenseCategories,
    showToast: showToast,
    onClose: () => setIsExpenseImportOpen(false),
    t: t
  }), isCostItemModalOpen && /*#__PURE__*/React.createElement(CostItemModal, {
    projectId: proj.id,
    existingItem: editingCostItem,
    assignments: assignments,
    employees: employees,
    costItems: costItems,
    setCostItems: setCostItems,
    showToast: showToast,
    onClose: () => {
      setIsCostItemModalOpen(false);
      setEditingCostItem(null);
    },
    t: t
  }));
};