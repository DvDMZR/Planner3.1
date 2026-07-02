const ResourceView = ({
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
    scrollToCurrentWeek
  } = h;
  const WEEK_W = 220;
  const STICKY_W = 288; // matches w-72

  const [scrollInfo, setScrollInfo] = React.useState({
    progress: 0,
    label: ''
  });
  // Horizontal virtualization: only render the body cells for the
  // visible week range (+ buffer). The header keeps all weeks so the
  // table column widths stay stable; body rows use colSpan spacers
  // for the off-screen ranges.
  const [visibleRange, setVisibleRange] = React.useState({
    start: 0,
    end: 25
  });
  const scrollRafRef = React.useRef(null);
  React.useEffect(() => () => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
  }, []);
  const handleScroll = React.useCallback(e => {
    if (scrollRafRef.current) return;
    const {
      scrollLeft,
      scrollWidth,
      clientWidth
    } = e.currentTarget;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const maxScroll = scrollWidth - clientWidth;
      const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0;
      const firstIdx = Math.max(0, Math.floor(scrollLeft / WEEK_W));
      const lastIdx = Math.min(timelineWeeks.length - 1, firstIdx + Math.floor((clientWidth - STICKY_W) / WEEK_W) - 1);
      const label = timelineWeeks[firstIdx] && timelineWeeks[lastIdx] ? `${timelineWeeks[firstIdx].label} – ${timelineWeeks[lastIdx].label}` : '';
      setScrollInfo({
        progress,
        label
      });
      const newStart = Math.max(0, firstIdx - VIRT_BUFFER);
      const newEnd = Math.min(timelineWeeks.length - 1, lastIdx + VIRT_BUFFER);
      setVisibleRange(prev => prev.start === newStart && prev.end === newEnd ? prev : {
        start: newStart,
        end: newEnd
      });
    });
  }, [timelineWeeks]);
  const scrollWeeks = n => resourceScrollRef.current?.scrollBy({
    left: n * WEEK_W,
    behavior: 'smooth'
  });
  const activeCategories = activeEmpCategories;
  const currentWeek = getWeekString(new Date());
  const currentYear = new Date().getFullYear();
  const resourceWeeks = timelineWeeks;
  const compact = s.compactView;
  const setCompact = next => h.setCompactView(typeof next === 'function' ? next(s.compactView) : next);
  const [empSearch, setEmpSearch] = React.useState('');
  const [empSearchRaw, setEmpSearchRaw] = React.useState('');

  // Honour scrollTarget set by the Auslastung-cell jump.
  // Optional fields: weekId (scroll to that week) and/or empName
  // (pre-populate the Mitarbeiter-search filter).
  React.useEffect(() => {
    const target = s.scrollTarget;
    if (!target) return;
    if (target.empName) {
      setEmpSearchRaw(target.empName);
      setEmpSearch(target.empName);
    } else if (target.clearEmpFilter) {
      setEmpSearchRaw('');
      setEmpSearch('');
    }
    const timer = setTimeout(() => {
      if (target.weekId) {
        const idx = resourceWeeks.findIndex(w => w.id === target.weekId);
        if (idx >= 0 && resourceScrollRef.current) {
          resourceScrollRef.current.scrollLeft = idx * WEEK_W;
        }
      }
      h.setScrollTarget(null);
    }, 80);
    return () => clearTimeout(timer);
  }, [s.scrollTarget, resourceWeeks]);
  const empDebounceRef = React.useRef(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);
  const [undoStack, setUndoStack] = React.useState([]);
  React.useEffect(() => {
    if (!isDeleteMode) setUndoStack([]);
  }, [isDeleteMode]);
  const deleteWithUndo = React.useCallback(id => {
    const a = assignments.find(x => x.id === id);
    if (a) setUndoStack(prev => [...prev, a]);
    handleDeleteAssignment(id);
  }, [assignments, handleDeleteAssignment]);
  const undoDelete = React.useCallback(() => {
    setUndoStack(prev => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setAssignments(a => [...a, last]);
      return prev.slice(0, -1);
    });
  }, [setAssignments]);
  const searchTerms = React.useMemo(() => {
    return empSearch.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }, [empSearch]);

  // Pre-lowercase category names and employee names once per category
  // change. Keystroke-driven filtering below would otherwise call
  // toLowerCase() on every employee for every render.
  const searchIndex = React.useMemo(() => {
    const out = new Map();
    activeCategories.forEach(cat => {
      const emps = activeEmpsByCategory.get(cat) || [];
      out.set(cat, {
        catLower: cat.toLowerCase(),
        emps,
        empNamesLower: emps.map(e => (e.name || '').toLowerCase())
      });
    });
    return out;
  }, [activeCategories, activeEmpsByCategory]);
  const displayCategories = React.useMemo(() => {
    if (searchTerms.length === 0) return activeCategories;
    return activeCategories.filter(cat => {
      const idx = searchIndex.get(cat);
      if (!idx) return false;
      return searchTerms.some(q => idx.catLower.includes(q) || idx.empNamesLower.some(n => n.includes(q)));
    });
  }, [searchTerms, activeCategories, searchIndex]);
  const getFilteredEmps = React.useCallback(cat => {
    const idx = searchIndex.get(cat);
    const emps = idx ? idx.emps : activeEmpsByCategory.get(cat) || [];
    if (searchTerms.length === 0) return emps;
    if (idx && searchTerms.some(q => idx.catLower.includes(q))) return emps;
    if (!idx) return emps;
    return emps.filter((_, i) => {
      const nameLower = idx.empNamesLower[i];
      return searchTerms.some(q => nameLower.includes(q));
    });
  }, [searchTerms, searchIndex, activeEmpsByCategory]);
  const monthGroups = React.useMemo(() => {
    const groups = [];
    let cur = null;
    resourceWeeks.forEach(w => {
      if (!cur || cur.month !== w.month) {
        cur = {
          month: w.month,
          count: 1
        };
        groups.push(cur);
      } else {
        cur.count++;
      }
    });
    return groups;
  }, [resourceWeeks]);

  // Clamp visibleRange against the current week list (year switches can
  // shrink it) and derive the slice + spacer widths used by every body
  // row. The clamping happens in render so we don't need a separate
  // effect just to keep the state consistent.
  const safeStart = Math.max(0, Math.min(visibleRange.start, resourceWeeks.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(visibleRange.end, resourceWeeks.length - 1));
  const visibleWeeks = React.useMemo(() => resourceWeeks.slice(safeStart, safeEnd + 1), [resourceWeeks, safeStart, safeEnd]);
  const leftSpacerSpan = safeStart;
  const rightSpacerSpan = Math.max(0, resourceWeeks.length - 1 - safeEnd);
  if (activeEmployees.length === 0) {
    const isLoggedIn = !!s.currentUser;
    return /*#__PURE__*/React.createElement("div", {
      className: "flex-1 flex flex-col h-full bg-white"
    }, /*#__PURE__*/React.createElement("div", {
      className: "p-4 border-b border-slate-300 bg-gea-50 flex items-center gap-3"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "text-gea-800 text-xl font-semibold shrink-0"
    }, t('resource.title'))), /*#__PURE__*/React.createElement(EmptyState, {
      icon: /*#__PURE__*/React.createElement(IconUsers, {
        size: 32
      }),
      title: t('resource.noEmps'),
      description: isLoggedIn ? t('resource.noEmpsDesc') : "Bitte melden Sie sich an, um Mitarbeiter anzulegen.",
      action: isLoggedIn ? {
        label: t('resource.addEmp'),
        onClick: () => setActiveTab('setup_emp')
      } : null
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex-1 flex flex-col h-full bg-white overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-b border-slate-300 bg-gea-50 flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-gea-800 text-xl font-semibold shrink-0"
  }, t('resource.title')), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center"
  }, /*#__PURE__*/React.createElement(Tooltip, {
    text: t('btn.weeks4back')
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => scrollWeeks(-4),
    className: "p-1.5 rounded-l bg-gea-100 text-gea-700 hover:bg-gea-200 transition-colors border-r border-gea-200"
  }, /*#__PURE__*/React.createElement(IconChevronLeft, {
    size: 16
  }))), /*#__PURE__*/React.createElement("span", {
    className: "px-2 text-xs text-slate-500 bg-gea-50 h-[30px] flex items-center min-w-[130px] justify-center border-y border-gea-100 font-mono tabular-nums"
  }, scrollInfo.label || '—'), /*#__PURE__*/React.createElement(Tooltip, {
    text: t('btn.weeks4fwd')
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => scrollWeeks(4),
    className: "p-1.5 rounded-r bg-gea-100 text-gea-700 hover:bg-gea-200 transition-colors border-l border-gea-200"
  }, /*#__PURE__*/React.createElement(IconChevronRight, {
    size: 16
  })))), /*#__PURE__*/React.createElement("select", {
    value: timelineYear,
    onChange: e => setTimelineYear(Number(e.target.value)),
    className: "border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-gea-400"
  }, Array.from({
    length: 7
  }, (_, i) => currentYear - 1 + i).map(y => /*#__PURE__*/React.createElement("option", {
    key: y,
    value: y
  }, y))), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (timelineYear !== currentYear) {
        setTimelineYear(currentYear);
        setTimeout(() => scrollToCurrentWeek(resourceScrollRef, resourceWeeks, WEEK_W), 120);
      } else {
        scrollToCurrentWeek(resourceScrollRef, resourceWeeks, WEEK_W);
      }
    },
    className: "px-3 py-1.5 bg-gea-100 text-gea-700 rounded-lg text-sm font-medium hover:bg-gea-200 transition-colors"
  }, t('btn.today'))), isDeleteMode && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center bg-rose-50 border border-rose-300 rounded-lg overflow-hidden shrink-0"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-rose-700"
  }, /*#__PURE__*/React.createElement(IconTrash, {
    size: 14,
    className: "shrink-0"
  }), t('btn.deleteModeActive')), undoStack.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: undoDelete,
    className: "flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-100 border-l border-rose-300 transition-colors"
  }, "\u21A9 ", undoStack.length), /*#__PURE__*/React.createElement("button", {
    onClick: () => setIsDeleteMode(false),
    className: "flex items-center px-2.5 py-1.5 text-rose-500 hover:bg-rose-100 border-l border-rose-300 transition-colors"
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 ml-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement(IconUsers, {
    size: 14,
    className: "absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
  }), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: empSearchRaw,
    onChange: e => {
      const v = e.target.value;
      setEmpSearchRaw(v);
      if (empDebounceRef.current) clearTimeout(empDebounceRef.current);
      empDebounceRef.current = setTimeout(() => setEmpSearch(v), 250);
    },
    placeholder: t('resource.empSearch'),
    title: t('resource.empSearchTitle'),
    className: "pl-7 pr-7 py-1.5 border border-slate-300 rounded text-sm bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-gea-400 w-44"
  }), empSearchRaw && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (empDebounceRef.current) clearTimeout(empDebounceRef.current);
      setEmpSearchRaw('');
      setEmpSearch('');
    },
    className: "absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 12
  }))), /*#__PURE__*/React.createElement("div", {
    className: "relative",
    ref: menuRef
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMenuOpen(o => !o),
    "aria-label": t('btn.moreOptions'),
    className: `w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${menuOpen ? 'bg-slate-100 border-slate-400 text-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:border-gea-400 hover:text-gea-600'}`
  }, /*#__PURE__*/React.createElement(IconMoreHorizontal, {
    size: 16
  })), menuOpen && /*#__PURE__*/React.createElement("div", {
    className: "absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[190px] z-50"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setCompact(c => !c);
      setMenuOpen(false);
    },
    className: "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
  }, /*#__PURE__*/React.createElement(IconList, {
    size: 14,
    className: "shrink-0 text-slate-400"
  }), /*#__PURE__*/React.createElement("span", null, t('btn.compactView')), compact && /*#__PURE__*/React.createElement("span", {
    className: "ml-auto text-gea-600 font-bold text-xs"
  }, "\u2713")), s.currentUser && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setIsDeleteMode(m => !m);
      setMenuOpen(false);
    },
    className: `w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${isDeleteMode ? 'text-rose-600' : 'text-slate-700'}`
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 14,
    className: `shrink-0 ${isDeleteMode ? 'text-rose-500' : 'text-slate-400'}`
  }), /*#__PURE__*/React.createElement("span", null, t('btn.deleteMode')), isDeleteMode && /*#__PURE__*/React.createElement("span", {
    className: "ml-auto w-2 h-2 rounded-full bg-rose-500 shrink-0"
  })), /*#__PURE__*/React.createElement("div", {
    className: "my-1 border-t border-slate-100"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setIsHelpModalOpen(true);
      setMenuOpen(false);
    },
    className: "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-bold w-3.5 text-center text-slate-400 shrink-0"
  }, "?"), /*#__PURE__*/React.createElement("span", null, t('btn.helpLegend'))))))), /*#__PURE__*/React.createElement("div", {
    className: "h-0.5 bg-slate-100 shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full bg-gea-400 transition-all duration-150",
    style: {
      width: `${scrollInfo.progress * 100}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    ref: resourceScrollRef,
    className: `flex-1 overflow-auto relative outline-none border-2 transition-colors ${isDeleteMode ? 'border-rose-400' : 'border-transparent'}`,
    onScroll: handleScroll,
    tabIndex: -1,
    onKeyDown: e => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollWeeks(-1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollWeeks(1);
      }
      if (e.key === 'PageUp') {
        e.preventDefault();
        scrollWeeks(-4);
      }
      if (e.key === 'PageDown') {
        e.preventDefault();
        scrollWeeks(4);
      }
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full border-collapse text-sm text-left table-fixed"
  }, /*#__PURE__*/React.createElement("colgroup", null, /*#__PURE__*/React.createElement("col", {
    style: {
      width: STICKY_W
    }
  }), resourceWeeks.map(w => /*#__PURE__*/React.createElement("col", {
    key: w.id,
    style: {
      width: WEEK_W
    }
  }))), /*#__PURE__*/React.createElement("thead", {
    className: "sticky top-0 bg-white z-20 shadow-sm"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "border-b border-slate-200 sticky-col-divider w-72 bg-slate-50 sticky left-0 z-30 "
  }), monthGroups.map(g => {
    const localMonth = language === 'de' ? g.month : MONTH_NAMES.reduce((s, de, i) => s.replace(de, MONTH_NAMES_EN[i]), g.month);
    return /*#__PURE__*/React.createElement("th", {
      key: g.month,
      colSpan: g.count,
      className: "px-2 py-1 border-b border-r border-slate-200 text-center text-[11px] font-semibold text-gea-700 bg-gea-50/80 uppercase tracking-wide"
    }, localMonth);
  })), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-4 border-b-2 border-slate-300 sticky-col-divider w-72 bg-slate-50 sticky left-0 z-30 text-slate-500 uppercase tracking-wider text-xs font-medium "
  }, t('resource.colEmployee')), resourceWeeks.map(w => {
    const isCurrent = w.id === currentWeek;
    const isPast = w.id < currentWeek;
    return /*#__PURE__*/React.createElement("th", {
      key: w.id,
      ref: isCurrent ? currentWeekColRef : null,
      className: `p-3 border-b-2 border-r border-slate-300 text-center font-medium ${isCurrent ? 'bg-gea-100 text-gea-800 border-b-gea-500' : isPast ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600'}`
    }, /*#__PURE__*/React.createElement("div", null, `${t('util.kw')} ${parseInt(w.id.split('-W')[1])}`), /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] font-normal opacity-70"
    }, w.sub), w.holidays.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "text-[9px] font-semibold text-amber-600 leading-tight mt-0.5 truncate",
      title: w.holidays.join(' · ')
    }, w.holidays.join(' · ')));
  }))), /*#__PURE__*/React.createElement("tbody", null, displayCategories.map(category => {
    const isCollapsed = !empSearch && collapsedCategories[category];
    const catEmps = getFilteredEmps(category);
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: category
    }, /*#__PURE__*/React.createElement("tr", {
      className: "bg-slate-200/70 border-t-2 border-b border-slate-300 cursor-pointer hover:bg-slate-300/50 transition-colors group",
      onClick: () => toggleCategory(category)
    }, /*#__PURE__*/React.createElement("td", {
      className: "p-3 text-slate-700 sticky left-0 z-20 bg-slate-200 border-l-4 border-l-gea-500 border-b border-slate-300 sticky-col-divider"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 text-sm uppercase tracking-wider font-medium"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400 group-hover:text-gea-500 transition-colors"
    }, isCollapsed ? /*#__PURE__*/React.createElement(IconChevronRight, {
      size: 16
    }) : /*#__PURE__*/React.createElement(IconChevronDown, {
      size: 16
    })), category, /*#__PURE__*/React.createElement("span", {
      className: "ml-auto text-xs bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 font-medium"
    }, catEmps.length))), leftSpacerSpan > 0 && /*#__PURE__*/React.createElement("td", {
      colSpan: leftSpacerSpan,
      className: "border-b border-slate-300 bg-slate-200/70"
    }), visibleWeeks.map(w => /*#__PURE__*/React.createElement("td", {
      key: `header-${w.id}`,
      className: "border-b border-slate-300 bg-slate-200/70"
    })), rightSpacerSpan > 0 && /*#__PURE__*/React.createElement("td", {
      colSpan: rightSpacerSpan,
      className: "border-b border-slate-300 bg-slate-200/70"
    })), !isCollapsed && catEmps.map(emp => {
      const empWH = emp.weeklyHours ?? HOURS_PER_WEEK;
      return /*#__PURE__*/React.createElement("tr", {
        key: emp.id,
        className: "hover:bg-slate-50/50 transition-colors"
      }, /*#__PURE__*/React.createElement("td", {
        className: "p-3 border-b border-slate-300 sticky-col-divider bg-white sticky left-0 z-20 "
      }, /*#__PURE__*/React.createElement("div", {
        className: "text-slate-800 font-medium text-sm"
      }, emp.name)), leftSpacerSpan > 0 && /*#__PURE__*/React.createElement("td", {
        colSpan: leftSpacerSpan,
        className: "border-b border-r border-slate-300 bg-white"
      }), visibleWeeks.map(w => {
        const {
          total,
          isOfftime,
          assignments: wAss
        } = getUtilization(emp.id, w.id);
        const isOverbooked = total > 100;
        const cellBg = isOfftime ? 'bg-slate-50 diagonal-stripes' : wAss.length === 0 ? 'bg-emerald-50/40' : isOverbooked ? 'bg-rose-50' : total >= 80 ? 'bg-amber-50' : 'bg-emerald-50/60';
        return /*#__PURE__*/React.createElement("td", {
          key: w.id,
          className: `p-1.5 border-b border-r border-slate-300 relative transition-colors group/cell overflow-hidden ${isDeleteMode ? 'bg-rose-50/20' : 'cursor-pointer hover:bg-gea-50/30'} ${cellBg} ${w.id === currentWeek ? 'bg-gea-50/50 border-l border-l-gea-300 border-r-gea-300' : ''} ${w.id < currentWeek ? 'opacity-60' : ''}`,
          onClick: () => {
            if (!isDeleteMode) {
              setAssignContext({
                empId: emp.id,
                week: w.id
              });
              setIsAssignModalOpen(true);
            }
          },
          onDragOver: e => {
            if (!isDeleteMode) e.preventDefault();
          },
          onDrop: e => {
            if (!isDeleteMode) handleDrop(e, w.id, emp.id, true);
          }
        }, wAss.length === 0 && !isOfftime && /*#__PURE__*/React.createElement("div", {
          className: "absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 text-gea-300 transition-opacity"
        }, /*#__PURE__*/React.createElement(IconPlus, {
          size: 20
        })), /*#__PURE__*/React.createElement("div", {
          className: `flex flex-col gap-1 relative z-10 ${compact ? 'min-h-[20px]' : 'min-h-[44px]'}`
        }, wAss.map(a => {
          let label = a.reference;
          let color = 'bg-white border-slate-200 text-slate-700';
          let dotColor = 'bg-slate-400';
          if (a.type === 'project') {
            const p = projectById.get(a.reference);
            label = p ? [p.projType, p.size, p.name].filter(Boolean).join(' ') : t('resource.unknown');
            if (p) {
              const pc = resolveProjectColor(p.color);
              color = pc.chip;
              dotColor = pc.dot;
            }
          } else if (a.type === 'support') {
            const sc = SUPPORT_CHIP_COLORS[a.reference];
            if (sc) {
              color = sc.chip;
              dotColor = sc.dot;
            } else {
              color = 'bg-amber-50 border-amber-200 text-amber-800';
              dotColor = 'bg-amber-500';
            }
          } else if (a.type === 'training') {
            color = TRAINING_CHIP_COLOR.chip;
            dotColor = TRAINING_CHIP_COLOR.dot;
          } else if (a.type === 'other') {
            const taskMeta = basicTasksMeta[a.reference];
            if (taskMeta?.color) {
              const tc = resolveProjectColor(taskMeta.color);
              color = tc.chip;
              dotColor = tc.dot;
            } else {
              color = 'bg-slate-50 border-slate-200 text-slate-700';
              dotColor = 'bg-slate-400';
            }
          } else if (a.type === 'offtime') {
            color = 'bg-slate-100 border-slate-300 text-slate-600';
            dotColor = 'bg-slate-500';
          } else if (a.type === 'basic') {
            const taskMeta = basicTasksMeta?.[a.reference];
            if (taskMeta?.color) {
              const tc = resolveProjectColor(taskMeta.color);
              color = tc.chip;
              dotColor = tc.dot;
            }
          }
          const pct = Math.round((a.hours ?? (a.percent ?? 100) / 100 * empWH) / empWH * 100);
          return /*#__PURE__*/React.createElement("div", {
            key: a.id,
            draggable: !isDeleteMode,
            title: pct === 0 ? a.comment ? a.comment + ' · ' + t('resource.tentative') : t('resource.tentative') : a.comment || undefined,
            onDragStart: e => {
              e.stopPropagation();
              e.dataTransfer.setData('assignmentId', a.id);
            },
            onClick: e => {
              e.stopPropagation();
              if (isDeleteMode) {
                deleteWithUndo(a.id);
              } else {
                setAssignContext({
                  empId: emp.id,
                  week: w.id,
                  existing: a
                });
                setIsAssignModalOpen(true);
              }
            },
            className: `text-[11px] rounded-md border flex justify-between items-stretch shadow-sm transition-all group/chip overflow-hidden ${isDeleteMode ? 'cursor-pointer hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 hover:line-through' : 'hover:shadow hover:-translate-y-0.5 cursor-grab active:cursor-grabbing'} ${color} ${isOverbooked ? 'ring-1 ring-rose-500 ring-inset' : ''} ${pct === 0 ? 'bg-hatched' : ''}`
          }, /*#__PURE__*/React.createElement("div", {
            className: "flex items-center gap-1.5 min-w-0"
          }, /*#__PURE__*/React.createElement("div", {
            className: `w-1 flex-shrink-0 self-stretch ${dotColor}`
          }), /*#__PURE__*/React.createElement("span", {
            className: `truncate font-medium px-1 ${compact ? 'py-0.5' : 'py-1.5'}`
          }, label), a.comment && /*#__PURE__*/React.createElement(IconMessageSquare, {
            size: 11,
            className: "flex-shrink-0 opacity-80"
          }), !compact && a.ruleId && /*#__PURE__*/React.createElement(IconRepeat, {
            size: 9,
            className: "flex-shrink-0 opacity-60"
          })), /*#__PURE__*/React.createElement("div", {
            className: "flex items-center gap-1 ml-1 flex-shrink-0"
          }, !compact && /*#__PURE__*/React.createElement("span", {
            className: "opacity-70 bg-slate-100/50 px-1 rounded font-medium"
          }, pct, "%"), !isDeleteMode && /*#__PURE__*/React.createElement("button", {
            onClick: e => {
              e.stopPropagation();
              setCopyContext({
                assignment: a
              });
              setIsCopyModalOpen(true);
            },
            className: "opacity-0 group-hover/chip:opacity-100 text-slate-400 hover:text-gea-600 transition-opacity p-0.5 rounded",
            title: t('btn.copy')
          }, /*#__PURE__*/React.createElement(IconCopy, {
            size: 10
          }))));
        }), !compact && wAss.length > 0 && !isOfftime && /*#__PURE__*/React.createElement("div", {
          onClick: e => {
            e.stopPropagation();
            setAssignContext({
              empId: emp.id,
              week: w.id
            });
            setIsAssignModalOpen(true);
          },
          className: "opacity-0 group-hover/cell:opacity-100 text-[10px] px-2 py-1.5 rounded-md border border-dashed border-gea-300 text-gea-600 flex justify-center items-center shadow-sm hover:bg-gea-50 transition-all mt-0.5"
        }, /*#__PURE__*/React.createElement(IconPlus, {
          size: 12,
          className: "mr-1"
        }), " ", t('resource.more'))), isOverbooked && /*#__PURE__*/React.createElement("div", {
          className: "absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_4px_rgba(244,63,94,0.5)] z-20"
        }));
      }), rightSpacerSpan > 0 && /*#__PURE__*/React.createElement("td", {
        colSpan: rightSpacerSpan,
        className: "border-b border-r border-slate-300 bg-white"
      }));
    }));
  })))));
};