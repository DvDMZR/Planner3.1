// STATUS_ORDER lives in config.js
const OverviewView = ({ s, h }) => {
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
        scrollToCurrentWeek, scrollToWeekById, openNewProjectForm } = h;
        const fmt = n => n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        const currentWeekStr = getWeekString(new Date());
        const activeEmps = activeEmployees;
        const activeProjects = React.useMemo(
            () => projects.filter(p => computeAutoStatus(p) === 'active').length,
            [projects, computeAutoStatus]
        );
        const { avgUtil, overbookedCount } = React.useMemo(() => {
            const utils = activeEmps.map(e => getUtilization(e.id, currentWeekStr).total);
            const avg = activeEmps.length > 0 ? Math.round(utils.reduce((a, b) => a + b, 0) / activeEmps.length) : 0;
            return { avgUtil: avg, overbookedCount: utils.filter(u => u > 100).length };
        }, [activeEmps, getUtilization, currentWeekStr]);

        // Auslastungsverlauf der letzten 8 Wochen (Ø über alle aktiven MA je
        // Woche) – dieselbe Formel wie avgUtil oben, nur pro Woche wiederholt.
        const utilTrend = React.useMemo(() => {
            const out = [];
            for (let i = 7; i >= 0; i--) {
                const week = addWeeks(currentWeekStr, -i);
                const utils = activeEmps.map(e => getUtilization(e.id, week).total);
                const avg = activeEmps.length > 0 ? Math.round(utils.reduce((a, b) => a + b, 0) / activeEmps.length) : 0;
                out.push({ week, avg });
            }
            return out;
        }, [activeEmps, getUtilization, currentWeekStr]);
        const jumpToWeek = (week) => {
            setActiveTab('resource');
            setTimeout(() => scrollToWeekById(resourceScrollRef, timelineWeeks, week, 140), 120);
        };

        // Fälligkeiten: abgeleitete Aufgaben (fehlende Kosten, alte
        // Reisekosten, überfällige IBN) – Logik in app/todos.js.
        const [todosCollapsed, setTodosCollapsed] = React.useState(false);
        const todos = React.useMemo(() => buildTodos({
            projects, computeAutoStatus, costItems, employees,
            currentWeek: currentWeekStr,
        }), [projects, computeAutoStatus, costItems, employees, currentWeekStr]);
        const todoLabel = (td) => {
            switch (td.kind) {
                case 'missing_costs': return t('todos.missingCosts', { name: td.name });
                case 'overdue_ibn':   return t('todos.overdueIbn', { name: td.name, week: formatKW(td.week) });
                default:              return t('todos.staleTravel', { emp: td.empName, amount: td.amount.toFixed(2), week: formatKW(td.week) });
            }
        };
        const todoJump = (td) => {
            if (td.kind === 'stale_travel') { setActiveTab('travel'); return; }
            setSelectedProjectDetails(td.projectId);
            setActiveTab('setup_proj');
        };

        const rows = React.useMemo(() => projects.filter(p => ['active', 'planned'].includes(computeAutoStatus(p))).map(p => {
            const projAss = assignmentsByProject.get(p.id) || [];
            let totalHours = 0, totalLaborCost = 0;
            for (let i = 0; i < projAss.length; i++) {
                const a = projAss[i];
                if (a.type !== 'project') continue;
                const h = a.hours ?? ((a.percent ?? 100) / 100 * HOURS_PER_WEEK);
                totalHours += h;
                if (p.billable !== false) totalLaborCost += h * (p.hourlyRate ?? DEFAULT_HOURLY_RATE);
            }
            const projCosts = costItemsByProject.get(p.id) || [];
            let zusatzkosten = 0;
            for (let i = 0; i < projCosts.length; i++) zusatzkosten += projCosts[i].amount || 0;
            return { p, totalHours, totalLaborCost, zusatzkosten, gesamtkosten: totalLaborCost + zusatzkosten };
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

        return (
            <div className="flex-1 overflow-auto p-8 bg-slate-50">
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white border border-slate-300 border-l-4 border-l-gea-500 rounded-xl p-5 shadow-md">
                            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">{t('overview.activeProjects')}</p>
                            <p className="text-3xl font-bold text-gea-700 mt-1">{activeProjects}</p>
                            <p className="text-xs text-slate-500 mt-1">{t('overview.ofTotal', { n: projects.length })}</p>
                        </div>
                        <div className="bg-white border border-slate-300 border-l-4 border-l-gea-400 rounded-xl p-5 shadow-md">
                            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">{t('overview.employees')}</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">{activeEmps.length}</p>
                            <p className="text-xs text-slate-500 mt-1">{t('overview.activeLabel')}</p>
                        </div>
                        <div className={`bg-white border border-l-4 rounded-xl p-5 shadow-md cursor-pointer hover:shadow-lg transition-shadow ${avgUtil >= 100 ? 'border-rose-300 border-l-rose-500' : avgUtil >= 80 ? 'border-amber-300 border-l-amber-500' : 'border-slate-300 border-l-emerald-500'}`}
                            onClick={() => { setActiveTab('resource'); setTimeout(() => scrollToCurrentWeek(resourceScrollRef, timelineWeeks, 140), 120); }}
                            title={t('overview.toResource')}>
                            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">{t('overview.avgUtil')} →</p>
                            <p className={`text-3xl font-bold mt-1 ${avgUtil >= 100 ? 'text-rose-600' : avgUtil >= 80 ? 'text-amber-600' : 'text-emerald-600'}`}>{avgUtil}%</p>
                            <p className="text-xs text-slate-500 mt-1">{currentWeekStr}</p>
                        </div>
                        <div className={`bg-white border border-l-4 rounded-xl p-5 shadow-md cursor-pointer hover:shadow-lg transition-shadow ${overbookedCount > 0 ? 'border-rose-300 border-l-rose-500' : 'border-slate-300 border-l-slate-400'}`}
                            onClick={() => { setActiveTab('resource'); setTimeout(() => scrollToCurrentWeek(resourceScrollRef, timelineWeeks, 140), 120); }}
                            title={t('overview.toResource')}>
                            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">{t('overview.overloaded')} →</p>
                            <p className={`text-3xl font-bold mt-1 ${overbookedCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{overbookedCount}</p>
                            <p className="text-xs text-slate-500 mt-1">{overbookedCount > 0 ? t('overview.overloadedCount') : t('overview.allOk')}</p>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-300 rounded-xl shadow-md overflow-hidden">
                        <button onClick={() => setTodosCollapsed(c => !c)}
                            className="w-full px-5 py-4 flex items-center gap-2 text-left hover:bg-slate-50 transition-colors">
                            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">{t('todos.title')}</p>
                            {todos.length > 0 ? (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-semibold tabular-nums">{todos.length}</span>
                            ) : (
                                <span className="text-xs text-emerald-600 font-medium">✓ {t('todos.allDone')}</span>
                            )}
                            <span className="ml-auto text-slate-400 text-xs">{todosCollapsed ? '▸' : '▾'}</span>
                        </button>
                        {!todosCollapsed && todos.length > 0 && (
                            <div className="border-t border-slate-100 divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                {todos.map((td, i) => {
                                    const dot = td.kind === 'missing_costs' ? 'bg-rose-500'
                                              : td.kind === 'stale_travel'  ? 'bg-amber-500'
                                              :                               'bg-sky-500';
                                    return (
                                        <button key={`${td.kind}-${td.projectId || td.costItemId || i}`}
                                            onClick={() => todoJump(td)}
                                            className="w-full flex items-center gap-2.5 px-5 py-2.5 text-sm text-left text-slate-700 hover:bg-gea-50/50 transition-colors">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`}/>
                                            <span className="flex-1 min-w-0 truncate">{todoLabel(td)}</span>
                                            <span className="text-slate-400 text-xs shrink-0">→</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">{t('overview.utilTrend')}</p>
                            <span className="text-xs text-slate-400">{t('overview.utilTrendHint')}</span>
                        </div>
                        <div className="flex items-end gap-2">
                            {utilTrend.map(({ week, avg }) => {
                                const isCurrent = week === currentWeekStr;
                                const barColor = avg >= 100 ? 'bg-rose-500' : avg >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
                                const heightPct = Math.max(4, Math.min(100, (avg / 150) * 100));
                                return (
                                    <button key={week} onClick={() => jumpToWeek(week)}
                                        title={`${formatKW(week)}: ${avg}%`}
                                        className="flex-1 flex flex-col items-center gap-1.5 group">
                                        <div className="w-full h-16 bg-slate-50 rounded flex items-end overflow-hidden">
                                            <div className={`w-full ${barColor} transition-all group-hover:opacity-80 ${isCurrent ? 'ring-2 ring-gea-500 ring-inset' : ''}`}
                                                style={{ height: `${heightPct}%` }}></div>
                                        </div>
                                        <span className={`text-[10px] ${isCurrent ? 'text-gea-700 font-bold' : 'text-slate-400'}`}>{week.split('-W')[1]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <h2 className="text-xl text-gea-800 font-semibold">{t('overview.title')}</h2>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                            <button onClick={() => {
                                const rowsCsv = [[t('overview.colProject'), t('proj.colNr'), t('overview.colCountry'), t('overview.colStatus'), 'IBN', t('overview.colHours'), t('overview.colLabor'), t('overview.colExtra'), t('overview.colTotal'), t('overview.colBudget')]];
                                groupedRows.forEach(([cat, catRows]) => catRows.forEach(({ p, totalHours, totalLaborCost, zusatzkosten, gesamtkosten }) => {
                                    rowsCsv.push([p.name, p.projectNumber || '', resolveCountryCode(p.country), t('status.' + computeAutoStatus(p)), p.ibnWeek || '', totalHours, totalLaborCost.toFixed(2), zusatzkosten.toFixed(2), gesamtkosten.toFixed(2), p.budget != null ? Number(p.budget).toFixed(2) : '']);
                                }));
                                downloadCsv(`Uebersicht_${new Date().toISOString().slice(0,10)}.csv`, rowsCsv);
                            }}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-gea-400 hover:text-gea-600 transition-colors font-medium">
                                {t('btn.exportCsv')}
                            </button>
                            <span>{t('overview.projects', { n: rows.length })}</span>
                            <span className="text-slate-300">|</span>
                            <span>{fmt(totalHoursAll)} {t('overview.hoursTotal')}</span>
                            <span className="text-slate-300">|</span>
                            <span className="font-medium text-slate-700">{fmt(totalGesamtkosten)} {t('overview.costsTotal')}</span>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gea-50 border-b-2 border-gea-200">
                                <tr>
                                    <th className="p-4 text-gea-800 font-semibold max-w-[300px]">{t('overview.colProject')}</th>
                                    <th className="p-4 text-gea-800 font-semibold whitespace-nowrap min-w-[100px]">{t('overview.colCountry')}</th>
                                    <th className="p-4 text-gea-800 font-semibold whitespace-nowrap min-w-[100px]">{t('overview.colStatus')}</th>
                                    <th className="p-4 text-gea-800 font-semibold whitespace-nowrap">IBN</th>
                                    <th className="p-4 text-gea-800 font-semibold text-right">{t('overview.colHours')}</th>
                                    <th className="p-4 text-gea-800 font-semibold text-right">{t('overview.colLabor')}</th>
                                    <th className="p-4 text-gea-800 font-semibold text-right">{t('overview.colExtra')}</th>
                                    <th className="p-4 text-gea-800 font-semibold text-right">{t('overview.colTotal')}</th>
                                    <th className="p-4 text-gea-800 font-semibold text-right whitespace-nowrap">{t('overview.colBudget')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {groupedRows.map(([cat, catRows]) => (
                                    <React.Fragment key={cat}>
                                        <tr className="bg-slate-50 border-y border-slate-200">
                                            <td colSpan={9} className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">{cat || t('overview.noCategory')}</td>
                                        </tr>
                                        {catRows.map(({ p, totalHours, totalLaborCost, zusatzkosten, gesamtkosten }) => {
                                            const cc = resolveCountryCode(p.country);
                                            return (
                                            <tr key={p.id} className="hover:bg-slate-50 cursor-pointer transition-colors"
                                                onClick={() => { setSelectedProjectDetails(p.id); setActiveTab('setup_proj'); }}>
                                                <td className="p-4 max-w-[300px]">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${resolveProjectColor(p.color).dot}`}></div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-slate-900 truncate">{p.name}</div>
                                                            <div className="text-xs text-slate-400 font-mono truncate">{p.projectNumber || '–'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${cc === '??' ? 'bg-rose-50 border-rose-200 text-rose-600' : cc === '/' ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`} title="Land">{cc}</span>
                                                </td>
                                                <td className="p-4"><StatusBadge status={computeAutoStatus(p)} t={t}/></td>
                                                <td className="p-4 text-slate-500 text-xs font-mono">{p.ibnWeek || '–'}</td>
                                                <td className="p-4 text-right text-slate-700 tabular-nums">{fmt(totalHours)} h</td>
                                                <td className="p-4 text-right text-slate-700 tabular-nums">
                                                    {p.billable !== false ? `${fmt(totalLaborCost)} €` : <span className="text-slate-400 text-xs">–</span>}
                                                </td>
                                                <td className="p-4 text-right text-slate-700 tabular-nums">
                                                    {zusatzkosten > 0 ? `${fmt(zusatzkosten)} €` : <span className="text-slate-400">–</span>}
                                                </td>
                                                <td className="p-4 text-right font-semibold text-slate-900 tabular-nums">
                                                    {gesamtkosten > 0 ? `${fmt(gesamtkosten)} €` : <span className="text-slate-400 font-normal">–</span>}
                                                </td>
                                                <td className="p-4 text-right tabular-nums">
                                                    {(() => {
                                                        const bu = budgetUsage(p.budget, gesamtkosten);
                                                        if (!bu) return <span className="text-slate-400">–</span>;
                                                        const cls = bu.level === 'over' ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                  : bu.level === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                  :                       'bg-emerald-50 text-emerald-700 border-emerald-200';
                                                        return (
                                                            <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${cls}`}
                                                                title={`${fmt(gesamtkosten)} € / ${fmt(p.budget)} €`}>
                                                                {bu.pct}%
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td colSpan={9} className="p-0">
                                        <EmptyState
                                            icon={<IconBriefcase size={32}/>}
                                            title={t('overview.noProjects')}
                                            description={t('overview.noProjectsDesc')}
                                            action={{ label: t('proj.new'), onClick: () => { setActiveTab('setup_proj'); openNewProjectForm(); } }}
                                        />
                                    </td></tr>
                                )}
                            </tbody>
                            {rows.length > 0 && (
                                <tfoot className="border-t-2 border-gea-200 bg-gea-50">
                                    <tr>
                                        <td className="p-4 text-gea-800 font-semibold text-sm" colSpan={4}>{t('overview.total')}</td>
                                        <td className="p-4 text-right font-semibold text-slate-900 tabular-nums">{fmt(totalHoursAll)} h</td>
                                        <td className="p-4 text-right font-semibold text-slate-900 tabular-nums">{fmt(rows.reduce((a,r)=>a+r.totalLaborCost,0))} €</td>
                                        <td className="p-4 text-right font-semibold text-slate-900 tabular-nums">{fmt(rows.reduce((a,r)=>a+r.zusatzkosten,0))} €</td>
                                        <td className="p-4 text-right font-bold text-gea-700 tabular-nums">{fmt(totalGesamtkosten)} €</td>
                                        <td className="p-4 text-right font-semibold text-slate-900 tabular-nums">
                                            {(() => {
                                                const withBudget = rows.filter(r => budgetUsage(r.p.budget, r.gesamtkosten));
                                                if (withBudget.length === 0) return <span className="text-slate-400 font-normal">–</span>;
                                                const sumBudget = withBudget.reduce((a, r) => a + Number(r.p.budget), 0);
                                                return `${fmt(sumBudget)} €`;
                                            })()}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        );
    };

