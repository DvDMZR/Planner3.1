function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// TIMELINE_WEEK_W and TIMELINE_STICKY_W live in config.js
const TimelineView = ({
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
    scrollToCurrentWeek
  } = h;
  const [scrollInfo, setScrollInfo] = React.useState({
    progress: 0,
    label: ''
  });
  // Same horizontal virtualization as resource.jsx: only body cells in
  // the visible range (+ 8-week buffer) get rendered; the header always
  // shows all weeks so column widths stay stable.
  const [visibleRange, setVisibleRange] = React.useState({
    start: 0,
    end: 25
  });
  const scrollRafRef = React.useRef(null);
  React.useEffect(() => () => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
  }, []);
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
      const firstIdx = Math.max(0, Math.floor(scrollLeft / TIMELINE_WEEK_W));
      const lastIdx = Math.min(timelineWeeks.length - 1, firstIdx + Math.floor((clientWidth - TIMELINE_STICKY_W) / TIMELINE_WEEK_W) - 1);
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
  const scrollWeeks = n => timelineScrollRef.current?.scrollBy({
    left: n * TIMELINE_WEEK_W,
    behavior: 'smooth'
  });
  const activeProjCategories = projCategoriesFromProjects;
  const currentYear = new Date().getFullYear();
  const currentWeekStr = getWeekString(new Date());

  // Clamp the visible range against the current week list (year switch
  // can shrink it) and derive the slice + colSpan widths used by every
  // body row.
  const safeStart = Math.max(0, Math.min(visibleRange.start, timelineWeeks.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(visibleRange.end, timelineWeeks.length - 1));
  const visibleWeeks = React.useMemo(() => timelineWeeks.slice(safeStart, safeEnd + 1), [timelineWeeks, safeStart, safeEnd]);
  const leftSpacerSpan = safeStart;
  const rightSpacerSpan = Math.max(0, timelineWeeks.length - 1 - safeEnd);
  if (projects.length === 0) {
    const isLoggedIn = !!s.currentUser;
    return /*#__PURE__*/React.createElement("div", {
      className: "flex-1 flex flex-col h-full bg-white"
    }, /*#__PURE__*/React.createElement(EmptyState, {
      icon: /*#__PURE__*/React.createElement(IconBriefcase, {
        size: 32
      }),
      title: t('timeline.noProjects'),
      description: isLoggedIn ? t('timeline.noProjectsDesc') : t('common.loginToCreate'),
      action: isLoggedIn ? {
        label: t('timeline.addProject'),
        onClick: () => setActiveTab('setup_proj')
      } : null
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex-1 flex h-full overflow-hidden bg-white"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-fit min-w-[10rem] max-w-[20rem] border-r border-slate-200 flex flex-col bg-slate-50 shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-b border-slate-200 bg-white"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-slate-900 text-lg font-medium"
  }, t('timeline.employees')), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500 mt-1"
  }, t('timeline.dragInstruction'))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-auto"
  }, activeEmpCategories.map(category => {
    const isCollapsed = collapsedCategories[category];
    const catEmps = activeEmpsByCategory.get(category) || [];
    return /*#__PURE__*/React.createElement("div", {
      key: category,
      className: "border-b border-slate-200 bg-slate-50/80"
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => toggleCategory(category),
      className: "p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors group"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 text-sm uppercase tracking-wider font-medium text-slate-700"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400 group-hover:text-gea-500 transition-colors"
    }, isCollapsed ? /*#__PURE__*/React.createElement(IconChevronRight, {
      size: 16
    }) : /*#__PURE__*/React.createElement(IconChevronDown, {
      size: 16
    })), category), /*#__PURE__*/React.createElement("span", {
      className: "text-xs bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 font-medium shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
    }, catEmps.length)), !isCollapsed && /*#__PURE__*/React.createElement("div", {
      className: "p-3 pt-0 space-y-2 bg-slate-50"
    }, catEmps.map(emp => /*#__PURE__*/React.createElement("div", {
      key: emp.id,
      draggable: true,
      onDragStart: e => e.dataTransfer.setData('empId', emp.id),
      className: "p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-gea-300 transition-colors flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "min-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-sm text-slate-900 font-medium truncate"
    }, emp.name))))));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 flex flex-col overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-b border-slate-200 bg-white flex justify-between items-center gap-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-slate-900 text-lg font-medium shrink-0"
  }, t('timeline.title')), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 flex-wrap"
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
        setTimeout(() => scrollToCurrentWeek(timelineScrollRef, timelineWeeks, TIMELINE_WEEK_W), 120);
      } else {
        scrollToCurrentWeek(timelineScrollRef, timelineWeeks, TIMELINE_WEEK_W);
      }
    },
    className: "px-3 py-1.5 bg-gea-100 text-gea-700 rounded-lg text-sm font-medium hover:bg-gea-200 transition-colors"
  }, t('btn.today'))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 ml-auto shrink-0"
  }, isDeleteMode && /*#__PURE__*/React.createElement("div", {
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
  }))), s.currentUser && /*#__PURE__*/React.createElement("div", {
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
      setIsDeleteMode(m => !m);
      setMenuOpen(false);
    },
    className: `w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${isDeleteMode ? 'text-rose-600' : 'text-slate-700'}`
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 14,
    className: `shrink-0 ${isDeleteMode ? 'text-rose-500' : 'text-slate-400'}`
  }), /*#__PURE__*/React.createElement("span", null, t('btn.deleteMode')), isDeleteMode && /*#__PURE__*/React.createElement("span", {
    className: "ml-auto w-2 h-2 rounded-full bg-rose-500 shrink-0"
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "h-0.5 bg-slate-100 shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full bg-gea-400 transition-all duration-150",
    style: {
      width: `${scrollInfo.progress * 100}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    ref: timelineScrollRef,
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
    className: "w-full border-collapse text-sm text-left"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-white z-20"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 border-b border-slate-200 sticky-col-divider w-[55rem] bg-slate-50 sticky top-0 left-0 z-30 text-slate-600 font-medium "
  }, t('timeline.colProject')), timelineWeeks.map(w => /*#__PURE__*/React.createElement("th", {
    key: w.id,
    ref: w.id === currentWeekStr ? currentWeekColRef : null,
    className: `p-2 border-b border-r min-w-[120px] text-center font-medium sticky top-0 z-20 ${w.id === currentWeekStr ? 'bg-gea-100 text-gea-800 border-b-2 border-b-gea-500 border-slate-200' : w.id < currentWeekStr ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`
  }, /*#__PURE__*/React.createElement("div", null, `${t('util.kw')} ${parseInt(w.id.split('-W')[1])}`), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-normal opacity-70"
  }, w.sub), w.holidays.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-[9px] font-semibold text-amber-600 leading-tight mt-0.5 truncate",
    title: w.holidays.join(' · ')
  }, w.holidays.join(' · ')))))), /*#__PURE__*/React.createElement("tbody", null, projects.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: timelineWeeks.length + 1,
    className: "p-8 text-center text-slate-400"
  }, t('timeline.noProjects'))) : activeProjCategories.map(category => {
    const isCollapsed = collapsedProjCategories[category];
    const catProjects = projectsByCategory.get(category) || [];
    if (catProjects.length === 0) return null;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: category
    }, /*#__PURE__*/React.createElement("tr", {
      className: "bg-slate-100 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors",
      onClick: () => toggleProjCategory(category)
    }, /*#__PURE__*/React.createElement("td", {
      className: "p-3 text-slate-900 sticky left-0 z-10 bg-slate-100 border-slate-200 sticky-col-divider font-medium "
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 text-lg"
    }, isCollapsed ? /*#__PURE__*/React.createElement(IconChevronRight, {
      size: 16
    }) : /*#__PURE__*/React.createElement(IconChevronDown, {
      size: 16
    }), category)), leftSpacerSpan > 0 && /*#__PURE__*/React.createElement("td", {
      colSpan: leftSpacerSpan,
      className: "border-r border-slate-200"
    }), visibleWeeks.map(w => /*#__PURE__*/React.createElement("td", {
      key: `header-${category}-${w.id}`,
      className: "border-r border-slate-200"
    })), rightSpacerSpan > 0 && /*#__PURE__*/React.createElement("td", {
      colSpan: rightSpacerSpan,
      className: "border-r border-slate-200"
    })), !isCollapsed && catProjects.map(proj => {
      const pColor = resolveProjectColor(proj.color);
      const cc = resolveCountryCode(proj.country);
      const numericSize = String(proj.size ?? '').replace(/[^\d.]/g, '');
      const projLabel = [proj.projType, numericSize, proj.name, cc !== '/' ? cc : ''].filter(Boolean).join(' ');
      return /*#__PURE__*/React.createElement("tr", {
        key: proj.id,
        className: "hover:bg-slate-50 transition-colors"
      }, /*#__PURE__*/React.createElement("td", {
        className: "p-3 border-b border-slate-200 sticky-col-divider bg-white sticky left-0 z-10 "
      }, /*#__PURE__*/React.createElement("div", {
        className: "min-w-0"
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-1.5 min-w-0"
      }, /*#__PURE__*/React.createElement("div", {
        className: `w-3 h-3 rounded-full shrink-0 ${pColor.dot}`
      }), /*#__PURE__*/React.createElement(Tooltip, {
        text: proj.notes || '',
        wrap: true,
        side: "bottom"
      }, /*#__PURE__*/React.createElement("button", _extends({
        onClick: () => {
          setSelectedProjectDetails(proj.id);
          setActiveTab('setup_proj');
        },
        className: "text-slate-900 font-medium text-left truncate hover:text-gea-700 hover:underline transition-colors"
      }, !proj.notes && {
        title: 'Projekt-Einstellungen öffnen'
      }), projLabel))), proj.sharepointLink && /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-1 mt-1"
      }, /*#__PURE__*/React.createElement("a", {
        href: proj.sharepointLink,
        target: "_blank",
        rel: "noopener noreferrer",
        onClick: e => e.stopPropagation(),
        className: "text-slate-400 hover:text-gea-600 transition-colors",
        title: "SharePoint \xF6ffnen"
      }, /*#__PURE__*/React.createElement(IconExternalLink, {
        size: 12
      }))))), leftSpacerSpan > 0 && /*#__PURE__*/React.createElement("td", {
        colSpan: leftSpacerSpan,
        className: "border-b border-r border-slate-300 bg-white"
      }), visibleWeeks.map(w => {
        const isProjectActive = w.id >= proj.startWeek && w.id <= proj.ibnWeek;
        const projAss = assignmentsByProjectWeek.get(proj.id + '\u0000' + w.id) || [];
        return /*#__PURE__*/React.createElement("td", {
          key: w.id,
          onDragOver: e => {
            if (!isDeleteMode) e.preventDefault();
          },
          onDrop: e => {
            if (!isDeleteMode) handleDrop(e, w.id, proj.id);
          },
          className: `p-1 border-b border-r border-slate-300 relative min-w-[120px] align-top transition-colors ${isProjectActive ? isDeleteMode ? 'bg-rose-50/20' : 'bg-white hover:bg-slate-50' : 'bg-slate-100 opacity-60'}`
        }, /*#__PURE__*/React.createElement("div", {
          className: "flex flex-col gap-1 min-h-[60px]"
        }, projAss.map(a => {
          const emp = employeeById.get(a.empId);
          const chipHours = a.hours ?? Math.round((a.percent ?? 100) / 100 * HOURS_PER_WEEK);
          const isTentative = chipHours === 0;
          return /*#__PURE__*/React.createElement("div", {
            key: a.id,
            draggable: !isDeleteMode,
            title: isTentative ? a.comment ? a.comment + ' · ' + t('resource.tentativeHours') : t('resource.tentativeHours') : a.comment || undefined,
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
                  empId: a.empId,
                  week: w.id,
                  existing: a
                });
                setIsAssignModalOpen(true);
              }
            },
            className: `text-[10px] px-1.5 py-1 rounded flex justify-between items-center shadow-sm transition-all group/chip ${isDeleteMode ? 'cursor-pointer hover:bg-rose-50 hover:border hover:border-rose-300 hover:text-rose-700 hover:line-through' : 'cursor-grab active:cursor-grabbing hover:opacity-90'} ${pColor.chip} ${isTentative ? 'bg-hatched' : ''}`
          }, /*#__PURE__*/React.createElement("span", {
            className: "truncate font-medium"
          }, emp?.name || t('resource.unknown')), a.comment && /*#__PURE__*/React.createElement(IconMessageSquare, {
            size: 10,
            className: "flex-shrink-0 ml-1 opacity-70"
          }), /*#__PURE__*/React.createElement("div", {
            className: "flex items-center gap-1 ml-1 flex-shrink-0"
          }, /*#__PURE__*/React.createElement("span", {
            className: "opacity-90 font-medium"
          }, chipHours, "h"), !isDeleteMode && /*#__PURE__*/React.createElement("button", {
            onClick: e => {
              e.stopPropagation();
              setCopyContext({
                assignment: a
              });
              setIsCopyModalOpen(true);
            },
            className: "opacity-0 group-hover/chip:opacity-100 text-slate-500 hover:text-gea-700 transition-opacity p-0.5 rounded",
            title: t('btn.copy')
          }, /*#__PURE__*/React.createElement(IconCopy, {
            size: 10
          }))));
        })));
      }), rightSpacerSpan > 0 && /*#__PURE__*/React.createElement("td", {
        colSpan: rightSpacerSpan,
        className: "border-b border-r border-slate-300 bg-white"
      }));
    }));
  }))))));
};