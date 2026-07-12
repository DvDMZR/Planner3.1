const ProjectDetailsView = ({ s, h }) => {
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
        empAliases, fxRates, expenseCategories, teamKst,
        language, t } = s;
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
        scrollToCurrentWeek, showToast,
        setEmpAliases, setFxRates } = h;
        const [isExpenseImportOpen, setIsExpenseImportOpen] = React.useState(false);
        const proj = projectById.get(selectedProjectDetails);
        const projId = proj?.id;

        const projAssignments = React.useMemo(
            () => (assignmentsByProject.get(projId) || []).filter(a => a.type === 'project'),
            [assignmentsByProject, projId]
        );
        const projCostItems = React.useMemo(
            () => costItemsByProject.get(projId) || [],
            [costItemsByProject, projId]
        );
        const assignmentsByEmpId = React.useMemo(() => {
            const m = new Map();
            projAssignments.forEach(a => {
                let arr = m.get(a.empId);
                if (!arr) { arr = []; m.set(a.empId, arr); }
                arr.push(a);
            });
            return m;
        }, [projAssignments]);
        const assignedEmpIds = React.useMemo(() => [...assignmentsByEmpId.keys()], [assignmentsByEmpId]);
        const presenceWeeks = React.useMemo(
            () => [...new Set(projAssignments.map(a => a.week))].sort(),
            [projAssignments]
        );
        const { totalHours, totalLaborCost, totalOtherCost, grandTotal } = React.useMemo(() => {
            let totalHours = 0, totalLaborCost = 0, totalOtherCost = 0;
            for (const [, empAss] of assignmentsByEmpId) {
                const hrs = empAss.reduce((acc, a) => acc + (a.hours ?? (a.percent / 100 * HOURS_PER_WEEK)), 0);
                totalHours += hrs;
                if (proj?.billable !== false) totalLaborCost += hrs * (proj?.hourlyRate ?? DEFAULT_HOURLY_RATE);
            }
            projCostItems.forEach(ci => { totalOtherCost += ci.amount || 0; });
            return { totalHours, totalLaborCost, totalOtherCost, grandTotal: totalLaborCost + totalOtherCost };
        }, [assignmentsByEmpId, projCostItems, proj?.billable, proj?.hourlyRate]);

        if (!proj) return null;

        return (
            <div className="flex-1 overflow-auto bg-slate-50 flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-300 bg-white flex items-center gap-4 flex-wrap shadow-sm">
                    <button onClick={() => setSelectedProjectDetails(null)}
                        title={t('projDetail.backToList')} aria-label={t('projDetail.backToList')}
                        className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors flex-shrink-0">
                        <IconArrowLeft size={20}/>
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-2xl text-slate-900 font-medium truncate">{proj.name}</h2>
                            {proj.projectNumber && <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">{proj.projectNumber}</span>}
                        </div>
                        <div className="text-sm text-slate-500 flex items-center gap-2 mt-1 flex-wrap">
                            <span className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${resolveProjectColor(proj.color).dot}`}></div>{proj.category}</span>
                            {proj.projType && <><span>·</span><span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded font-medium">{proj.projType}</span></>}
                            {proj.size != null && proj.size !== '' && <><span>·</span><span className="text-xs bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded font-medium">Size {proj.size}</span></>}
                            <span>·</span><span>{proj.startWeek} – {proj.ibnWeek}</span>
                            {proj.address && <><span>·</span><span>{proj.address}</span></>}
                            {proj.sharepointLink && <><span>·</span><a href={proj.sharepointLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-gea-600 hover:text-gea-700 hover:underline"><IconExternalLink size={13}/> SharePoint</a></>}
                        </div>
                    </div>

                    {/* Status + checkboxes */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <StatusBadge status={computeAutoStatus(proj)} t={t}/>
                        <InvoiceStateChip project={proj} t={t} showOpen={true}/>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox"
                                checked={!!proj.projectCompleted}
                                onChange={e => setProjects(projects.map(p => p.id === proj.id ? {...p, projectCompleted: e.target.checked} : p))}
                                className="w-4 h-4 text-gea-600 rounded"/>
                            <span className="text-sm font-medium text-slate-700">{t('projDetail.completed')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox"
                                checked={!!proj.costsSubmitted}
                                onChange={e => setProjects(projects.map(p => p.id === proj.id ? {...p, costsSubmitted: e.target.checked} : p))}
                                className="w-4 h-4 text-gea-600 rounded"/>
                            <span className="text-sm font-medium text-slate-700">{t('projDetail.costsSubmitted')}</span>
                        </label>
                        <button onClick={() => {
                            setProjForm({ name: proj.name, category: proj.category || projCategories[0] || '', projectNumber: proj.projectNumber || '', address: proj.address || '', country: proj.country || '', startWeek: proj.startWeek, ibnWeek: proj.ibnWeek, color: resolveProjectColor(proj.color).id, projType: proj.projType || '', size: proj.size != null ? String(proj.size) : '', budget: proj.budget != null ? String(proj.budget) : '', sharepointLink: proj.sharepointLink || '', notes: proj.notes || '' });
                            setEditingProjectId(proj.id);
                            setIsProjFormOpen(true);
                        }} className="bg-white border border-slate-300 hover:bg-gea-50 hover:border-gea-400 text-slate-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors">
                            <IconEdit size={15}/> {t('btn.edit')}
                        </button>
                        <button onClick={openInvoiceModal} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors">
                            <IconFileText size={15}/> {t('projDetail.invoice')}
                        </button>
                        <button onClick={() => setIsExpenseImportOpen(true)}
                            className="bg-white border border-slate-300 hover:bg-gea-50 hover:border-gea-400 text-slate-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors">
                            <IconFileText size={15}/> {t('expense.importBtn')}
                        </button>
                        <button onClick={() => { setEditingCostItem(null); setIsCostItemModalOpen(true); }}
                            className="bg-gea-600 hover:bg-gea-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors">
                            <IconPlus size={15}/> {t('projDetail.costItem')}
                        </button>
                    </div>
                </div>

                <div className="p-6 max-w-7xl mx-auto w-full space-y-6">

                    {/* Employee Presence Overview */}
                    {assignedEmpIds.length > 0 && presenceWeeks.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="text-slate-900 text-base font-medium">{t('projDetail.presence')}</h3>
                                <span className="text-xs text-slate-400">{presenceWeeks.length} {t('projDetail.weeks')}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="text-xs border-collapse w-full">
                                    <thead>
                                        <tr>
                                            <th className="p-3 text-left text-slate-500 font-medium border-r border-slate-200 bg-slate-50 w-40 sticky left-0">{t('projDetail.colEmployee')}</th>
                                            {presenceWeeks.map(w => (
                                                <th key={w} className="p-2 text-center text-slate-500 font-medium border-r border-slate-200 bg-slate-50 min-w-[52px]">
                                                    {t('util.kw')}{w.split('-W')[1]}
                                                </th>
                                            ))}
                                            <th className="p-2 text-center text-slate-500 font-medium bg-slate-50 min-w-[60px]">{t('projDetail.colHours')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {assignedEmpIds.map(empId => {
                                            const emp = employeeById.get(empId);
                                            const empAss = assignmentsByEmpId.get(empId) || [];
                                            const empHours = empAss.reduce((acc, a) => acc + (a.hours ?? (a.percent / 100 * HOURS_PER_WEEK)), 0);
                                            return (
                                                <tr key={empId} className="hover:bg-slate-50">
                                                    <td className="p-3 text-slate-800 font-medium border-r border-slate-200 sticky left-0 bg-white">{emp?.name || t('projDetail.unknown')}</td>
                                                    {presenceWeeks.map(w => {
                                                        const a = empAss.find(x => x.week === w);
                                                        return (
                                                            <td key={w} className="p-1 text-center border-r border-slate-100">
                                                                {a ? (
                                                                    <button
                                                                        onClick={() => { setAssignContext({ empId, week: w, existing: a }); setIsAssignModalOpen(true); }}
                                                                        className="mx-auto w-9 h-7 rounded flex items-center justify-center bg-gea-100 text-gea-700 font-medium leading-none hover:bg-gea-200 transition-colors cursor-pointer">
                                                                        {a.hours ?? Math.round((a.percent ?? 100) / 100 * HOURS_PER_WEEK)}h
                                                                    </button>
                                                                ) : (
                                                                    <div className="mx-auto w-9 h-7 rounded bg-slate-50"></div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-2 text-center text-slate-900 font-medium">{empHours}h</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Cost Items Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-slate-900 text-base font-medium">{t('projDetail.costItems')}</h3>
                            <button onClick={() => { setEditingCostItem(null); setIsCostItemModalOpen(true); }}
                                className="text-gea-600 text-sm font-medium hover:text-gea-700 flex items-center gap-1">
                                <IconPlus size={15}/> {t('btn.add')}
                            </button>
                        </div>
                        {projCostItems.length === 0 ? (
                            <EmptyState
                                icon={<IconFileText size={28}/>}
                                title={t('projDetail.noCostItems')}
                                description={t('projDetail.noCostItemsDesc')}
                                action={{ label: t('projDetail.costItem'), onClick: () => { setEditingCostItem(null); setIsCostItemModalOpen(true); } }}
                            />
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3 text-slate-500 font-medium">{t('projDetail.colEmployee')}</th>
                                        <th className="p-3 text-slate-500 font-medium">{t('projDetail.colOccasion')}</th>
                                        <th className="p-3 text-slate-500 font-medium text-center">{t('util.kw')}</th>
                                        <th className="p-3 text-slate-500 font-medium">{t('projDetail.colItems')}</th>
                                        <th className="p-3 text-slate-500 font-medium text-right">{t('projDetail.colAmount')}</th>
                                        <th className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {projCostItems.map(ci => {
                                        const emp = employeeById.get(ci.empId);
                                        const ciLines = ci.lines || [];
                                        return (
                                            <tr key={ci.id} className="hover:bg-slate-50 transition-colors align-top">
                                                <td className="p-3 text-slate-800 font-medium">{emp?.name || '–'}</td>
                                                <td className="p-3 text-slate-600">{ci.description || '–'}</td>
                                                <td className="p-3 text-slate-500 text-xs text-center">
                                                    {(() => {
                                                        if (ci.dateFrom) {
                                                            const kwF = parseInt(getWeekString(new Date(ci.dateFrom)).split('-W')[1]);
                                                            const kwT = ci.dateTo ? parseInt(getWeekString(new Date(ci.dateTo)).split('-W')[1]) : kwF;
                                                            const kw = t('util.kw');
                                                            return kwF === kwT ? `${kw}${kwF}` : `${kw}${kwF}–${kw}${kwT}`;
                                                        }
                                                        return ci.week ? `${t('util.kw')}${ci.week.split('-W')[1]}` : '–';
                                                    })()}
                                                </td>
                                                <td className="p-3">
                                                    {ciLines.length === 0 ? <span className="text-slate-400 text-xs">–</span> : (
                                                        <div className="flex flex-col gap-1">
                                                            {ciLines.map(l => {
                                                                const cfg = COST_LINE_TYPES[l.type] || COST_LINE_TYPES.other;
                                                                const amt = l.amount || 0;
                                                                return (
                                                                    <div key={l.id} className="flex items-center gap-2 text-xs">
                                                                        <span className={`px-2 py-0.5 rounded-full border font-medium shrink-0 ${cfg.chip}`}>{cfg.label}</span>
                                                                        {l.type === 'hours' && l.hours != null && (
                                                                            <span className="text-slate-500 tabular-nums">{l.hours}h × {l.hourlyRate}€</span>
                                                                        )}
                                                                        {l.comment && <span className="text-slate-500 truncate">{l.comment}</span>}
                                                                        <span className="text-slate-700 tabular-nums ml-auto">{amt.toFixed(2)} €</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right text-slate-900 font-medium tabular-nums">{(ci.amount || 0).toFixed(2)} €</td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => { setEditingCostItem(ci); setIsCostItemModalOpen(true); }}
                                                        className="text-gea-600 text-xs font-medium hover:text-gea-700">{t('btn.edit')}</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-slate-900 text-base font-medium">{t('projDetail.summary')}</h3>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 rounded-md bg-slate-200 flex items-center justify-center"><IconClock size={14} className="text-slate-500"/></div>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{t('projDetail.hours')}</p>
                                </div>
                                <p className="text-2xl text-slate-900 font-semibold tabular-nums">{totalHours}h</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center"><IconUsers size={14} className="text-blue-600"/></div>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{t('projDetail.laborCosts')}</p>
                                </div>
                                <p className="text-2xl text-slate-900 font-semibold tabular-nums">{totalLaborCost.toFixed(2)} €</p>
                                {proj.billable === false && <p className="text-xs text-slate-400 mt-1">{t('projDetail.notCalc')}</p>}
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center"><IconFileText size={14} className="text-amber-600"/></div>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{t('projDetail.extraCosts')}</p>
                                </div>
                                <p className="text-2xl text-slate-900 font-semibold tabular-nums">{totalOtherCost.toFixed(2)} €</p>
                            </div>
                            <div className="rounded-xl border-2 border-gea-300 bg-gradient-to-br from-gea-50 to-gea-100 p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 rounded-md bg-gea-500 flex items-center justify-center"><IconBarChart size={14} className="text-white"/></div>
                                    <p className="text-[10px] text-gea-700 font-medium uppercase tracking-wide">{t('projDetail.total')}</p>
                                </div>
                                <p className="text-2xl text-gea-800 font-bold tabular-nums">{grandTotal.toFixed(2)} €</p>
                            </div>
                        </div>
                        {(() => {
                            const bu = budgetUsage(proj.budget, grandTotal);
                            if (!bu) return null;
                            const barColor = bu.level === 'over' ? 'bg-rose-500' : bu.level === 'warn' ? 'bg-amber-500' : 'bg-emerald-500';
                            const txtColor = bu.level === 'over' ? 'text-rose-600' : bu.level === 'warn' ? 'text-amber-600' : 'text-emerald-600';
                            return (
                                <div className="px-6 pb-4">
                                    <div className="flex items-center justify-between text-sm mb-1.5">
                                        <span className="text-slate-500 font-medium">{t('budget.label')}</span>
                                        <span className="tabular-nums text-slate-700">
                                            {grandTotal.toFixed(2)} € / {Number(proj.budget).toFixed(2)} €
                                            <span className={`ml-2 font-semibold ${txtColor}`}>{bu.pct}%</span>
                                        </span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, bu.pct)}%` }}></div>
                                    </div>
                                    {bu.level === 'over' && (
                                        <p className="text-xs text-rose-600 mt-1">
                                            {t('budget.overHint', { amount: (grandTotal - Number(proj.budget)).toFixed(2) })}
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                        <div className="px-6 pb-5 pt-1 flex items-center gap-4 border-t border-slate-100">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={proj.billable !== false}
                                    onChange={() => setProjects(projects.map(p => p.id === proj.id ? {...p, billable: !p.billable} : p))}
                                    className="w-4 h-4 text-gea-600 rounded"/>
                                <span className="text-sm text-slate-700">{t('projDetail.calcHours')}</span>
                            </label>
                            {proj.billable !== false && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500">{t('projDetail.hourRate')}</span>
                                    <input type="number" min="0" step="1"
                                        value={proj.hourlyRate ?? DEFAULT_HOURLY_RATE}
                                        onChange={e => setProjects(projects.map(p => p.id === proj.id ? {...p, hourlyRate: parseFloat(e.target.value) || 0} : p))}
                                        className="w-20 p-1.5 border border-slate-300 rounded text-sm text-center font-medium"/>
                                    <span className="text-sm text-slate-400">€/h</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {isExpenseImportOpen && (
                    <ExpenseImportModal
                        proj={proj}
                        projects={projects}
                        teamKst={teamKst}
                        computeAutoStatus={computeAutoStatus}
                        employees={employees}
                        assignments={assignments}
                        costItems={costItems}
                        setCostItems={setCostItems}
                        handleSaveAssignment={handleSaveAssignment}
                        empAliases={empAliases}
                        setEmpAliases={setEmpAliases}
                        fxRates={fxRates}
                        setFxRates={setFxRates}
                        expenseCategories={expenseCategories}
                        showToast={showToast}
                        onClose={() => setIsExpenseImportOpen(false)}
                        t={t}
                    />
                )}
                {isCostItemModalOpen && (
                    <CostItemModal
                        projectId={proj.id}
                        existingItem={editingCostItem}
                        assignments={assignments}
                        employees={employees}
                        costItems={costItems}
                        setCostItems={setCostItems}
                        showToast={showToast}
                        onClose={() => { setIsCostItemModalOpen(false); setEditingCostItem(null); }}
                        t={t}
                    />
                )}
            </div>
        );
    };

