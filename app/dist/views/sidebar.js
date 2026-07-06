const _SidebarBase = ({
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
    supportEmpsByCategory,
    supportEmpCategories,
    hasSupportEmployees,
    projectsByCategory,
    projCategoriesFromProjects,
    timelineWeeks,
    currentWeekColRef,
    resourceScrollRef,
    timelineScrollRef,
    currentUser,
    appUsers,
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
    reconnectSharePoint,
    loginUser,
    logoutUser,
    setIsLoginModalOpen,
    requestConfirm,
    setLanguage,
    setIsCommandPaletteOpen
  } = h;
  const isActive = !!currentUser;
  const isAdmin = currentUser?.role === 'admin';

  // Verwaltung group: collapsible, persisted, auto-expand when navigating to a Verwaltung tab
  const VERWALTUNG_TABS = ['setup_emp', 'setup_proj', 'setup_cats', 'data', 'audit'];
  const [verwaltungOpen, setVerwaltungOpen] = React.useState(() => {
    try {
      const stored = localStorage.getItem('sidebar.verwaltungOpen');
      if (stored !== null) return stored === 'true';
    } catch (e) {}
    return currentUser?.role === 'admin';
  });
  React.useEffect(() => {
    try {
      localStorage.setItem('sidebar.verwaltungOpen', String(verwaltungOpen));
    } catch (e) {}
  }, [verwaltungOpen]);
  React.useEffect(() => {
    if (VERWALTUNG_TABS.includes(activeTab) && !verwaltungOpen) setVerwaltungOpen(true);
  }, [activeTab]);

  // Helper: locked tab button for passive users — same brightness as normal, lock icon signals restriction
  const lockedTabBtn = (label, icon) => /*#__PURE__*/React.createElement("div", {
    className: "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gea-300 cursor-not-allowed select-none"
  }, icon, " ", label, /*#__PURE__*/React.createElement(IconLock, {
    size: 13,
    className: "ml-auto shrink-0 text-gea-500"
  }));

  // Helper: normal tab button
  const tabBtn = (tab, label, icon, onClick) => /*#__PURE__*/React.createElement("button", {
    onClick: onClick || (() => {
      setActiveTab(tab);
      setSelectedProjectDetails(null);
    }),
    className: `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors font-medium ${activeTab === tab ? 'bg-gea-600 text-white shadow-sm' : 'text-gea-300 hover:bg-gea-800 hover:text-white'}`
  }, icon, " ", label);

  // DE/EN-Umschalter – identisch für ein-/ausgeloggten Zustand
  const langSwitcher = /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-0.5 shrink-0"
  }, ['de', 'en'].map(lng => /*#__PURE__*/React.createElement("button", {
    key: lng,
    onClick: () => setLanguage(lng),
    className: `px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${language === lng ? 'bg-gea-600 text-white' : 'text-gea-500 hover:text-gea-300'}`
  }, lng.toUpperCase())));
  return /*#__PURE__*/React.createElement("aside", {
    className: "w-60 bg-gea-900 text-gea-100 flex flex-col h-full shrink-0 shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-6 py-5 flex items-center gap-3 border-b border-gea-700"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-gea-500 text-white p-2 rounded-lg shadow-sm"
  }, /*#__PURE__*/React.createElement(IconBriefcase, {
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "text-white text-base tracking-tight font-bold uppercase"
  }, "GEA"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setIsChangelogOpen(true),
    className: "flex items-center gap-1.5 text-gea-300 hover:text-white transition-colors group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-medium"
  }, t('nav.appTitle')), /*#__PURE__*/React.createElement("span", {
    className: "changelog-glow bg-gea-700 group-hover:bg-gea-600 text-gea-300 group-hover:text-white text-xs px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
  }, /*#__PURE__*/React.createElement(IconHistory, {
    size: 12
  }), " ", APP_VERSION))))), /*#__PURE__*/React.createElement("nav", {
    className: "flex-1 py-4 space-y-0.5 px-3 overflow-y-auto"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setIsCommandPaletteOpen(true),
    className: "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gea-400 border border-gea-700 hover:bg-gea-800 hover:text-white hover:border-gea-600 transition-colors"
  }, /*#__PURE__*/React.createElement(IconSearch, {
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    className: "flex-1 text-left"
  }, t('cmdk.sidebarHint')), /*#__PURE__*/React.createElement("kbd", {
    className: "text-[10px] border border-gea-600 rounded px-1.5 py-0.5 text-gea-500"
  }, "\u2318K")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-gea-500 uppercase tracking-wider mb-2 px-3 mt-4 font-semibold"
  }, t('nav.section.planning')), tabBtn('resource', t('nav.resources'), /*#__PURE__*/React.createElement(IconUsers, {
    size: 18
  })), tabBtn('project', t('nav.projects'), /*#__PURE__*/React.createElement(IconGanttChart, {
    size: 18
  }), () => {
    setActiveTab('project');
    setSelectedProject(projects[0]);
    setSelectedProjectDetails(null);
  }), /*#__PURE__*/React.createElement("div", {
    className: "px-3 pt-3 pb-1 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1 h-px",
    style: {
      background: 'rgba(255,255,255,0.10)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-gea-600 uppercase tracking-wider font-semibold"
  }, t('nav.section.specialPlanning')), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 h-px",
    style: {
      background: 'rgba(255,255,255,0.10)'
    }
  })), tabBtn('support', t('nav.support'), /*#__PURE__*/React.createElement(IconLifebuoy, {
    size: 18
  })), tabBtn('offtime', t('nav.absences'), /*#__PURE__*/React.createElement(IconCalendar, {
    size: 18
  })), tabBtn('training', t('nav.trainings'), /*#__PURE__*/React.createElement(IconBookOpen, {
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "px-3 pt-3 pb-1 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1 h-px",
    style: {
      background: 'rgba(255,255,255,0.10)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-gea-600 uppercase tracking-wider font-semibold"
  }, t('nav.section.analysis')), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 h-px",
    style: {
      background: 'rgba(255,255,255,0.10)'
    }
  })), isActive ? tabBtn('utilization', t('nav.utilization'), /*#__PURE__*/React.createElement(IconBarChart, {
    size: 18
  })) : lockedTabBtn(t('nav.utilization'), /*#__PURE__*/React.createElement(IconBarChart, {
    size: 18
  })), isActive ? tabBtn('overview', t('nav.overview'), /*#__PURE__*/React.createElement(IconTable, {
    size: 18
  })) : lockedTabBtn(t('nav.overview'), /*#__PURE__*/React.createElement(IconTable, {
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setVerwaltungOpen(o => !o),
    className: "w-full flex items-center justify-between text-xs text-gea-500 uppercase tracking-wider mb-2 px-3 mt-8 font-semibold hover:text-gea-300 transition-colors"
  }, /*#__PURE__*/React.createElement("span", null, t('nav.section.admin')), verwaltungOpen ? /*#__PURE__*/React.createElement(IconChevronDown, {
    size: 14
  }) : /*#__PURE__*/React.createElement(IconChevronRight, {
    size: 14
  })), verwaltungOpen && (isActive ? /*#__PURE__*/React.createElement(React.Fragment, null, tabBtn('setup_emp', t('nav.employees'), /*#__PURE__*/React.createElement(IconUser, {
    size: 18
  })), tabBtn('setup_proj', t('nav.projects'), /*#__PURE__*/React.createElement(IconBriefcase, {
    size: 18
  })), tabBtn('setup_cats', t('nav.categories'), /*#__PURE__*/React.createElement(IconTag, {
    size: 18
  })), tabBtn('data', t('nav.systemExport'), /*#__PURE__*/React.createElement(IconSettings, {
    size: 18
  })), tabBtn('audit', t('nav.history'), /*#__PURE__*/React.createElement(IconHistory, {
    size: 18
  }))) : /*#__PURE__*/React.createElement(React.Fragment, null, lockedTabBtn(t('nav.employees'), /*#__PURE__*/React.createElement(IconUser, {
    size: 18
  })), lockedTabBtn(t('nav.projects'), /*#__PURE__*/React.createElement(IconBriefcase, {
    size: 18
  })), lockedTabBtn(t('nav.categories'), /*#__PURE__*/React.createElement(IconTag, {
    size: 18
  })), lockedTabBtn(t('nav.systemExport'), /*#__PURE__*/React.createElement(IconSettings, {
    size: 18
  })), lockedTabBtn(t('nav.history'), /*#__PURE__*/React.createElement(IconHistory, {
    size: 18
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-3 border-t border-gea-700 shrink-0"
  }, isActive ? /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: `w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isAdmin ? 'bg-gea-500 text-white' : 'bg-gea-700 text-gea-200'}`
  }, currentUser.name.slice(0, 2).toUpperCase()), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-gea-200 text-xs font-medium truncate block"
  }, currentUser.name), /*#__PURE__*/React.createElement("span", {
    className: "text-gea-500 text-xs"
  }, isAdmin ? t('auth.administrator') : t('auth.activeUser'))), langSwitcher, /*#__PURE__*/React.createElement(Tooltip, {
    text: t('auth.logout'),
    side: "top"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => requestConfirm({
      title: t('auth.logoutTitle'),
      message: t('auth.logoutMsg'),
      confirmLabel: t('auth.logout'),
      onConfirm: logoutUser
    }),
    className: "text-gea-400 hover:text-white p-1 rounded hover:bg-gea-700 transition-colors shrink-0"
  }, /*#__PURE__*/React.createElement(IconLogOut, {
    size: 15
  })))) : /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setIsLoginModalOpen(true),
    className: "flex-1 flex items-center gap-2 text-gea-400 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-gea-800 transition-colors"
  }, /*#__PURE__*/React.createElement(IconLogIn, {
    size: 15
  }), " ", t('auth.login')), langSwitcher)), (SP_CONTEXT || fsStatus === 'connected') && /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-3 border-t border-gea-700 flex items-center gap-2 shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: `w-2 h-2 rounded-full shrink-0 ${syncStatus === 'idle' ? 'bg-emerald-400' : syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : syncStatus === 'updated' ? 'bg-blue-400' : syncStatus === 'conflict-reload' ? 'bg-orange-400' : syncStatus === 'reconnecting' ? 'bg-amber-400 animate-pulse' : syncStatus === 'needs-auth' ? 'bg-rose-500' : syncStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'}`
  }), syncStatus === 'needs-auth' ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: reconnectSharePoint,
    className: "text-rose-300 hover:text-rose-200 text-xs truncate underline decoration-dotted",
    title: t('sync.sessionExpiredTitle')
  }, t('sync.sessionExpired')) : /*#__PURE__*/React.createElement("span", {
    className: "text-gea-400 text-xs truncate"
  }, syncStatus === 'idle' ? t('sync.idle') : syncStatus === 'syncing' ? t('sync.syncing') : syncStatus === 'updated' ? t('sync.updated') : syncStatus === 'conflict-reload' ? t('sync.conflictReload') : syncStatus === 'reconnecting' ? t('sync.reconnecting') : syncStatus === 'offline' ? t('sync.offline') : t('sync.connecting'))));
};

// Only re-render when sidebar-visible state actually changes (not on every
// background poll that touches employees/projects/assignments).
const SidebarView = React.memo(_SidebarBase, (prev, next) => prev.s.activeTab === next.s.activeTab && prev.s.syncStatus === next.s.syncStatus && prev.s.fsStatus === next.s.fsStatus && prev.s.projects === next.s.projects &&
// needed for onClick: setSelectedProject(projects[0])
prev.s.currentUser === next.s.currentUser &&
// login/logout
prev.s.language === next.s.language // language toggle
);