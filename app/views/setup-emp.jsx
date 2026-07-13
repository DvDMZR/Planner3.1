const SetupEmpView = ({ s, h }) => {
    const { activeTab, employees, projects, assignments, expenses, costItems,
        empCategories, projCategories, basicTasks, basicTasksMeta,
        inactiveBasicTasks, basicTasksSubTab, offtimeTasks, inactiveOfftimeTasks,
        inactiveSupportTasks, inactiveTrainingTasks, isChangelogOpen,
        weeks, selectedProject, collapsedCategories, collapsedProjCategories,
        collapsedEmpSetup, selectedProjectDetails, weeksAhead,
        isAssignModalOpen, assignContext, isCostItemModalOpen, editingCostItem,
        isCopyModalOpen, copyContext, isDeleteMode, pastProjectsExpanded,
        isInvoiceModalOpen, invoiceSelection, invoiceRecipient, isProjFormOpen,
        isHelpModalOpen, timelineYear, empForm, editingEmpId, isEmpFormOpen, projForm,
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
        setEditingEmpId, setIsEmpFormOpen, setProjForm, setEditingProjectId, setNewEmpCat,
        setNewProjCat, setNewBasicTask, setNewOfftimeTask, setExpandedSetupCats,
        setSyncStatus, setFsStatus,
        getEmpWeeklyHours, computeAutoStatus, getWeeksForYear, getUtilization,
        toggleCategory, toggleProjCategory, toggleEmpSetup,
        handleSaveAssignment, handleDeleteAssignment, handleDeleteAssignmentSeries,
        handleDrop, exportData, importData, buildInvoiceData, openInvoiceModal,
        scrollToCurrentWeek } = h;

    const closeEmpForm = React.useCallback(() => setIsEmpFormOpen(false), [setIsEmpFormOpen]);
    useEscapeToClose(isEmpFormOpen ? closeEmpForm : null);

        const emptyForm = { name: '', category: empCategories[0] || '', weeklyHours: HOURS_PER_WEEK, vacationDays: '', email: '', role: '', notes: '', booksOnInvoice: false };
        const isValidEmail = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

        const openCreateForm = () => {
            setEmpForm(emptyForm);
            setEditingEmpId(null);
            setIsEmpFormOpen(true);
        };

        const handleSaveEmp = () => {
            if (!empForm.name.trim()) return;
            if (!isValidEmail(empForm.email)) return;
            const wh = Math.max(1, parseInt(empForm.weeklyHours) || HOURS_PER_WEEK);
            // Urlaubsanspruch: leer = kein Tracking (null), sonst ganze Tage
            const vdStr = String(empForm.vacationDays ?? '').trim();
            const payload = {
                name: empForm.name.trim(),
                category: empForm.category,
                weeklyHours: wh,
                vacationDays: vdStr === '' ? null : Math.max(0, parseInt(vdStr) || 0),
                email: (empForm.email || '').trim() || null,
                role: (empForm.role || '').trim() || null,
                notes: (empForm.notes || '').trim() || null,
                booksOnInvoice: !!empForm.booksOnInvoice,
            };
            if (editingEmpId) {
                setEmployees(employees.map(e => e.id === editingEmpId ? { ...e, ...payload } : e));
            } else {
                setEmployees([...employees, { id: makeId('emp'), ...payload, active: true }]);
            }
            setIsEmpFormOpen(false);
            setEditingEmpId(null);
            setEmpForm(emptyForm);
        };

        const handleEditEmp = (e) => {
            setEmpForm({
                name: e.name || '',
                category: e.category || empCategories[0] || '',
                weeklyHours: e.weeklyHours ?? HOURS_PER_WEEK,
                vacationDays: e.vacationDays != null ? String(e.vacationDays) : '',
                email: e.email || '',
                role: e.role || '',
                notes: e.notes || '',
                booksOnInvoice: !!e.booksOnInvoice,
            });
            setEditingEmpId(e.id);
            setIsEmpFormOpen(true);
        };

        const closeForm = () => {
            setIsEmpFormOpen(false);
            setEditingEmpId(null);
            setEmpForm(emptyForm);
        };

        const emailValid = isValidEmail(empForm.email);
        const canSave = empForm.name.trim() && emailValid;

        // Suche über Name, Email und Rolle (bei vielen Mitarbeitern nötig)
        const [empSearch, setEmpSearch] = React.useState('');
        const empQ = empSearch.trim().toLowerCase();
        const matchesEmpSearch = (e) => !empQ
            || (e.name || '').toLowerCase().includes(empQ)
            || (e.email || '').toLowerCase().includes(empQ)
            || (e.role || '').toLowerCase().includes(empQ);

        return (
            <div className="flex-1 overflow-auto p-8 bg-slate-50">
                <div className="max-w-7xl mx-auto space-y-6">

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
                            <h2 className="text-xl text-slate-900 font-medium shrink-0">{t('emp.title')}</h2>
                            <div className="flex items-center gap-3 flex-1 justify-end">
                                <div className="relative flex-1 max-w-sm">
                                    <IconSearch size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                    <input type="text" value={empSearch}
                                        onChange={e => setEmpSearch(e.target.value)}
                                        placeholder={t('emp.searchPlaceholder')}
                                        className="w-full pl-8 pr-7 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gea-400 bg-white"/>
                                    {empSearch && (
                                        <button onClick={() => setEmpSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><IconX size={14}/></button>
                                    )}
                                </div>
                                <button onClick={openCreateForm}
                                    className="bg-gea-600 text-white px-4 py-2 rounded text-sm hover:bg-gea-700 font-medium transition-colors flex items-center gap-2 shrink-0">
                                    <IconPlus size={16}/> {t('emp.add')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Kategorie-Karten in zwei Spalten (Desktop) – jede Karte
                        behält ihre eigene Höhe, da items-start statt Stretch. */}
                    <div className="grid lg:grid-cols-2 gap-4 items-start">
                        {empCategories.map(category => {
                            // Bei aktiver Suche Kategorien aufgeklappt lassen,
                            // sonst sind Treffer unsichtbar.
                            const isCollapsed = empQ ? false : collapsedEmpSetup[category];
                            const catEmps = employees.filter(e => e.category === category && matchesEmpSearch(e));
                            if (empQ && catEmps.length === 0) return null;

                            return (
                                <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <button
                                        onClick={() => toggleEmpSetup(category)}
                                        className="w-full p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2 hover:bg-slate-100 transition-colors"
                                    >
                                        <span className="text-slate-500">
                                            {isCollapsed ? <IconChevronRight size={20}/> : <IconChevronDown size={20}/>}
                                        </span>
                                        <h3 className="text-lg text-slate-900 font-medium">{category}</h3>
                                        <span className="ml-2 px-2 py-0.5 bg-white border border-slate-200 rounded-full text-xs text-slate-500 font-medium">
                                            {catEmps.length}
                                        </span>
                                    </button>

                                    {!isCollapsed && (
                                        catEmps.length > 0 ? (
                                            // table-fixed + feste Spaltenbreiten (Muster wie setup-proj.jsx/
                                            // resource.jsx): verhindert, dass ein langer Name die Aktions-Spalte
                                            // aus dem sichtbaren Bereich der Karte drängt. Lange Werte werden
                                            // per truncate abgeschnitten, der volle Text steht im title-Tooltip.
                                            // E-Mail/Std.-Woche stehen nur noch im Bearbeiten-Dialog, nicht in
                                            // der Übersicht (weniger Spalten = weniger Kollisionsrisiko).
                                            <table className="w-full text-left text-sm table-fixed">
                                                <thead className="bg-slate-50/50">
                                                    <tr>
                                                        <th className="p-4 text-slate-500 font-medium">{t('emp.colName')}</th>
                                                        <th className="p-4 text-slate-500 font-medium w-28">{t('emp.colStatus')}</th>
                                                        <th className="p-4 w-40"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-300">
                                                    {catEmps.map(e => (
                                                        <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-4 text-slate-900 font-medium">
                                                                <div className="truncate" title={e.name}>{e.name}</div>
                                                                {e.role && <div className="text-xs text-slate-400 font-normal mt-0.5 truncate" title={e.role}>{e.role}</div>}
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${e.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                                                    {e.active ? t('emp.active') : t('emp.inactive')}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex justify-end gap-3 whitespace-nowrap">
                                                                    <button onClick={() => handleEditEmp(e)} className="text-gea-600 text-xs font-medium hover:text-gea-700">{t('btn.edit')}</button>
                                                                    <button onClick={() => setEmployees(employees.map(x => x.id === e.id ? {...x, active: !x.active} : x))} className="text-gea-600 text-xs font-medium hover:text-gea-700">{t('emp.toggleStatus')}</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-4 text-sm text-slate-400 text-center bg-white">
                                                {t('emp.noInCategory')}
                                            </div>
                                        )
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {isEmpFormOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" style={{maxHeight:'90vh'}}>
                            <ModalHeader title={editingEmpId ? t('emp.editTitle') : t('emp.addTitle')} onClose={closeForm}/>
                            <div className="p-6 space-y-4 overflow-y-auto" style={{maxHeight:'calc(90vh - 130px)'}}
                                onKeyDown={e => {
                                    // Enter speichert (außer im Notizen-Textarea)
                                    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && canSave) handleSaveEmp();
                                }}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">{t('emp.fieldName')} *</label>
                                        <input type="text" autoFocus value={empForm.name} onChange={e=>setEmpForm({...empForm, name: e.target.value})}
                                            className="w-full p-2 border border-slate-300 rounded text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">{t('emp.fieldCategory')}</label>
                                        <select value={empForm.category} onChange={e=>setEmpForm({...empForm, category: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-sm">
                                            {empCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">{t('emp.colHours')}</label>
                                        <input type="number" min="1" max="80" value={empForm.weeklyHours} onChange={e=>setEmpForm({...empForm, weeklyHours: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-sm"/>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">{t('emp.fieldVacationDays')}</label>
                                        <input type="number" min="0" max="99" value={empForm.vacationDays ?? ''} onChange={e=>setEmpForm({...empForm, vacationDays: e.target.value})} placeholder="z.B. 30" className="w-full p-2 border border-slate-300 rounded text-sm"/>
                                        <p className="text-[11px] text-slate-400 mt-1">{t('emp.vacationDaysHint')}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">{t('emp.fieldEmail')}</label>
                                        <input type="email" value={empForm.email} onChange={e=>setEmpForm({...empForm, email: e.target.value})}
                                            placeholder="vorname.nachname@firma.de"
                                            className={`w-full p-2 border rounded text-sm ${emailValid ? 'border-slate-300' : 'border-rose-400 bg-rose-50'}`}/>
                                        {!emailValid && <p className="text-xs text-rose-600 mt-1">{t('emp.emailInvalid')}</p>}
                                        <p className="text-xs text-slate-400 mt-1">{t('emp.emailHint')}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">{t('emp.fieldRole')}</label>
                                        <input type="text" value={empForm.role} onChange={e=>setEmpForm({...empForm, role: e.target.value})}
                                            placeholder={t('emp.placeholderRole')}
                                            className="w-full p-2 border border-slate-300 rounded text-sm"/>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">{t('emp.fieldNotes')}</label>
                                        <textarea rows="2" value={empForm.notes} onChange={e=>setEmpForm({...empForm, notes: e.target.value})}
                                            placeholder={t('emp.placeholderNotes')}
                                            className="w-full p-2 border border-slate-300 rounded text-sm resize-none"/>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="flex items-start gap-2 cursor-pointer select-none">
                                            <input type="checkbox" checked={!!empForm.booksOnInvoice}
                                                onChange={e=>setEmpForm({...empForm, booksOnInvoice: e.target.checked})}
                                                className="w-4 h-4 text-gea-600 rounded mt-0.5"/>
                                            <span>
                                                <span className="block text-sm text-slate-700 font-medium">{t('emp.booksOnInvoice')}</span>
                                                <span className="block text-xs text-slate-400">{t('emp.booksOnInvoiceHint')}</span>
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                                <button onClick={closeForm} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium">{t('btn.cancel')}</button>
                                <button onClick={handleSaveEmp} disabled={!canSave}
                                    className="px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 font-medium disabled:bg-slate-300 disabled:cursor-not-allowed">
                                    {editingEmpId ? t('btn.save') : t('btn.add')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };
