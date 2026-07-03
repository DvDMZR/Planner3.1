const SetupCatsView = ({ s, h }) => {
    const { useState } = React;
    const {
        empCategories, projCategories, projTypes, basicTasks, basicTasksMeta,
        inactiveBasicTasks, offtimeTasks, inactiveOfftimeTasks,
        inactiveSupportTasks, inactiveTrainingTasks, customTrainingTasks,
        expandedSetupCats, newEmpCat, newProjCat, newBasicTask, newOfftimeTask,
        expenseCategories,
        t,
    } = s;
    const {
        setEmpCategories, setProjCategories, setProjTypes, setBasicTasks, setBasicTasksMeta,
        setInactiveBasicTasks, setOfftimeTasks, setInactiveOfftimeTasks,
        setInactiveSupportTasks, setInactiveTrainingTasks, setCustomTrainingTasks,
        setExpandedSetupCats, setNewEmpCat, setNewProjCat, setNewBasicTask, setNewOfftimeTask,
        setExpenseCategories,
    } = h;

    const [newTrainingTask, setNewTrainingTask] = useState('');
    const [newOtherTask, setNewOtherTask] = useState('');
    const [inactiveOpen, setInactiveOpen] = useState(false);
    const [newProjType, setNewProjType] = useState('');
    const addProjType = () => {
        const v = newProjType.trim();
        if (!v || (projTypes||[]).includes(v)) return;
        setProjTypes(prev => [...(prev||[]), v]);
        setNewProjType('');
    };
    // Separate hardcoded Basic Tasks (no meta) from user-created Other Tasks (with meta).
    const hardcodedBasicTasks = basicTasks.filter(t => !basicTasksMeta?.[t]);
    const otherTasks          = basicTasks.filter(t =>  basicTasksMeta?.[t]);

    // O(1) membership checks for the inactive lists; the source arrays are
    // hit by .filter() in multiple places below.
    const inactiveSupportSet  = React.useMemo(() => new Set(inactiveSupportTasks  || []), [inactiveSupportTasks]);
    const inactiveTrainingSet = React.useMemo(() => new Set(inactiveTrainingTasks || []), [inactiveTrainingTasks]);
    const inactiveOfftimeSet  = React.useMemo(() => new Set((inactiveOfftimeTasks || []).map(x => x.name)), [inactiveOfftimeTasks]);

    const activeSupportTasks  = React.useMemo(() => SUPPORT_TASKS.filter(t => !inactiveSupportSet.has(t)), [inactiveSupportSet]);
    const activeTrainingTasks = React.useMemo(() => TRAINING_TASKS.filter(t => !inactiveTrainingSet.has(t)), [inactiveTrainingSet]);
    const activeCustomTraining = React.useMemo(() => (customTrainingTasks || []).filter(t => !inactiveTrainingSet.has(t)), [customTrainingTasks, inactiveTrainingSet]);
    const activeOfftimeTasks  = React.useMemo(() => offtimeTasks.filter(t => !inactiveOfftimeSet.has(t)), [offtimeTasks, inactiveOfftimeSet]);

    // Mitarbeiter-Kategorien werden zu Team-Dateinamen auf SharePoint/FS –
    // ungültige Zeichen würden den Sync brechen (siehe isValidTeamName).
    const [empCatError, setEmpCatError] = useState('');
    const addEmpCat = () => {
        const v = newEmpCat.trim();
        if (!v || empCategories.includes(v)) return;
        if (!isValidTeamName(v)) { setEmpCatError(t('cats.invalidTeamName')); return; }
        setEmpCatError('');
        setEmpCategories([...empCategories, v]);
        setNewEmpCat('');
    };

    // ── Spesen-Kategorien (Import-Keyword-Mapping) ──────────────────────────
    // Es wird immer die normalisierte VOLLE Liste persistiert (inkl. Built-ins
    // mit ggf. geänderten Labels/Keywords), damit die Match-Reihenfolge und
    // alle Edits deterministisch aus category-defs.json reproduzierbar sind.
    const expCats = normalizeExpenseCategories(expenseCategories);
    const updateExpCats = (mutator) =>
        setExpenseCategories(mutator(normalizeExpenseCategories(expenseCategories)));
    const [expKeywordInputs, setExpKeywordInputs] = useState({});   // { catId: text }
    const [expEditingId, setExpEditingId] = useState(null);
    const [expEditLabel, setExpEditLabel] = useState('');
    const [newExpCatLabel, setNewExpCatLabel] = useState('');
    const [newExpCatType, setNewExpCatType] = useState('other');
    const EXP_BUCKETS = ['travel', 'accommodation', 'meals', 'other'];

    const addExpKeyword = (catId) => {
        const kw = (expKeywordInputs[catId] || '').trim().toLowerCase();
        if (!kw) return;
        updateExpCats(cats => cats.map(c =>
            c.id === catId && !c.keywords.includes(kw) ? { ...c, keywords: [...c.keywords, kw] } : c));
        setExpKeywordInputs(prev => ({ ...prev, [catId]: '' }));
    };
    const removeExpKeyword = (catId, kw) =>
        updateExpCats(cats => cats.map(c =>
            c.id === catId ? { ...c, keywords: c.keywords.filter(k => k !== kw) } : c));
    const saveExpLabel = (catId) => {
        const label = expEditLabel.trim();
        if (label) updateExpCats(cats => cats.map(c => c.id === catId ? { ...c, label } : c));
        setExpEditingId(null);
    };
    const addExpCategory = () => {
        const label = newExpCatLabel.trim();
        if (!label || expCats.some(c => c.label.toLowerCase() === label.toLowerCase())) return;
        const cat = { id: makeId('exp'), label, lineType: newExpCatType, keywords: [], builtin: false };
        // Vor dem Fallback 'other' einfügen, damit die Keywords greifen
        updateExpCats(cats => [...cats.filter(c => c.id !== 'other'), cat,
                               ...cats.filter(c => c.id === 'other')]);
        setNewExpCatLabel('');
    };
    const removeExpCategory = (catId) =>
        updateExpCats(cats => cats.filter(c => c.id !== catId));
    const setExpBucket = (catId, lineType) =>
        updateExpCats(cats => cats.map(c => c.id === catId ? { ...c, lineType } : c));

    const addOtherTask = () => {
        const t = newOtherTask.trim();
        if (!t) return;
        if (basicTasks.includes(t)) return;
        setBasicTasks(prev => [...prev, t]);
        setBasicTasksMeta(prev => ({...prev, [t]: { createdAt: new Date().toISOString(), permanent: false }}));
        setNewOtherTask('');
    };

    const COLOR_SWATCHES = [null, ...PROJECT_COLORS.map(c => c.id)];
    const renderSwatch = (colorId) => {
        if (!colorId) return <span className="w-4 h-4 rounded-full border-2 border-slate-300 bg-white inline-block"></span>;
        const c = resolveProjectColor(colorId);
        return <span className={`w-4 h-4 rounded-full ${c.dot} inline-block`}></span>;
    };
    const renderColorPicker = (taskName) => (
        <div className="flex gap-1 items-center">
            {COLOR_SWATCHES.map((cid, i) => (
                <button key={i} title={cid || t('cats.noColor')}
                    onClick={() => setBasicTasksMeta(prev => ({...prev, [taskName]: {...(prev[taskName]||{}), color: cid || undefined}}))}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${(basicTasksMeta[taskName]?.color || null) === cid ? 'border-gea-600 scale-110' : 'border-transparent hover:border-slate-400'} ${cid ? resolveProjectColor(cid).dot : 'bg-white border-slate-300'}`}>
                </button>
            ))}
        </div>
    );

    const setBasicInactive = (task) => {
        const meta = basicTasksMeta?.[task];
        setBasicTasks(prev => prev.filter(t => t !== task));
        setInactiveBasicTasks(prev => [...prev, { name: task, createdAt: meta?.createdAt || new Date().toISOString() }]);
    };

    // Add a Basic Task without a meta entry so it appears under the
    // hardcoded-Basic dropdown in the planning modal (and renders here under
    // Basic, not Other).
    const addBasicTask = () => {
        const t = newBasicTask.trim();
        if (!t) return;
        if (basicTasks.includes(t)) return;
        setBasicTasks(prev => [...prev, t]);
        setNewBasicTask('');
    };

    const reactivateBasic = (item) => {
        setBasicTasks(prev => [...prev, item.name]);
        setBasicTasksMeta(prev => ({...prev, [item.name]: {...(prev[item.name]||{}), createdAt: item.createdAt || new Date().toISOString()}}));
        setInactiveBasicTasks(prev => prev.filter(t => t.name !== item.name));
    };

    // Aggregate count for all inactive items
    const totalInactive = inactiveBasicTasks.length
        + (inactiveOfftimeTasks||[]).length
        + (inactiveSupportTasks||[]).length
        + (inactiveTrainingTasks||[]).length;

    // Sektion mit optionalem Eintrags-Zähler und Kurzbeschreibung – der Nutzer
    // sieht auf einen Blick, was drinsteckt, ohne jede Sektion aufzuklappen.
    const section = (key, title, optsOrChildren, maybeChildren) => {
        // Flexible Signatur: section(key, title, children) ODER
        // section(key, title, { count, hint }, children)
        const hasOpts = maybeChildren !== undefined;
        const { count, hint } = hasOpts ? optsOrChildren : {};
        const children = hasOpts ? maybeChildren : optsOrChildren;
        return sectionInner(key, title, count, hint, children);
    };
    const sectionInner = (key, title, count, hint, children) => (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <button onClick={() => setExpandedSetupCats(prev => ({...prev, [key]: !prev[key]}))}
                className="w-full p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center gap-4 hover:bg-slate-100 transition-colors text-left">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg text-slate-900 font-medium">{title}</h2>
                        {count != null && (
                            <span className="bg-slate-200 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">{count}</span>
                        )}
                    </div>
                    {hint && <p className="text-xs text-slate-400 mt-0.5 truncate">{hint}</p>}
                </div>
                <span className="text-slate-500 shrink-0">{expandedSetupCats[key] ? <IconChevronDown size={20}/> : <IconChevronRight size={20}/>}</span>
            </button>
            {expandedSetupCats[key] && children}
        </div>
    );

    return (
        <div className="flex-1 overflow-auto p-8 bg-slate-50">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* ── Basic Tasks ─────────────────────────────────────── */}
                {section('basic', 'Basic Tasks', { count: hardcodedBasicTasks.length, hint: 'Fest eingebaute Standard-Tasks (z. B. Office) – immer aktiv.' }, (
                    <div>
                        <div className="p-4 flex gap-2 border-b border-slate-200">
                            <input type="text" value={newBasicTask}
                                onChange={e => setNewBasicTask(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addBasicTask()}
                                placeholder={t('cats.newBasicTask')}
                                className="flex-1 p-2 border border-slate-300 rounded text-sm"/>
                            <button onClick={addBasicTask}
                                className="bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700">
                                {t('btn.add')}
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-200">
                            {hardcodedBasicTasks.map(task => (
                                <li key={task} className="p-4 flex justify-between items-center gap-3 text-sm">
                                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                        <span className="text-slate-800 font-medium">{task}</span>
                                        <span className="text-xs bg-gea-50 text-gea-700 border border-gea-200 px-1.5 py-0.5 rounded flex items-center gap-1"><IconPin size={10}/>{t('cats.permanent')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button onClick={() => setBasicInactive(task)}
                                            className="px-2 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100">
                                            {t('cats.setInactive')}
                                        </button>
                                    </div>
                                </li>
                            ))}
                            {hardcodedBasicTasks.length === 0 && <li className="p-6 text-sm text-slate-400 text-center">{t('cats.noBasicTasks')}</li>}
                        </ul>
                    </div>
                ))}

                {/* ── Other Tasks (user-created) ──────────────────────── */}
                {section('other', 'Other Tasks', { count: otherTasks.length, hint: 'Selbst erstellte Tasks – erscheinen in der Planung unter „Other".' }, (
                    <div>
                        <div className="p-4 flex gap-2 border-b border-slate-200">
                            <input type="text" value={newOtherTask}
                                onChange={e => setNewOtherTask(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addOtherTask()}
                                placeholder={t('cats.newOtherTask')}
                                className="flex-1 p-2 border border-slate-300 rounded text-sm"/>
                            <button onClick={addOtherTask}
                                className="bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700">
                                {t('btn.add')}
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-200">
                            {otherTasks.map(task => {
                                const meta = basicTasksMeta?.[task] || {};
                                const isPerm = meta.permanent !== false;
                                const weeksLeft = !isPerm && meta.createdAt
                                    ? Math.max(0, BASIC_TASK_EXPIRY_WEEKS - Math.floor((Date.now() - new Date(meta.createdAt).getTime()) / (7*24*60*60*1000)))
                                    : null;
                                return (
                                    <li key={task} className="p-4 flex justify-between items-center gap-3 text-sm">
                                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                            <span className="text-slate-800 font-medium">{task}</span>
                                            {isPerm
                                                ? <span className="text-xs bg-gea-50 text-gea-700 border border-gea-200 px-1.5 py-0.5 rounded flex items-center gap-1"><IconPin size={10}/>{t('cats.permanent')}</span>
                                                : weeksLeft !== null && <span className="text-xs text-slate-400">({t('cats.expiresIn', { n: weeksLeft })})</span>
                                            }
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {renderColorPicker(task)}
                                            <button
                                                onClick={() => setBasicTasksMeta(prev => ({...prev, [task]: {...(prev[task]||{}), permanent: !isPerm}}))}
                                                className={`px-2 py-1 text-xs border rounded flex items-center gap-1 ${isPerm ? 'bg-gea-50 text-gea-700 border-gea-200 hover:bg-gea-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                                <IconPin size={10}/>{isPerm ? t('cats.permanent') : t('cats.temporary')}
                                            </button>
                                            <button onClick={() => setBasicInactive(task)}
                                                className="px-2 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100">
                                                {t('cats.setInactive')}
                                            </button>
                                            {!isPerm && (
                                                <button onClick={() => { setBasicTasks(prev => prev.filter(t => t !== task)); setBasicTasksMeta(prev => { const n = {...prev}; delete n[task]; return n; }); }}
                                                    className="text-rose-500 hover:text-rose-700">
                                                    <IconX size={14}/>
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                            {otherTasks.length === 0 && <li className="p-6 text-sm text-slate-400 text-center">{t('cats.noOtherTasks')}</li>}
                        </ul>
                    </div>
                ))}

                {/* ── Support Tasks ───────────────────────────────────── */}
                {section('support', 'Support', { count: activeSupportTasks.length, hint: 'Support-Einsatzarten (24/7, CRM) mit fester Farbkennung.' }, (
                    <ul className="divide-y divide-slate-200">
                        {activeSupportTasks.map(task => {
                            const sc = SUPPORT_CHIP_COLORS[task] || {};
                            return (
                                <li key={task} className="p-4 flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-3 h-3 rounded-full ${sc.dot || 'bg-slate-400'}`}></span>
                                        <span className="font-medium text-slate-800">{task}</span>
                                        <span className="text-xs bg-gea-50 text-gea-700 border border-gea-200 px-1.5 py-0.5 rounded flex items-center gap-1"><IconPin size={10}/>{t('cats.permanent')}</span>
                                    </div>
                                    <button onClick={() => setInactiveSupportTasks(prev => [...(prev||[]), task])}
                                        className="px-2.5 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100">
                                        {t('cats.setInactive')}
                                    </button>
                                </li>
                            );
                        })}
                        {activeSupportTasks.length === 0 &&
                            <li className="p-6 text-sm text-slate-400 text-center">{t('cats.allSupportInactive')}</li>}
                    </ul>
                ))}

                {/* ── Training Tasks ──────────────────────────────────── */}
                {section('training', 'Trainings', { count: activeTrainingTasks.length + activeCustomTraining.length, hint: 'Standard- und eigene Trainings für den Planungsdialog.' }, (
                    <div>
                        <div className="p-4 flex gap-2 border-b border-slate-200">
                            <input type="text" value={newTrainingTask}
                                onChange={e => setNewTrainingTask(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { const t = newTrainingTask.trim(); if (t && !TRAINING_TASKS.includes(t) && !(customTrainingTasks||[]).includes(t)) { setCustomTrainingTasks(prev => [...(prev||[]), t]); setNewTrainingTask(''); } } }}
                                placeholder={t('cats.newTraining')}
                                className="flex-1 p-2 border border-slate-300 rounded text-sm"/>
                            <button onClick={() => { const t = newTrainingTask.trim(); if (t && !TRAINING_TASKS.includes(t) && !(customTrainingTasks||[]).includes(t)) { setCustomTrainingTasks(prev => [...(prev||[]), t]); setNewTrainingTask(''); } }}
                                className="bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700">
                                {t('btn.add')}
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-200">
                            {activeTrainingTasks.map(task => (
                                <li key={task} className="p-4 flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                                        <span className="font-medium text-slate-800">{task}</span>
                                        <span className="text-xs bg-gea-50 text-gea-700 border border-gea-200 px-1.5 py-0.5 rounded flex items-center gap-1"><IconPin size={10}/>{t('cats.permanent')}</span>
                                    </div>
                                    <button onClick={() => setInactiveTrainingTasks(prev => [...(prev||[]), task])}
                                        className="px-2.5 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100">
                                        {t('cats.setInactive')}
                                    </button>
                                </li>
                            ))}
                            {activeCustomTraining.map(task => (
                                <li key={task} className="p-4 flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                                        <span className="font-medium text-slate-800">{task}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setInactiveTrainingTasks(prev => [...(prev||[]), task])}
                                            className="px-2.5 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100">
                                            {t('cats.setInactive')}
                                        </button>
                                        <button onClick={() => setCustomTrainingTasks(prev => (prev||[]).filter(t => t !== task))}
                                            className="text-rose-500 hover:text-rose-700"><IconX size={16}/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}

                {/* ── Abwesenheiten ───────────────────────────────────── */}
                {section('offtime', t('cats.section.absences'), { count: activeOfftimeTasks.length, hint: 'Urlaub, Krankheit, Gleitzeit usw. – blockieren Kapazität.' }, (
                    <div>
                        <div className="p-4 flex gap-2 border-b border-slate-200">
                            <input type="text" value={newOfftimeTask}
                                onChange={e => setNewOfftimeTask(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && newOfftimeTask.trim() && !offtimeTasks.includes(newOfftimeTask.trim())) { setOfftimeTasks([...offtimeTasks, newOfftimeTask.trim()]); setNewOfftimeTask(''); } }}
                                placeholder={t('cats.newAbsenceType')}
                                className="flex-1 p-2 border border-slate-300 rounded text-sm"/>
                            <button onClick={() => { if (newOfftimeTask.trim() && !offtimeTasks.includes(newOfftimeTask.trim())) { setOfftimeTasks([...offtimeTasks, newOfftimeTask.trim()]); setNewOfftimeTask(''); } }}
                                className="bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700">
                                {t('btn.add')}
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-200">
                            {activeOfftimeTasks.map(task => (
                                <li key={task} className="p-4 flex justify-between items-center text-sm">
                                    <span className="text-slate-800">{task}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setInactiveOfftimeTasks(prev => [...(prev||[]), { name: task }])}
                                            className="px-2.5 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100">
                                            {t('cats.setInactive')}
                                        </button>
                                        <button onClick={() => setOfftimeTasks(offtimeTasks.filter(t2 => t2 !== task))}
                                            className="text-rose-500 hover:text-rose-700"><IconX size={16}/></button>
                                    </div>
                                </li>
                            ))}
                            {activeOfftimeTasks.length === 0 &&
                                <li className="p-6 text-sm text-slate-400 text-center">{t('cats.noAbsenceTypes')}</li>}
                        </ul>
                    </div>
                ))}

                {/* ── Mitarbeiter-Kategorien ──────────────────────────── */}
                {section('empCats', t('cats.section.empCats'), { count: empCategories.length, hint: 'Teams – gruppieren Mitarbeiter in allen Planungsansichten.' }, (
                    <div>
                        <div className="p-4 flex gap-2 border-b border-slate-200">
                            <input type="text" value={newEmpCat}
                                onChange={e => setNewEmpCat(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addEmpCat(); }}
                                placeholder={t('cats.newEmpCat')}
                                className="flex-1 p-2 border border-slate-300 rounded text-sm"/>
                            <button onClick={addEmpCat}
                                className="bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700">
                                {t('btn.add')}
                            </button>
                        </div>
                        {empCatError && (
                            <div className="px-4 py-2 text-xs text-rose-600 border-b border-slate-200">{empCatError}</div>
                        )}
                        <ul className="divide-y divide-slate-100">
                            {empCategories.map(cat => (
                                <li key={cat} className="px-4 py-3 flex justify-between items-center text-sm">
                                    <span className="text-slate-800">{cat}</span>
                                    <button onClick={() => setEmpCategories(empCategories.filter(c => c !== cat))}
                                        className="text-rose-500 hover:text-rose-700"><IconX size={16}/></button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}

                {/* ── Projekt-Kategorien ──────────────────────────────── */}
                {section('projCats', t('cats.section.projCats'), { count: projCategories.length, hint: 'Gruppieren Projekte in Übersicht und Verwaltung.' }, (
                    <div>
                        <div className="p-4 flex gap-2 border-b border-slate-200">
                            <input type="text" value={newProjCat}
                                onChange={e => setNewProjCat(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && newProjCat.trim() && !projCategories.includes(newProjCat.trim())) { setProjCategories([...projCategories, newProjCat.trim()]); setNewProjCat(''); } }}
                                placeholder={t('cats.newProjCat')}
                                className="flex-1 p-2 border border-slate-300 rounded text-sm"/>
                            <button onClick={() => { if (newProjCat.trim() && !projCategories.includes(newProjCat.trim())) { setProjCategories([...projCategories, newProjCat.trim()]); setNewProjCat(''); } }}
                                className="bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700">
                                {t('btn.add')}
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-100">
                            {projCategories.map(cat => (
                                <li key={cat} className="px-4 py-3 flex justify-between items-center text-sm">
                                    <span className="text-slate-800">{cat}</span>
                                    <button onClick={() => setProjCategories(projCategories.filter(c => c !== cat))}
                                        className="text-rose-500 hover:text-rose-700"><IconX size={16}/></button>
                                </li>
                            ))}
                            {projCategories.length === 0 && <li className="p-6 text-sm text-slate-400 text-center">{t('cats.noProjCategories')}</li>}
                        </ul>
                    </div>
                ))}

                {/* ── Projekt-Typen ──────────────────────────────────── */}
                {section('projTypes', 'Projekt-Typen', { count: (projTypes||[]).length, hint: 'Anlagentyp im Projekt-Formular und im Projektlabel (z. B. MW).' }, (
                    <div>
                        <div className="p-4 flex gap-2 border-b border-slate-200">
                            <input type="text" value={newProjType}
                                onChange={e => setNewProjType(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addProjType()}
                                placeholder="Neuer Projekttyp"
                                className="flex-1 p-2 border border-slate-300 rounded text-sm"/>
                            <button onClick={addProjType}
                                className="bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700">
                                {t('btn.add')}
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-100">
                            {(projTypes||[]).map(typ => (
                                <li key={typ} className="px-4 py-3 flex justify-between items-center text-sm">
                                    <span className="text-slate-800">{typ}</span>
                                    <button onClick={() => setProjTypes(prev => (prev||[]).filter(x => x !== typ))}
                                        className="text-rose-500 hover:text-rose-700"><IconX size={16}/></button>
                                </li>
                            ))}
                            {(projTypes||[]).length === 0 && <li className="p-6 text-sm text-slate-400 text-center">Noch keine Projekttypen definiert.</li>}
                        </ul>
                    </div>
                ))}

                {/* ── Spesen-Kategorien (Import) ──────────────────────── */}
                {section('expenseCats', t('cats.section.expense'), { count: expCats.length, hint: 'Keyword-Zuordnung für den Spesen-Import – umbenenn- und erweiterbar.' }, (
                    <div>
                        <p className="px-4 pt-3 pb-2 text-xs text-slate-500">{t('cats.expenseHint')}</p>
                        <ul className="divide-y divide-slate-100">
                            {expCats.map(cat => {
                                const cfg = COST_LINE_TYPES[cat.lineType] || COST_LINE_TYPES.other;
                                const isFallback = cat.id === 'other';
                                return (
                                    <li key={cat.id} className="px-4 py-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${cfg.chip}`}>{cfg.invoiceLabel}</span>
                                            {expEditingId === cat.id ? (
                                                <input type="text" value={expEditLabel} autoFocus
                                                    onChange={e => setExpEditLabel(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') saveExpLabel(cat.id); if (e.key === 'Escape') setExpEditingId(null); }}
                                                    onBlur={() => saveExpLabel(cat.id)}
                                                    className="p-1.5 border border-slate-400 rounded text-sm font-medium"/>
                                            ) : (
                                                <span className="text-sm font-medium text-slate-800">{cat.label}</span>
                                            )}
                                            {isFallback && <span className="text-xs text-slate-400">({t('cats.expenseFallback')})</span>}
                                            {!cat.builtin && (
                                                <select value={cat.lineType} onChange={e => setExpBucket(cat.id, e.target.value)}
                                                    title={t('cats.expenseBucket')}
                                                    className="text-xs p-1 border border-slate-300 rounded bg-white text-slate-600">
                                                    {EXP_BUCKETS.map(b => <option key={b} value={b}>{t('cats.expenseBucket')}: {COST_LINE_TYPES[b].invoiceLabel}</option>)}
                                                </select>
                                            )}
                                            <div className="ml-auto flex items-center gap-1 shrink-0">
                                                <button onClick={() => { setExpEditingId(cat.id); setExpEditLabel(cat.label); }}
                                                    className="px-2 py-1 text-xs rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700">{t('btn.edit')}</button>
                                                {!cat.builtin && (
                                                    <button onClick={() => removeExpCategory(cat.id)}
                                                        className="text-rose-500 hover:text-rose-700 p-1"><IconX size={15}/></button>
                                                )}
                                            </div>
                                        </div>
                                        {!isFallback && (
                                            <div className="flex flex-wrap items-center gap-1.5 pl-1">
                                                {cat.keywords.map(kw => (
                                                    <span key={kw} className="inline-flex items-center gap-1 text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                                        {kw}
                                                        <button onClick={() => removeExpKeyword(cat.id, kw)}
                                                            className="text-slate-400 hover:text-rose-600 leading-none">×</button>
                                                    </span>
                                                ))}
                                                <input type="text" value={expKeywordInputs[cat.id] || ''}
                                                    onChange={e => setExpKeywordInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                                    onKeyDown={e => e.key === 'Enter' && addExpKeyword(cat.id)}
                                                    placeholder={t('cats.expenseNewKeyword')}
                                                    className="text-xs p-1.5 border border-dashed border-slate-300 rounded-full w-36 focus:border-gea-400 focus:outline-none"/>
                                                <button onClick={() => addExpKeyword(cat.id)}
                                                    className="text-xs text-gea-600 font-medium hover:text-gea-700">{t('btn.add')}</button>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="p-4 border-t border-slate-200 flex gap-2 flex-wrap items-center bg-slate-50/50">
                            <input type="text" value={newExpCatLabel}
                                onChange={e => setNewExpCatLabel(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addExpCategory()}
                                placeholder={t('cats.expenseNewCat')}
                                className="flex-1 min-w-40 p-2 border border-slate-300 rounded text-sm"/>
                            <select value={newExpCatType} onChange={e => setNewExpCatType(e.target.value)}
                                className="p-2 border border-slate-300 rounded text-sm bg-white text-slate-600">
                                {EXP_BUCKETS.map(b => <option key={b} value={b}>{t('cats.expenseBucket')}: {COST_LINE_TYPES[b].invoiceLabel}</option>)}
                            </select>
                            <button onClick={addExpCategory}
                                className="bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700">
                                {t('btn.add')}
                            </button>
                        </div>
                    </div>
                ))}

                {/* ── Inaktiv (Sammelpunkt) ───────────────────────────── */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <button onClick={() => setInactiveOpen(o => !o)}
                        className="w-full p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg text-slate-900 font-medium">{t('cats.inactive')}</h2>
                            {totalInactive > 0 && (
                                <span className="bg-slate-200 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">{totalInactive}</span>
                            )}
                        </div>
                        <span className="text-slate-500">{inactiveOpen ? <IconChevronDown size={20}/> : <IconChevronRight size={20}/>}</span>
                    </button>
                    {inactiveOpen && (
                        <div>
                            {totalInactive === 0 ? (
                                <p className="p-6 text-sm text-slate-400 text-center">{t('cats.noInactive')}</p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {inactiveBasicTasks.map(item => (
                                        <li key={item.name} className="px-4 py-3 flex items-center gap-3 text-sm">
                                            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">Basic</span>
                                            <span className="flex-1 text-slate-700">{item.name}</span>
                                            <span className="text-xs text-slate-400 shrink-0">{t('cats.since')} {new Date(item.createdAt).toLocaleDateString('de-DE')}</span>
                                            <button onClick={() => reactivateBasic(item)}
                                                className="px-2.5 py-1 text-xs bg-gea-50 text-gea-700 border border-gea-200 rounded hover:bg-gea-100 shrink-0">
                                                {t('cats.reactivate')}
                                            </button>
                                            <button onClick={() => setInactiveBasicTasks(prev => prev.filter(t => t.name !== item.name))}
                                                className="text-rose-400 hover:text-rose-600 shrink-0"><IconX size={14}/></button>
                                        </li>
                                    ))}
                                    {(inactiveOfftimeTasks||[]).map(item => (
                                        <li key={item.name} className="px-4 py-3 flex items-center gap-3 text-sm">
                                            <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded shrink-0">Offtime</span>
                                            <span className="flex-1 text-slate-700">{item.name}</span>
                                            <button onClick={() => setInactiveOfftimeTasks(prev => prev.filter(t => t.name !== item.name))}
                                                className="px-2.5 py-1 text-xs bg-gea-50 text-gea-700 border border-gea-200 rounded hover:bg-gea-100 shrink-0">
                                                {t('cats.reactivate')}
                                            </button>
                                        </li>
                                    ))}
                                    {(inactiveSupportTasks||[]).map(task => (
                                        <li key={task} className="px-4 py-3 flex items-center gap-3 text-sm">
                                            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded shrink-0">Support</span>
                                            <span className="flex-1 text-slate-700">{task}</span>
                                            <button onClick={() => setInactiveSupportTasks(prev => prev.filter(t => t !== task))}
                                                className="px-2.5 py-1 text-xs bg-gea-50 text-gea-700 border border-gea-200 rounded hover:bg-gea-100 shrink-0">
                                                {t('cats.reactivate')}
                                            </button>
                                        </li>
                                    ))}
                                    {(inactiveTrainingTasks||[]).map(task => (
                                        <li key={task} className="px-4 py-3 flex items-center gap-3 text-sm">
                                            <span className="text-xs bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded shrink-0">Training</span>
                                            <span className="flex-1 text-slate-700">{task}</span>
                                            <button onClick={() => setInactiveTrainingTasks(prev => prev.filter(t => t !== task))}
                                                className="px-2.5 py-1 text-xs bg-gea-50 text-gea-700 border border-gea-200 rounded hover:bg-gea-100 shrink-0">
                                                {t('cats.reactivate')}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
