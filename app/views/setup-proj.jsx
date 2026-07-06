const SetupProjView = ({ s, h }) => {
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
        projViewMode,
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
        scrollToCurrentWeek, requestDeleteProject, openNewProjectForm,
        setProjViewMode } = h;
        if (selectedProjectDetails) {
            return <ProjectDetailsView s={s} h={h}/>;
        }

        const handleEditProject = (p) => {
            setProjForm({ name: p.name, category: p.category || projCategories[0] || '', projectNumber: p.projectNumber || '', address: p.address || '', country: p.country || '', startWeek: p.startWeek, ibnWeek: p.ibnWeek, color: resolveProjectColor(p.color).id, projType: p.projType || '', size: p.size != null ? String(p.size) : '', sharepointLink: p.sharepointLink || '', notes: p.notes || '' });
            setEditingProjectId(p.id);
            setIsProjFormOpen(true);
        };

        const now = getWeekString(new Date());

        // ── Local state for search + per-category sort ──────────────────────
        // View-Modus (Tabelle/Kacheln) ist eine pro-Nutzer-Einstellung
        // (s.projViewMode/h.setProjViewMode, siehe app.jsx) – bleibt über
        // Tab-Wechsel und Login-Sessions hinweg erhalten.
        const [searchQuery, setSearchQuery] = React.useState('');
        const [sortConfig, setSortConfig] = React.useState({});  // { [cat]: { col, dir } }
        const viewMode = projViewMode;
        const setViewMode = setProjViewMode;

        const getSortConfig = (cat) => sortConfig[cat] || { col: null, dir: 'asc' };
        const toggleSort = (cat, col) => {
            setSortConfig(prev => {
                const cur = prev[cat] || { col: null, dir: 'asc' };
                const nextDir = cur.col === col && cur.dir === 'asc' ? 'desc' : 'asc';
                return { ...prev, [cat]: { col, dir: nextDir } };
            });
        };

        const sortProjects = (projs, cat) => {
            const { col, dir } = getSortConfig(cat);
            if (!col) return projs;
            return [...projs].sort((a, b) => {
                let va, vb;
                if (col === 'name')    { va = (a.name || '').toLowerCase();       vb = (b.name || '').toLowerCase(); }
                if (col === 'country') { va = resolveCountryCode(a.country);       vb = resolveCountryCode(b.country); }
                if (col === 'status')  { va = computeAutoStatus(a);                vb = computeAutoStatus(b); }
                if (col === 'period')  { va = a.startWeek || '';                   vb = b.startWeek || ''; }
                if (col === 'type')    { va = (a.projType || '').toLowerCase();    vb = (b.projType || '').toLowerCase(); }
                if (col === 'size')    { va = Number(a.size) || 0;                 vb = Number(b.size) || 0; }
                if (va < vb) return dir === 'asc' ? -1 : 1;
                if (va > vb) return dir === 'asc' ?  1 : -1;
                return 0;
            });
        };

        const SortTh = ({ cat, col, label, className = '' }) => {
            const { col: sc, dir } = getSortConfig(cat);
            const active = sc === col;
            return (
                <th className={`p-3 text-slate-700 font-semibold cursor-pointer select-none hover:bg-slate-100 transition-colors ${className}`}
                    onClick={() => toggleSort(cat, col)}>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                        {label}
                        {active
                            ? <span className="text-gea-500 text-xs">{dir === 'asc' ? '▲' : '▼'}</span>
                            : <span className="text-slate-300 text-xs">⇅</span>}
                    </div>
                </th>
            );
        };

        const q = searchQuery.trim().toLowerCase();
        const matchesSearch = (p) => {
            if (!q) return true;
            return (p.name || '').toLowerCase().includes(q)
                || (p.projectNumber || '').toLowerCase().includes(q)
                || resolveCountryCode(p.country).toLowerCase().includes(q)
                || (p.projType || '').toLowerCase().includes(q)
                || (p.category || '').toLowerCase().includes(q);
        };

        const byStartWeek = (a, b) => compareWeekIds(a.startWeek || '', b.startWeek || '');
        const activeProjects = projects.filter(p => compareWeekIds(p.ibnWeek, now) >= 0 && matchesSearch(p)).slice().sort(byStartWeek);
        const pastProjects   = projects.filter(p => compareWeekIds(p.ibnWeek, now) < 0  && matchesSearch(p)).slice().sort(byStartWeek);
        const activeCats = [...new Set(activeProjects.map(p => p.category))];

        const ProjectRow = ({ p }) => {
            const effStatus = computeAutoStatus(p);
            const cc = resolveCountryCode(p.country);
            return (
                <tr className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 overflow-hidden">
                        <button onClick={() => setSelectedProjectDetails(p.id)}
                            className="flex items-center gap-2 text-left group min-w-0 w-full">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${resolveProjectColor(p.color).dot}`}></div>
                            <span className="text-slate-900 font-medium group-hover:text-gea-600 transition-colors truncate" title={p.name}>{p.name}</span>
                        </button>
                    </td>
                    <td className="p-3">
                        {p.projType
                            ? <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded font-medium">{p.projType}</span>
                            : <span className="text-slate-300 text-xs">–</span>}
                    </td>
                    <td className="p-3 text-slate-600 text-xs tabular-nums">{p.size != null && p.size !== '' ? p.size : '–'}</td>
                    <td className="p-3">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${cc === '??' ? 'bg-rose-50 border-rose-200 text-rose-600' : cc === '/' ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`} title={t('proj.colCountry')}>{cc}</span>
                    </td>
                    <td className="p-3"><StatusBadge status={effStatus} t={t}/></td>
                    <td className="p-3 text-slate-600 text-xs">{p.startWeek} – {p.ibnWeek}</td>
                    <td className="p-3 text-right">
                        <div className="flex justify-end items-center gap-2">
                            {p.sharepointLink && <a href={p.sharepointLink} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-gea-600 transition-colors" title="SharePoint öffnen"><IconExternalLink size={14}/></a>}
                            <button onClick={() => handleEditProject(p)} className="text-gea-600 text-xs font-medium hover:text-gea-700">{t('btn.edit')}</button>
                            <button onClick={() => requestDeleteProject(p.id)} className="text-rose-600 text-xs font-medium hover:text-rose-700">{t('btn.delete')}</button>
                        </div>
                    </td>
                </tr>
            );
        };

        // Kachel-Ansicht: dieselben Daten/Aktionen wie ProjectRow, nur als Karte.
        const ProjectCard = ({ p }) => {
            const effStatus = computeAutoStatus(p);
            const cc = resolveCountryCode(p.country);
            const color = resolveProjectColor(p.color);
            return (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group flex flex-col">
                    <div className={`h-1.5 ${color.dot} shrink-0`}></div>
                    <div className="p-4 flex flex-col gap-3 flex-1">
                        <button onClick={() => setSelectedProjectDetails(p.id)} className="text-left w-full min-w-0">
                            <div className="text-slate-900 font-medium group-hover:text-gea-600 transition-colors truncate" title={p.name}>{p.name}</div>
                            <div className="text-xs text-slate-400 font-mono truncate">{p.projectNumber || '–'}</div>
                        </button>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <StatusBadge status={effStatus} t={t}/>
                            {p.projType && <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded font-medium">{p.projType}</span>}
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${cc === '??' ? 'bg-rose-50 border-rose-200 text-rose-600' : cc === '/' ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`} title={t('proj.colCountry')}>{cc}</span>
                            {p.size != null && p.size !== '' && <span className="text-xs text-slate-500">Ø {p.size}</span>}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{p.startWeek} – {p.ibnWeek}</div>
                        <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
                            {p.sharepointLink
                                ? <a href={p.sharepointLink} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-gea-600 transition-colors" title={t('proj.openSharepoint')}><IconExternalLink size={14}/></a>
                                : <span/>}
                            <div className="flex items-center gap-3">
                                <button onClick={() => handleEditProject(p)} className="text-gea-600 text-xs font-medium hover:text-gea-700">{t('btn.edit')}</button>
                                <button onClick={() => requestDeleteProject(p.id)} className="text-rose-600 text-xs font-medium hover:text-rose-700">{t('btn.delete')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        // Sortier-Auswahl für die Kachel-Ansicht (Tabellen-Spaltenköpfe entfallen
        // dort) – nutzt dieselbe getSortConfig/toggleSort-Logik wie SortTh.
        const SortSelect = ({ cat }) => {
            const { col, dir } = getSortConfig(cat);
            return (
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">{t('proj.sortBy')}</span>
                    <select value={col || ''} onChange={e => e.target.value && toggleSort(cat, e.target.value)}
                        className="text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-gea-400">
                        <option value="">–</option>
                        <option value="name">{t('proj.colName')}</option>
                        <option value="type">{t('proj.colType')}</option>
                        <option value="size">{t('proj.colSize')}</option>
                        <option value="country">{t('proj.colCountry')}</option>
                        <option value="status">{t('proj.colStatus')}</option>
                        <option value="period">{t('proj.colPeriod')}</option>
                    </select>
                    {col && (
                        <button onClick={() => toggleSort(cat, col)} className="text-slate-400 hover:text-slate-700 p-1" title={t('proj.sortDir')}>
                            {dir === 'asc' ? '▲' : '▼'}
                        </button>
                    )}
                </div>
            );
        };

        const TableHead = ({ cat }) => (
            <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <SortTh cat={cat} col="name"    label={t('proj.colName')}     className="max-w-[200px]"/>
                    <SortTh cat={cat} col="type"    label={t('proj.colType')}     className="w-28"/>
                    <SortTh cat={cat} col="size"    label={t('proj.colSize')}     className="w-16"/>
                    <SortTh cat={cat} col="country" label={t('proj.colCountry')}  className="w-24"/>
                    <SortTh cat={cat} col="status"  label={t('proj.colStatus')}   className="w-32"/>
                    <SortTh cat={cat} col="period"  label={t('proj.colPeriod')}   className="w-36"/>
                    <th className="p-3 w-28"></th>
                </tr>
            </thead>
        );

        return (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                {/* Sticky top bar */}
                <div className="shrink-0 bg-white border-b border-slate-300 shadow-sm px-8 py-4">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-xl text-gea-800 font-semibold shrink-0">{t('proj.title')}</h2>
                            <div className="flex items-center gap-3 flex-1 justify-end">
                                <div className="relative flex-1 max-w-sm">
                                    <IconSearch size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder={t('proj.searchPlaceholder')}
                                        className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gea-400 bg-slate-50"
                                    />
                                    {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><IconX size={14}/></button>}
                                </div>
                                <div className="flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
                                    <button onClick={() => setViewMode('table')} title={t('proj.viewTable')}
                                        className={`px-2.5 py-2 transition-colors ${viewMode === 'table' ? 'bg-gea-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                                        <IconTable size={16}/>
                                    </button>
                                    <button onClick={() => setViewMode('grid')} title={t('proj.viewGrid')}
                                        className={`px-2.5 py-2 transition-colors border-l border-slate-300 ${viewMode === 'grid' ? 'bg-gea-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                                        <IconLayoutGrid size={16}/>
                                    </button>
                                </div>
                                <button
                                    onClick={openNewProjectForm}
                                    className="flex items-center gap-2 bg-gea-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gea-700 transition-colors shadow-sm shrink-0">
                                    <IconPlus size={16}/> {t('proj.new')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-auto p-8 pt-6">
                    <div className="max-w-5xl mx-auto space-y-6">
                        {/* Active projects by category */}
                        {activeCats.length === 0 && activeProjects.length === 0 && !q && (
                            <EmptyState
                                icon={<IconBriefcase size={32}/>}
                                title={t('proj.noActive')}
                                description={t('proj.noActiveDesc')}
                                action={{ label: t('proj.new'), onClick: openNewProjectForm }}
                            />
                        )}
                        {q && activeProjects.length === 0 && pastProjects.length === 0 && (
                            <EmptyState icon={<IconSearch size={32}/>} title={t('proj.noResults')} description={t('proj.noResultsFor', { q: searchQuery })}/>
                        )}
                        {activeCats.map(cat => {
                            const catProjs = sortProjects(activeProjects.filter(p => p.category === cat), cat);
                            const isCollapsed = collapsedProjCategories[cat];
                            return (
                                <div key={cat} className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
                                    <button onClick={() => toggleProjCategory(cat)}
                                        className="w-full p-4 bg-gea-50 border-b border-gea-200 flex items-center gap-3 hover:bg-gea-100 transition-colors">
                                        <span className="text-gea-500">{isCollapsed ? <IconChevronRight size={18}/> : <IconChevronDown size={18}/>}</span>
                                        <span className="text-gea-900 font-semibold text-lg">{cat}</span>
                                        <span className="ml-2 px-2 py-0.5 bg-white border border-gea-200 rounded-full text-xs text-gea-700 font-semibold">{catProjs.length}</span>
                                    </button>
                                    {!isCollapsed && viewMode === 'grid' && (
                                        <div className="px-4 pt-3 flex justify-end">
                                            <SortSelect cat={cat}/>
                                        </div>
                                    )}
                                    {!isCollapsed && (
                                        viewMode === 'table' ? (
                                            <table className="w-full text-left text-sm table-fixed">
                                                <TableHead cat={cat}/>
                                                <tbody className="divide-y divide-slate-200">
                                                    {catProjs.map(p => <ProjectRow key={p.id} p={p}/>)}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                                {catProjs.map(p => <ProjectCard key={p.id} p={p}/>)}
                                            </div>
                                        )
                                    )}
                                </div>
                            );
                        })}

                        {/* Past projects */}
                        {pastProjects.length > 0 && (
                            <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
                                <button onClick={() => setPastProjectsExpanded(e => !e)}
                                    className="w-full p-4 bg-slate-100 border-b border-slate-300 flex items-center gap-3 hover:bg-slate-200 transition-colors">
                                    <span className="text-slate-500">{pastProjectsExpanded ? <IconChevronDown size={18}/> : <IconChevronRight size={18}/>}</span>
                                    <span className="text-slate-700 font-semibold">{t('proj.pastProjects')}</span>
                                    <span className="ml-2 px-2 py-0.5 bg-white border border-slate-300 rounded-full text-xs text-slate-600 font-semibold">{pastProjects.length}</span>
                                </button>
                                {pastProjectsExpanded && viewMode === 'grid' && (
                                    <div className="px-4 pt-3 flex justify-end">
                                        <SortSelect cat="__past__"/>
                                    </div>
                                )}
                                {pastProjectsExpanded && (
                                    viewMode === 'table' ? (
                                        <table className="w-full text-left text-sm table-fixed">
                                            <TableHead cat="__past__"/>
                                            <tbody className="divide-y divide-slate-200 opacity-75">
                                                {sortProjects(pastProjects, '__past__').map(p => <ProjectRow key={p.id} p={p}/>)}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 opacity-75">
                                            {sortProjects(pastProjects, '__past__').map(p => <ProjectCard key={p.id} p={p}/>)}
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

