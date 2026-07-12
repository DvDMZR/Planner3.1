const UtilizationView = ({ s, h }) => {
    const { activeTab, employees, projects, assignments, expenses, costItems,
        empCategories, projCategories, basicTasks, basicTasksMeta,
        inactiveBasicTasks, basicTasksSubTab, offtimeTasks, inactiveOfftimeTasks,
        inactiveSupportTasks, inactiveTrainingTasks, isChangelogOpen,
        weeks, selectedProject, collapsedCategories, collapsedProjCategories,
        collapsedEmpSetup, selectedProjectDetails, weeksAhead,
        isAssignModalOpen, assignContext, isCostItemModalOpen, editingCostItem,
        isCopyModalOpen, copyContext, isDeleteMode, pastProjectsExpanded,
        isInvoiceModalOpen, invoiceSelection, invoiceRecipient, isProjFormOpen,
        isHelpModalOpen, timelineYear, empForm, editingEmpId, projForm,
        editingProjectId, newEmpCat, newProjCat, newBasicTask, newOfftimeTask,
        expandedSetupCats, syncStatus, fsStatus,
        employeeById, projectById, assignmentsByEmpWeek, assignmentsByProject,
        assignmentsByProjectWeek, costItemsByProject, projectStatusById,
        activeEmployees, activeEmpsByCategory, activeEmpCategories,
        projectsByCategory, projCategoriesFromProjects, timelineWeeks,
        currentWeekColRef, resourceScrollRef, timelineScrollRef,
        t } = s;
    const { setActiveTab, setEmployees, setProjects, setAssignments,
        setCostItems, setEmpCategories, setProjCategories, setBasicTasks,
        setBasicTasksMeta, setInactiveBasicTasks, setBasicTasksSubTab,
        setOfftimeTasks, setInactiveOfftimeTasks, setInactiveSupportTasks,
        setInactiveTrainingTasks, setIsChangelogOpen, setSelectedProject,
        setCollapsedCategories, setCollapsedProjCategories, setCollapsedEmpSetup,
        setSelectedProjectDetails, setWeeksAhead, setIsAssignModalOpen,
        setAssignContext, setIsCostItemModalOpen, setEditingCostItem,
        setIsCopyModalOpen, setCopyContext, setIsDeleteMode, setPastProjectsExpanded,
        setIsInvoiceModalOpen, setInvoiceSelection, setInvoiceRecipient,
        setIsProjFormOpen, setIsHelpModalOpen, setTimelineYear, setEmpForm,
        setEditingEmpId, setProjForm, setEditingProjectId, setNewEmpCat,
        setNewProjCat, setNewBasicTask, setNewOfftimeTask, setExpandedSetupCats,
        setSyncStatus, setFsStatus,
        getEmpWeeklyHours, computeAutoStatus, getWeeksForYear, getUtilization,
        toggleCategory, toggleProjCategory, toggleEmpSetup,
        handleSaveAssignment, handleDeleteAssignment, handleDeleteAssignmentSeries,
        handleDrop, exportData, importData, buildInvoiceData, openInvoiceModal,
        downloadCsv,
        scrollToCurrentWeek } = h;
        const visibleWeeks = React.useMemo(
            () => weeks.slice(0, weeksAhead),
            [weeks, weeksAhead]
        );

        const { months, weeksByMonth } = React.useMemo(() => {
            const months = [];
            const weeksByMonth = {};
            visibleWeeks.forEach(w => {
                if (!weeksByMonth[w.month]) {
                    weeksByMonth[w.month] = [];
                    months.push(w.month);
                }
                weeksByMonth[w.month].push(w.id);
            });
            return { months, weeksByMonth };
        }, [visibleWeeks]);

        // Pre-compute the whole utilization matrix in one pass per employee
        // so the JSX below only does Map lookups. Without this we'd call
        // getUtilization() once for the avgAll loop and again per month —
        // double work that scales with employees × weeks.
        const utilByEmp = React.useMemo(() => {
            const result = new Map();
            activeEmployees.forEach(emp => {
                let totalAll = 0;
                let maxWeekAll = 0; // peak single-week utilization across the period
                const perMonth = {};
                visibleWeeks.forEach(w => {
                    const { total, isOfftime } = getUtilization(emp.id, w.id);
                    totalAll += total;
                    if (total > maxWeekAll) maxWeekAll = total;
                    let bucket = perMonth[w.month];
                    if (!bucket) {
                        bucket = { total: 0, count: 0, hasOfftime: false, maxWeek: 0 };
                        perMonth[w.month] = bucket;
                    }
                    bucket.total += total;
                    bucket.count += 1;
                    if (isOfftime) bucket.hasOfftime = true;
                    if (total > bucket.maxWeek) bucket.maxWeek = total;
                });
                const avgAll = visibleWeeks.length === 0 ? 0 : Math.round(totalAll / visibleWeeks.length);
                const monthAvgs = {};
                for (const m of Object.keys(perMonth)) {
                    const b = perMonth[m];
                    monthAvgs[m] = {
                        avg: b.count === 0 ? 0 : Math.round(b.total / b.count),
                        hasOfftime: b.hasOfftime,
                        maxWeek: b.maxWeek
                    };
                }
                result.set(emp.id, { avgAll, monthAvgs, maxWeekAll });
            });
            return result;
        }, [activeEmployees, visibleWeeks, getUtilization]);

        // Returns the overload indicator for a single peak-week value:
        //   >=200% → red 💢, >=150% → orange 💢, otherwise null.
        const overloadIndicator = (maxPct) => {
            if (maxPct >= 200) return { emoji: '💢', tone: 'text-rose-600', title: t('util.peakDouble', { pct: maxPct }) };
            if (maxPct >= 150) return { emoji: '💢', tone: 'text-amber-500', title: t('util.peakOver', { pct: maxPct }) };
            return null;
        };

        // Mitarbeiter-Suche (kommagetrennte Begriffe wie im Ressourcen-Reiter)
        const [empSearch, setEmpSearch] = React.useState('');
        const searchTerms = React.useMemo(
            () => empSearch.split(',').map(x => x.trim().toLowerCase()).filter(Boolean),
            [empSearch]);
        const matchesEmpSearch = (e) =>
            searchTerms.length === 0 || searchTerms.some(q => (e.name || '').toLowerCase().includes(q));

        const activeCategories = activeEmpCategories;

        return (
            <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl text-slate-900 font-medium">{t('util.title')}</h2>
                        <p className="text-sm text-slate-500">{t('util.subtitle')}</p>
                    </div>
                    <div className="flex gap-3 items-center">
                    <button onClick={() => {
                        const rowsCsv = [[t('resource.colEmployee'), 'Team', 'Ø', ...months]];
                        activeCategories.forEach(category => {
                            (activeEmpsByCategory.get(category) || []).filter(matchesEmpSearch).forEach(emp => {
                                const u = utilByEmp.get(emp.id);
                                if (!u) return;
                                rowsCsv.push([emp.name, category, `${u.avgAll}%`,
                                    ...months.map(m => u.monthAvgs[m] ? `${u.monthAvgs[m].avg}%` : '')]);
                            });
                        });
                        downloadCsv(`Auslastung_${new Date().toISOString().slice(0,10)}.csv`, rowsCsv);
                    }}
                        className="text-xs px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-gea-400 hover:text-gea-600 transition-colors font-medium shrink-0">
                        {t('btn.exportCsv')}
                    </button>
                    <div className="relative">
                        <IconUsers size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        <input type="text" value={empSearch}
                            onChange={e => setEmpSearch(e.target.value)}
                            placeholder={t('resource.empSearch')}
                            className="pl-7 pr-7 py-2 border border-slate-300 rounded text-sm bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-gea-400 w-44"/>
                        {empSearch && (
                            <button onClick={() => setEmpSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><IconX size={12}/></button>
                        )}
                    </div>
                    <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-sm text-slate-700 font-medium">{t('util.preview')}</span>
                        <select value={weeksAhead} onChange={e=>setWeeksAhead(Number(e.target.value))} className="p-2 border border-slate-300 rounded text-sm bg-white">
                            <option value={4}>{t('util.weeks4')}</option>
                            <option value={8}>{t('util.weeks8')}</option>
                            <option value={12}>{t('util.weeks12')}</option>
                            <option value={24}>{t('util.weeks24')}</option>
                            <option value={52}>{t('util.weeks52')}</option>
                        </select>
                    </div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto px-6 pb-6">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr>
                                <th className="p-2 border-b-2 border-slate-300 text-left w-48 text-slate-500 font-medium sticky top-0 z-20 bg-white">{t('util.colEmployee')}</th>
                                <th className="p-2 border-b-2 border-slate-300 text-center w-32 text-gea-600 bg-gea-50 font-medium sticky top-0 z-20">{t('util.colAvg')}</th>
                                {months.map(m => {
                                    const firstWeek = weeksByMonth[m]?.[0];
                                    const jumpToMonth = () => {
                                        if (!firstWeek) return;
                                        const yr = parseInt(firstWeek.split('-W')[0], 10);
                                        if (!Number.isNaN(yr)) setTimelineYear(yr);
                                        h.setScrollTarget({ weekId: firstWeek, clearEmpFilter: true });
                                        setActiveTab('resource');
                                    };
                                    return (
                                        <th key={m}
                                            onClick={firstWeek ? jumpToMonth : undefined}
                                            title={firstWeek ? t('util.navigateTo', { month: m }) : undefined}
                                            className={`p-2 border-b-2 border-slate-300 text-center text-slate-500 font-medium sticky top-0 z-20 bg-white ${firstWeek ? 'cursor-pointer hover:text-gea-700 hover:bg-slate-50' : ''}`}>
                                            {m}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {activeCategories.map(category => {
                                const isCollapsed = searchTerms.length > 0 ? false : collapsedCategories[category];
                                const catEmps = (activeEmpsByCategory.get(category) || []).filter(matchesEmpSearch);
                                if (searchTerms.length > 0 && catEmps.length === 0) return null;

                                return (
                                    <React.Fragment key={category}>
                                        <tr className="bg-slate-200/70 border-t-2 border-b border-slate-300 cursor-pointer hover:bg-slate-300/50 transition-colors group" onClick={() => toggleCategory(category)}>
                                            <td className="p-3 text-slate-700 sticky left-0 z-10 bg-inherit border-r border-l-4 border-l-gea-500 border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                                                <div className="flex items-center gap-2 text-sm uppercase tracking-wider font-medium">
                                                    <span className="text-slate-400 group-hover:text-gea-500 transition-colors">
                                                        {isCollapsed ? <IconChevronRight size={16}/> : <IconChevronDown size={16}/>}
                                                    </span>
                                                    {category}
                                                    <span className="ml-auto text-xs bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 font-medium">
                                                        {catEmps.length}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="border-b border-slate-300 bg-slate-200/70"></td>
                                            {months.map(m => <td key={`header-${category}-${m}`} className="border-b border-slate-300 bg-slate-200/70"></td>)}
                                        </tr>

                                        {!isCollapsed && catEmps.map(emp => {
                                            const empUtil = utilByEmp.get(emp.id);
                                            const avgAll = empUtil?.avgAll ?? 0;
                                            const monthAvgs = empUtil?.monthAvgs ?? {};

                                            const jumpToEmp = (weekId) => {
                                                if (weekId) {
                                                    const yr = parseInt(weekId.split('-W')[0], 10);
                                                    if (!Number.isNaN(yr)) setTimelineYear(yr);
                                                }
                                                h.setScrollTarget({ weekId, empName: emp.name });
                                                setActiveTab('resource');
                                            };

                                            return (
                                                <tr key={emp.id} className="border-b border-slate-300 hover:bg-slate-50 transition-colors">
                                                    <td onClick={() => jumpToEmp(null)}
                                                        title={t('util.filterBy', { name: emp.name })}
                                                        className="p-2 text-slate-900 font-medium pl-6 cursor-pointer hover:text-gea-700">
                                                        {emp.name}
                                                    </td>

                                                    <td onClick={() => jumpToEmp(null)}
                                                        title={t('util.filterBy', { name: emp.name })}
                                                        className="p-2 border-r border-slate-300 cursor-pointer">
                                                        <div className="w-full h-8 rounded flex items-center justify-center gap-1 text-xs bg-gea-50 text-gea-700 border border-gea-100 font-medium hover:ring-2 hover:ring-gea-400 hover:ring-offset-1 transition-all">
                                                            <span>{avgAll}%</span>
                                                            {(() => {
                                                                const o = overloadIndicator(empUtil?.maxWeekAll ?? 0);
                                                                return o ? <span className={o.tone} title={o.title}>{o.emoji}</span> : null;
                                                            })()}
                                                        </div>
                                                    </td>

                                                    {months.map(m => {
                                                        const cell = monthAvgs[m];
                                                        const avgMonth = cell?.avg ?? 0;
                                                        const hasOfftime = cell?.hasOfftime ?? false;
                                                        const maxWeek = cell?.maxWeek ?? 0;

                                                        let bgColor = 'bg-slate-50';
                                                        let textColor = 'text-slate-400';

                                                        if (avgMonth === 0 && hasOfftime) { bgColor = 'bg-slate-200'; textColor = 'text-slate-600'; }
                                                        else if (avgMonth >= 100) { bgColor = 'bg-rose-500'; textColor = 'text-white'; }
                                                        else if (avgMonth >= 80) { bgColor = 'bg-amber-400'; textColor = 'text-white'; }
                                                        else if (avgMonth > 0) { bgColor = 'bg-emerald-500'; textColor = 'text-white'; }

                                                        const label = avgMonth > 0 ? `${avgMonth}%` : (hasOfftime ? 'OFF' : '-');
                                                        const firstWeek = weeksByMonth[m]?.[0];
                                                        const jump = () => {
                                                            if (!firstWeek) return;
                                                            jumpToEmp(firstWeek);
                                                        };
                                                        const overload = overloadIndicator(maxWeek);
                                                        const cellTitle = overload
                                                            ? `${overload.title}${firstWeek ? ' · ' + t('util.navigateFilter', { name: emp.name, month: m }) : ''}`
                                                            : (firstWeek ? t('util.navigateFilter', { name: emp.name, month: m }) : undefined);

                                                        return (
                                                            <td key={m} className="p-1 border-r border-slate-300 last:border-0">
                                                                <div
                                                                    onClick={jump}
                                                                    title={cellTitle}
                                                                    className={`w-full h-8 rounded flex items-center justify-center gap-1 text-xs transition-all ${bgColor} ${textColor} ${hasOfftime && avgMonth === 0 ? 'diagonal-stripes' : ''} ${firstWeek ? 'cursor-pointer hover:ring-2 hover:ring-gea-400 hover:ring-offset-1' : ''} font-medium`}>
                                                                    <span>{label}</span>
                                                                    {overload && <span className={overload.tone}>{overload.emoji}</span>}
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                            )
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
