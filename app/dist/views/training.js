// TrainingView – shows all active employees; only training chips are rendered
// in the cells. Clicking an empty cell or dragging a chip opens the
// AssignmentModal restricted to type='training'.
const TrainingView = ({
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
  const WEEK_W = 140;
  const STICKY_W = 288;
  const scrollRef = React.useRef(null);
  const [scrollInfo, setScrollInfo] = React.useState({
    progress: 0,
    label: ''
  });
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
      const BUFFER = 8;
      const newStart = Math.max(0, firstIdx - BUFFER);
      const newEnd = Math.min(timelineWeeks.length - 1, lastIdx + BUFFER);
      setVisibleRange(prev => prev.start === newStart && prev.end === newEnd ? prev : {
        start: newStart,
        end: newEnd
      });
    });
  }, [timelineWeeks]);
  const scrollWeeks = n => scrollRef.current?.scrollBy({
    left: n * WEEK_W,
    behavior: 'smooth'
  });
  const currentWeek = getWeekString(new Date());
  const currentYear = new Date().getFullYear();
  const trainingWeeks = timelineWeeks;
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
  const compact = s.compactView;
  const setCompact = next => h.setCompactView(typeof next === 'function' ? next(s.compactView) : next);
  React.useEffect(() => {
    const timer = setTimeout(() => scrollToCurrentWeek(scrollRef, STICKY_W), 80);
    return () => clearTimeout(timer);
  }, []);
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
  const monthGroups = React.useMemo(() => {
    const groups = [];
    let cur = null;
    trainingWeeks.forEach(w => {
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
  }, [trainingWeeks]);
  const safeStart = Math.max(0, Math.min(visibleRange.start, trainingWeeks.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(visibleRange.end, trainingWeeks.length - 1));
  const visibleWeeks = React.useMemo(() => trainingWeeks.slice(safeStart, safeEnd + 1), [trainingWeeks, safeStart, safeEnd]);
  const leftSpacerSpan = safeStart;
  const rightSpacerSpan = Math.max(0, trainingWeeks.length - 1 - safeEnd);
  return /*#__PURE__*/React.createElement("div", {
    className: "flex-1 flex flex-col h-full bg-white overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-b border-slate-300 bg-gea-50 flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-gea-800 text-xl font-semibold shrink-0"
  }, t('training.title')), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => scrollWeeks(-4),
    className: "p-1.5 rounded-l bg-gea-100 text-gea-700 hover:bg-gea-200 transition-colors border-r border-gea-200",
    title: t('btn.weeks4back')
  }, /*#__PURE__*/React.createElement(IconChevronLeft, {
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    className: "px-2 text-xs text-slate-500 bg-gea-50 h-[30px] flex items-center min-w-[130px] justify-center border-y border-gea-100 font-mono tabular-nums"
  }, scrollInfo.label || '—'), /*#__PURE__*/React.createElement("button", {
    onClick: () => scrollWeeks(4),
    className: "p-1.5 rounded-r bg-gea-100 text-gea-700 hover:bg-gea-200 transition-colors border-l border-gea-200",
    title: t('btn.weeks4fwd')
  }, /*#__PURE__*/React.createElement(IconChevronRight, {
    size: 16
  }))), /*#__PURE__*/React.createElement("select", {
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
        setTimeout(() => scrollToCurrentWeek(scrollRef, 288), 120);
      } else {
        scrollToCurrentWeek(scrollRef, 288);
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
    ref: scrollRef,
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
    className: "sticky top-0 bg-white z-20 shadow-sm"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "border-b border-slate-200 w-72 bg-slate-50 sticky left-0 z-30 sticky-col-divider"
  }), monthGroups.map(g => /*#__PURE__*/React.createElement("th", {
    key: g.month,
    colSpan: g.count,
    className: "px-2 py-1 border-b border-r border-slate-200 text-center text-[11px] font-semibold text-gea-700 bg-gea-50/80 uppercase tracking-wide"
  }, g.month))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-4 border-b-2 border-slate-300 w-72 bg-slate-50 sticky left-0 z-30 text-slate-500 uppercase tracking-wider text-xs font-medium sticky-col-divider"
  }, t('resource.colEmployee')), trainingWeeks.map(w => {
    const isCurrent = w.id === currentWeek;
    const isPast = w.id < currentWeek;
    return /*#__PURE__*/React.createElement("th", {
      key: w.id,
      ref: isCurrent ? currentWeekColRef : null,
      className: `p-3 border-b-2 border-r border-slate-300 min-w-[140px] text-center font-medium ${isCurrent ? 'bg-gea-100 text-gea-800 border-b-gea-500' : isPast ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600'}`
    }, /*#__PURE__*/React.createElement("div", null, w.label), /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] font-normal opacity-70"
    }, w.sub), w.holidays.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "text-[9px] font-semibold text-amber-600 leading-tight mt-0.5 truncate",
      title: w.holidays.join(' · ')
    }, w.holidays.join(' · ')));
  }))), /*#__PURE__*/React.createElement("tbody", null, activeEmpCategories.map(category => {
    const isCollapsed = collapsedCategories[category];
    const catEmps = activeEmpsByCategory.get(category) || [];
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
        className: "p-3 border-b border-slate-300 bg-white sticky left-0 z-20 sticky-col-divider"
      }, /*#__PURE__*/React.createElement("div", {
        className: "text-slate-800 font-medium text-sm"
      }, emp.name)), leftSpacerSpan > 0 && /*#__PURE__*/React.createElement("td", {
        colSpan: leftSpacerSpan,
        className: "border-b border-r border-slate-300 bg-white"
      }), visibleWeeks.map(w => {
        const allWeekAss = assignmentsByEmpWeek.get(emp.id + ' ' + w.id) || [];
        const trainingAss = allWeekAss.filter(a => a.type === 'training');
        return /*#__PURE__*/React.createElement("td", {
          key: w.id,
          className: `p-1.5 border-b border-r border-slate-300 relative transition-colors group/cell ${isDeleteMode ? 'bg-rose-50/20' : 'cursor-pointer hover:bg-gea-50/30'} bg-white ${w.id === currentWeek ? 'bg-gea-50/50 border-l border-l-gea-300 border-r-gea-300' : ''} ${w.id < currentWeek ? 'opacity-60' : ''}`,
          onClick: () => {
            if (!isDeleteMode) {
              setAssignContext({
                empId: emp.id,
                week: w.id,
                defaultType: 'training'
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
        }, trainingAss.length === 0 && /*#__PURE__*/React.createElement("div", {
          className: "absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 text-gea-300 transition-opacity"
        }, /*#__PURE__*/React.createElement(IconPlus, {
          size: 20
        })), /*#__PURE__*/React.createElement("div", {
          className: `flex flex-col gap-1 relative z-10 ${compact ? 'min-h-[20px]' : 'min-h-[44px]'}`
        }, trainingAss.map(a => {
          const pct = Math.round((a.hours ?? (a.percent ?? 100) / 100 * empWH) / empWH * 100);
          return /*#__PURE__*/React.createElement("div", {
            key: a.id,
            draggable: !isDeleteMode,
            title: pct === 0 ? a.comment ? `${a.comment} · ${t('resource.tentative')}` : t('resource.tentative') : a.comment || undefined,
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
                  existing: a,
                  allowedType: 'training'
                });
                setIsAssignModalOpen(true);
              }
            },
            className: `text-[11px] rounded-md border flex justify-between items-stretch shadow-sm transition-all group/chip overflow-hidden ${isDeleteMode ? 'cursor-pointer hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 hover:line-through' : 'hover:shadow hover:-translate-y-0.5 cursor-grab active:cursor-grabbing'} bg-sky-50 border-sky-200 text-sky-800 ${pct === 0 ? 'bg-hatched' : ''}`
          }, /*#__PURE__*/React.createElement("div", {
            className: "flex items-center gap-1.5 min-w-0"
          }, /*#__PURE__*/React.createElement("div", {
            className: "w-1 flex-shrink-0 self-stretch bg-sky-500"
          }), /*#__PURE__*/React.createElement("span", {
            className: `truncate font-medium px-1 ${compact ? 'py-0.5' : 'py-1.5'}`
          }, a.reference), a.comment && /*#__PURE__*/React.createElement(IconMessageSquare, {
            size: 9,
            className: "flex-shrink-0 opacity-60"
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
        }), !compact && trainingAss.length > 0 && /*#__PURE__*/React.createElement("div", {
          onClick: e => {
            e.stopPropagation();
            setAssignContext({
              empId: emp.id,
              week: w.id,
              defaultType: 'training',
              allowedType: 'training'
            });
            setIsAssignModalOpen(true);
          },
          className: "opacity-0 group-hover/cell:opacity-100 text-[10px] px-2 py-1.5 rounded-md border border-dashed border-gea-300 text-gea-600 flex justify-center items-center shadow-sm hover:bg-gea-50 transition-all mt-0.5"
        }, /*#__PURE__*/React.createElement(IconPlus, {
          size: 12,
          className: "mr-1"
        }), " ", t('resource.more'))));
      }), rightSpacerSpan > 0 && /*#__PURE__*/React.createElement("td", {
        colSpan: rightSpacerSpan,
        className: "border-b border-r border-slate-300 bg-white"
      }));
    }));
  })))));
};