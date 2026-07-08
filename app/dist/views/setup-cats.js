const SetupCatsView = ({
  s,
  h
}) => {
  const {
    useState
  } = React;
  const {
    empCategories,
    projCategories,
    projTypes,
    basicTasks,
    basicTasksMeta,
    inactiveBasicTasks,
    offtimeTasks,
    inactiveOfftimeTasks,
    inactiveSupportTasks,
    inactiveTrainingTasks,
    customTrainingTasks,
    expandedSetupCats,
    newEmpCat,
    newProjCat,
    newBasicTask,
    newOfftimeTask,
    expenseCategories,
    teamKst,
    t
  } = s;
  const {
    setEmpCategories,
    setProjCategories,
    setProjTypes,
    setBasicTasks,
    setBasicTasksMeta,
    setInactiveBasicTasks,
    setOfftimeTasks,
    setInactiveOfftimeTasks,
    setInactiveSupportTasks,
    setInactiveTrainingTasks,
    setCustomTrainingTasks,
    setExpandedSetupCats,
    setNewEmpCat,
    setNewProjCat,
    setNewBasicTask,
    setNewOfftimeTask,
    setExpenseCategories,
    setTeamKst
  } = h;
  const [newTrainingTask, setNewTrainingTask] = useState('');
  const [newOtherTask, setNewOtherTask] = useState('');
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [newProjType, setNewProjType] = useState('');
  const addProjType = () => {
    const v = newProjType.trim();
    if (!v || (projTypes || []).includes(v)) return;
    setProjTypes(prev => [...(prev || []), v]);
    setNewProjType('');
  };
  // Separate hardcoded Basic Tasks (no meta) from user-created Other Tasks (with meta).
  const hardcodedBasicTasks = basicTasks.filter(t => !basicTasksMeta?.[t]);
  const otherTasks = basicTasks.filter(t => basicTasksMeta?.[t]);

  // O(1) membership checks for the inactive lists; the source arrays are
  // hit by .filter() in multiple places below.
  const inactiveSupportSet = React.useMemo(() => new Set(inactiveSupportTasks || []), [inactiveSupportTasks]);
  const inactiveTrainingSet = React.useMemo(() => new Set(inactiveTrainingTasks || []), [inactiveTrainingTasks]);
  const inactiveOfftimeSet = React.useMemo(() => new Set((inactiveOfftimeTasks || []).map(x => x.name)), [inactiveOfftimeTasks]);
  const activeSupportTasks = React.useMemo(() => SUPPORT_TASKS.filter(t => !inactiveSupportSet.has(t)), [inactiveSupportSet]);
  const activeTrainingTasks = React.useMemo(() => TRAINING_TASKS.filter(t => !inactiveTrainingSet.has(t)), [inactiveTrainingSet]);
  const activeCustomTraining = React.useMemo(() => (customTrainingTasks || []).filter(t => !inactiveTrainingSet.has(t)), [customTrainingTasks, inactiveTrainingSet]);
  const activeOfftimeTasks = React.useMemo(() => offtimeTasks.filter(t => !inactiveOfftimeSet.has(t)), [offtimeTasks, inactiveOfftimeSet]);

  // Mitarbeiter-Kategorien werden zu Team-Dateinamen auf SharePoint/FS –
  // ungültige Zeichen würden den Sync brechen (siehe isValidTeamName).
  const [empCatError, setEmpCatError] = useState('');
  const addEmpCat = () => {
    const v = newEmpCat.trim();
    if (!v || empCategories.includes(v)) return;
    if (!isValidTeamName(v)) {
      setEmpCatError(t('cats.invalidTeamName'));
      return;
    }
    setEmpCatError('');
    setEmpCategories([...empCategories, v]);
    setNewEmpCat('');
  };

  // ── Spesen-Kategorien (Import-Keyword-Mapping) ──────────────────────────
  // Es wird immer die normalisierte VOLLE Liste persistiert (inkl. Built-ins
  // mit ggf. geänderten Labels/Keywords), damit die Match-Reihenfolge und
  // alle Edits deterministisch aus category-defs.json reproduzierbar sind.
  const expCats = normalizeExpenseCategories(expenseCategories);
  const updateExpCats = mutator => setExpenseCategories(mutator(normalizeExpenseCategories(expenseCategories)));
  const [expKeywordInputs, setExpKeywordInputs] = useState({}); // { catId: text }
  const [expEditingId, setExpEditingId] = useState(null);
  const [expEditLabel, setExpEditLabel] = useState('');
  const [newExpCatLabel, setNewExpCatLabel] = useState('');
  const [newExpCatType, setNewExpCatType] = useState('other');
  const EXP_BUCKETS = ['travel', 'accommodation', 'meals', 'other'];
  const addExpKeyword = catId => {
    const kw = (expKeywordInputs[catId] || '').trim().toLowerCase();
    if (!kw) return;
    updateExpCats(cats => cats.map(c => c.id === catId && !c.keywords.includes(kw) ? {
      ...c,
      keywords: [...c.keywords, kw]
    } : c));
    setExpKeywordInputs(prev => ({
      ...prev,
      [catId]: ''
    }));
  };
  const removeExpKeyword = (catId, kw) => updateExpCats(cats => cats.map(c => c.id === catId ? {
    ...c,
    keywords: c.keywords.filter(k => k !== kw)
  } : c));
  const saveExpLabel = catId => {
    const label = expEditLabel.trim();
    if (label) updateExpCats(cats => cats.map(c => c.id === catId ? {
      ...c,
      label
    } : c));
    setExpEditingId(null);
  };
  const addExpCategory = () => {
    const label = newExpCatLabel.trim();
    if (!label || expCats.some(c => c.label.toLowerCase() === label.toLowerCase())) return;
    const cat = {
      id: makeId('exp'),
      label,
      lineType: newExpCatType,
      keywords: [],
      builtin: false
    };
    // Vor dem Fallback 'other' einfügen, damit die Keywords greifen
    updateExpCats(cats => [...cats.filter(c => c.id !== 'other'), cat, ...cats.filter(c => c.id === 'other')]);
    setNewExpCatLabel('');
  };
  const removeExpCategory = catId => updateExpCats(cats => cats.filter(c => c.id !== catId));
  const setExpBucket = (catId, lineType) => updateExpCats(cats => cats.map(c => c.id === catId ? {
    ...c,
    lineType
  } : c));
  const addOtherTask = () => {
    const t = newOtherTask.trim();
    if (!t) return;
    if (basicTasks.includes(t)) return;
    setBasicTasks(prev => [...prev, t]);
    setBasicTasksMeta(prev => ({
      ...prev,
      [t]: {
        createdAt: new Date().toISOString(),
        permanent: false
      }
    }));
    setNewOtherTask('');
  };
  const COLOR_SWATCHES = [null, ...PROJECT_COLORS.map(c => c.id)];
  const renderSwatch = colorId => {
    if (!colorId) return /*#__PURE__*/React.createElement("span", {
      className: "w-4 h-4 rounded-full border-2 border-slate-300 bg-white inline-block"
    });
    const c = resolveProjectColor(colorId);
    return /*#__PURE__*/React.createElement("span", {
      className: `w-4 h-4 rounded-full ${c.dot} inline-block`
    });
  };
  const renderColorPicker = taskName => /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1 items-center"
  }, COLOR_SWATCHES.map((cid, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    title: cid || t('cats.noColor'),
    onClick: () => setBasicTasksMeta(prev => ({
      ...prev,
      [taskName]: {
        ...(prev[taskName] || {}),
        color: cid || undefined
      }
    })),
    className: `w-5 h-5 rounded-full border-2 transition-all ${(basicTasksMeta[taskName]?.color || null) === cid ? 'border-gea-600 scale-110' : 'border-transparent hover:border-slate-400'} ${cid ? resolveProjectColor(cid).dot : 'bg-white border-slate-300'}`
  })));
  const setBasicInactive = task => {
    const meta = basicTasksMeta?.[task];
    setBasicTasks(prev => prev.filter(t => t !== task));
    setInactiveBasicTasks(prev => [...prev, {
      name: task,
      createdAt: meta?.createdAt || new Date().toISOString()
    }]);
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
  const reactivateBasic = item => {
    setBasicTasks(prev => [...prev, item.name]);
    setBasicTasksMeta(prev => ({
      ...prev,
      [item.name]: {
        ...(prev[item.name] || {}),
        createdAt: item.createdAt || new Date().toISOString()
      }
    }));
    setInactiveBasicTasks(prev => prev.filter(t => t.name !== item.name));
  };

  // Aggregate count for all inactive items
  const totalInactive = inactiveBasicTasks.length + (inactiveOfftimeTasks || []).length + (inactiveSupportTasks || []).length + (inactiveTrainingTasks || []).length;

  // Sektion mit optionalem Eintrags-Zähler und Kurzbeschreibung – der Nutzer
  // sieht auf einen Blick, was drinsteckt, ohne jede Sektion aufzuklappen.
  const section = (key, title, optsOrChildren, maybeChildren) => {
    // Flexible Signatur: section(key, title, children) ODER
    // section(key, title, { count, hint }, children)
    const hasOpts = maybeChildren !== undefined;
    const {
      count,
      hint
    } = hasOpts ? optsOrChildren : {};
    const children = hasOpts ? maybeChildren : optsOrChildren;
    return sectionInner(key, title, count, hint, children);
  };
  const sectionInner = (key, title, count, hint, children) => /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setExpandedSetupCats(prev => ({
      ...prev,
      [key]: !prev[key]
    })),
    className: "w-full p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center gap-4 hover:bg-slate-100 transition-colors text-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-lg text-slate-900 font-medium"
  }, title), count != null && /*#__PURE__*/React.createElement("span", {
    className: "bg-slate-200 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full"
  }, count)), hint && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 mt-0.5 truncate"
  }, hint)), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-500 shrink-0"
  }, expandedSetupCats[key] ? /*#__PURE__*/React.createElement(IconChevronDown, {
    size: 20
  }) : /*#__PURE__*/React.createElement(IconChevronRight, {
    size: 20
  }))), expandedSetupCats[key] && children);
  return /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-auto p-8 bg-slate-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-7xl mx-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid lg:grid-cols-2 gap-6 items-start"
  }, /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, section('basic', 'Basic Tasks', {
    count: hardcodedBasicTasks.length,
    hint: 'Fest eingebaute Standard-Tasks (z. B. Office) – immer aktiv.'
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "p-4 flex gap-2 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newBasicTask,
    onChange: e => setNewBasicTask(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addBasicTask(),
    placeholder: t('cats.newBasicTask'),
    className: "flex-1 p-2 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addBasicTask,
    className: "bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700"
  }, t('btn.add'))), /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-200"
  }, hardcodedBasicTasks.map(task => /*#__PURE__*/React.createElement("li", {
    key: task,
    className: "p-4 flex justify-between items-center gap-3 text-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 min-w-0 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800 font-medium"
  }, task), /*#__PURE__*/React.createElement("span", {
    className: "text-xs bg-gea-50 text-gea-700 border border-gea-200 px-1.5 py-0.5 rounded flex items-center gap-1"
  }, /*#__PURE__*/React.createElement(IconPin, {
    size: 10
  }), t('cats.permanent'))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 flex-shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setBasicInactive(task),
    className: "px-2 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100"
  }, t('cats.setInactive'))))), hardcodedBasicTasks.length === 0 && /*#__PURE__*/React.createElement("li", {
    className: "p-6 text-sm text-slate-400 text-center"
  }, t('cats.noBasicTasks'))))), section('other', 'Other Tasks', {
    count: otherTasks.length,
    hint: 'Selbst erstellte Tasks – erscheinen in der Planung unter „Other".'
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "p-4 flex gap-2 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newOtherTask,
    onChange: e => setNewOtherTask(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addOtherTask(),
    placeholder: t('cats.newOtherTask'),
    className: "flex-1 p-2 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addOtherTask,
    className: "bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700"
  }, t('btn.add'))), /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-200"
  }, otherTasks.map(task => {
    const meta = basicTasksMeta?.[task] || {};
    const isPerm = meta.permanent !== false;
    const weeksLeft = !isPerm && meta.createdAt ? Math.max(0, BASIC_TASK_EXPIRY_WEEKS - Math.floor((Date.now() - new Date(meta.createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000))) : null;
    return /*#__PURE__*/React.createElement("li", {
      key: task,
      className: "p-4 flex justify-between items-center gap-3 text-sm"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 min-w-0 flex-wrap"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-800 font-medium"
    }, task), isPerm ? /*#__PURE__*/React.createElement("span", {
      className: "text-xs bg-gea-50 text-gea-700 border border-gea-200 px-1.5 py-0.5 rounded flex items-center gap-1"
    }, /*#__PURE__*/React.createElement(IconPin, {
      size: 10
    }), t('cats.permanent')) : weeksLeft !== null && /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-400"
    }, "(", t('cats.expiresIn', {
      n: weeksLeft
    }), ")")), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 flex-shrink-0"
    }, renderColorPicker(task), /*#__PURE__*/React.createElement("button", {
      onClick: () => setBasicTasksMeta(prev => ({
        ...prev,
        [task]: {
          ...(prev[task] || {}),
          permanent: !isPerm
        }
      })),
      className: `px-2 py-1 text-xs border rounded flex items-center gap-1 ${isPerm ? 'bg-gea-50 text-gea-700 border-gea-200 hover:bg-gea-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`
    }, /*#__PURE__*/React.createElement(IconPin, {
      size: 10
    }), isPerm ? t('cats.permanent') : t('cats.temporary')), /*#__PURE__*/React.createElement("button", {
      onClick: () => setBasicInactive(task),
      className: "px-2 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100"
    }, t('cats.setInactive')), !isPerm && /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setBasicTasks(prev => prev.filter(t => t !== task));
        setBasicTasksMeta(prev => {
          const n = {
            ...prev
          };
          delete n[task];
          return n;
        });
      },
      className: "text-rose-500 hover:text-rose-700"
    }, /*#__PURE__*/React.createElement(IconX, {
      size: 14
    }))));
  }), otherTasks.length === 0 && /*#__PURE__*/React.createElement("li", {
    className: "p-6 text-sm text-slate-400 text-center"
  }, t('cats.noOtherTasks'))))), section('support', 'Support', {
    count: activeSupportTasks.length,
    hint: 'Support-Einsatzarten (24/7, CRM) mit fester Farbkennung.'
  }, /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-200"
  }, activeSupportTasks.map(task => {
    const sc = SUPPORT_CHIP_COLORS[task] || {};
    return /*#__PURE__*/React.createElement("li", {
      key: task,
      className: "p-4 flex justify-between items-center text-sm"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: `w-3 h-3 rounded-full ${sc.dot || 'bg-slate-400'}`
    }), /*#__PURE__*/React.createElement("span", {
      className: "font-medium text-slate-800"
    }, task), /*#__PURE__*/React.createElement("span", {
      className: "text-xs bg-gea-50 text-gea-700 border border-gea-200 px-1.5 py-0.5 rounded flex items-center gap-1"
    }, /*#__PURE__*/React.createElement(IconPin, {
      size: 10
    }), t('cats.permanent'))), /*#__PURE__*/React.createElement("button", {
      onClick: () => setInactiveSupportTasks(prev => [...(prev || []), task]),
      className: "px-2.5 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100"
    }, t('cats.setInactive')));
  }), activeSupportTasks.length === 0 && /*#__PURE__*/React.createElement("li", {
    className: "p-6 text-sm text-slate-400 text-center"
  }, t('cats.allSupportInactive')))), section('training', 'Trainings', {
    count: activeTrainingTasks.length + activeCustomTraining.length,
    hint: 'Standard- und eigene Trainings für den Planungsdialog.'
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "p-4 flex gap-2 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newTrainingTask,
    onChange: e => setNewTrainingTask(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        const t = newTrainingTask.trim();
        if (t && !TRAINING_TASKS.includes(t) && !(customTrainingTasks || []).includes(t)) {
          setCustomTrainingTasks(prev => [...(prev || []), t]);
          setNewTrainingTask('');
        }
      }
    },
    placeholder: t('cats.newTraining'),
    className: "flex-1 p-2 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const t = newTrainingTask.trim();
      if (t && !TRAINING_TASKS.includes(t) && !(customTrainingTasks || []).includes(t)) {
        setCustomTrainingTasks(prev => [...(prev || []), t]);
        setNewTrainingTask('');
      }
    },
    className: "bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700"
  }, t('btn.add'))), /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-200"
  }, activeTrainingTasks.map(task => /*#__PURE__*/React.createElement("li", {
    key: task,
    className: "p-4 flex justify-between items-center text-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-3 h-3 rounded-full bg-sky-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-slate-800"
  }, task), /*#__PURE__*/React.createElement("span", {
    className: "text-xs bg-gea-50 text-gea-700 border border-gea-200 px-1.5 py-0.5 rounded flex items-center gap-1"
  }, /*#__PURE__*/React.createElement(IconPin, {
    size: 10
  }), t('cats.permanent'))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setInactiveTrainingTasks(prev => [...(prev || []), task]),
    className: "px-2.5 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100"
  }, t('cats.setInactive')))), activeCustomTraining.map(task => /*#__PURE__*/React.createElement("li", {
    key: task,
    className: "p-4 flex justify-between items-center text-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-3 h-3 rounded-full bg-sky-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-slate-800"
  }, task)), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setInactiveTrainingTasks(prev => [...(prev || []), task]),
    className: "px-2.5 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100"
  }, t('cats.setInactive')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCustomTrainingTasks(prev => (prev || []).filter(t => t !== task)),
    className: "text-rose-500 hover:text-rose-700"
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 16
  })))))))), section('offtime', t('cats.section.absences'), {
    count: activeOfftimeTasks.length,
    hint: 'Urlaub, Krankheit, Gleitzeit usw. – blockieren Kapazität.'
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "p-4 flex gap-2 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newOfftimeTask,
    onChange: e => setNewOfftimeTask(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && newOfftimeTask.trim() && !offtimeTasks.includes(newOfftimeTask.trim())) {
        setOfftimeTasks([...offtimeTasks, newOfftimeTask.trim()]);
        setNewOfftimeTask('');
      }
    },
    placeholder: t('cats.newAbsenceType'),
    className: "flex-1 p-2 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (newOfftimeTask.trim() && !offtimeTasks.includes(newOfftimeTask.trim())) {
        setOfftimeTasks([...offtimeTasks, newOfftimeTask.trim()]);
        setNewOfftimeTask('');
      }
    },
    className: "bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700"
  }, t('btn.add'))), /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-200"
  }, activeOfftimeTasks.map(task => /*#__PURE__*/React.createElement("li", {
    key: task,
    className: "p-4 flex justify-between items-center text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800"
  }, task), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setInactiveOfftimeTasks(prev => [...(prev || []), {
      name: task
    }]),
    className: "px-2.5 py-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100"
  }, t('cats.setInactive')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOfftimeTasks(offtimeTasks.filter(t2 => t2 !== task)),
    className: "text-rose-500 hover:text-rose-700"
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 16
  }))))), activeOfftimeTasks.length === 0 && /*#__PURE__*/React.createElement("li", {
    className: "p-6 text-sm text-slate-400 text-center"
  }, t('cats.noAbsenceTypes')))))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, section('empCats', t('cats.section.empCats'), {
    count: empCategories.length,
    hint: 'Teams – gruppieren Mitarbeiter in allen Planungsansichten.'
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "p-4 flex gap-2 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newEmpCat,
    onChange: e => setNewEmpCat(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') addEmpCat();
    },
    placeholder: t('cats.newEmpCat'),
    className: "flex-1 p-2 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addEmpCat,
    className: "bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700"
  }, t('btn.add'))), empCatError && /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-2 text-xs text-rose-600 border-b border-slate-200"
  }, empCatError), /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-100"
  }, empCategories.map(cat => /*#__PURE__*/React.createElement("li", {
    key: cat,
    className: "px-4 py-3 flex justify-between items-center gap-3 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800 flex-1"
  }, cat), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-1.5 text-xs text-slate-400"
  }, t('cats.kst'), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: (teamKst || {})[cat] || '',
    onChange: e => {
      const v = e.target.value;
      setTeamKst(prev => {
        const next = {
          ...(prev || {})
        };
        if (v.trim()) next[cat] = v.trim();else delete next[cat];
        return next;
      });
    },
    placeholder: t('cats.kstPlaceholder'),
    className: "w-24 p-1.5 border border-slate-300 rounded text-sm text-slate-800"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEmpCategories(empCategories.filter(c => c !== cat));
      // KST-Zuordnung des gelöschten Teams mit aufräumen
      setTeamKst(prev => {
        if (!prev || !(cat in prev)) return prev;
        const {
          [cat]: _gone,
          ...rest
        } = prev;
        return rest;
      });
    },
    className: "text-rose-500 hover:text-rose-700"
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 16
  }))))))), section('projCats', t('cats.section.projCats'), {
    count: projCategories.length,
    hint: 'Gruppieren Projekte in Übersicht und Verwaltung.'
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "p-4 flex gap-2 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newProjCat,
    onChange: e => setNewProjCat(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && newProjCat.trim() && !projCategories.includes(newProjCat.trim())) {
        setProjCategories([...projCategories, newProjCat.trim()]);
        setNewProjCat('');
      }
    },
    placeholder: t('cats.newProjCat'),
    className: "flex-1 p-2 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (newProjCat.trim() && !projCategories.includes(newProjCat.trim())) {
        setProjCategories([...projCategories, newProjCat.trim()]);
        setNewProjCat('');
      }
    },
    className: "bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700"
  }, t('btn.add'))), /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-100"
  }, projCategories.map(cat => /*#__PURE__*/React.createElement("li", {
    key: cat,
    className: "px-4 py-3 flex justify-between items-center text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800"
  }, cat), /*#__PURE__*/React.createElement("button", {
    onClick: () => setProjCategories(projCategories.filter(c => c !== cat)),
    className: "text-rose-500 hover:text-rose-700"
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 16
  })))), projCategories.length === 0 && /*#__PURE__*/React.createElement("li", {
    className: "p-6 text-sm text-slate-400 text-center"
  }, t('cats.noProjCategories'))))), section('projTypes', 'Projekt-Typen', {
    count: (projTypes || []).length,
    hint: 'Anlagentyp im Projekt-Formular und im Projektlabel (z. B. MW).'
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "p-4 flex gap-2 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newProjType,
    onChange: e => setNewProjType(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addProjType(),
    placeholder: "Neuer Projekttyp",
    className: "flex-1 p-2 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addProjType,
    className: "bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700"
  }, t('btn.add'))), /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-100"
  }, (projTypes || []).map(typ => /*#__PURE__*/React.createElement("li", {
    key: typ,
    className: "px-4 py-3 flex justify-between items-center text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800"
  }, typ), /*#__PURE__*/React.createElement("button", {
    onClick: () => setProjTypes(prev => (prev || []).filter(x => x !== typ)),
    className: "text-rose-500 hover:text-rose-700"
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 16
  })))), (projTypes || []).length === 0 && /*#__PURE__*/React.createElement("li", {
    className: "p-6 text-sm text-slate-400 text-center"
  }, "Noch keine Projekttypen definiert.")))), section('expenseCats', t('cats.section.expense'), {
    count: expCats.length,
    hint: 'Keyword-Zuordnung für den Spesen-Import – umbenenn- und erweiterbar.'
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "px-4 pt-3 pb-2 text-xs text-slate-500"
  }, t('cats.expenseHint')), /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-100"
  }, expCats.map(cat => {
    const cfg = COST_LINE_TYPES[cat.lineType] || COST_LINE_TYPES.other;
    const isFallback = cat.id === 'other';
    return /*#__PURE__*/React.createElement("li", {
      key: cat.id,
      className: "px-4 py-3 space-y-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: `text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${cfg.chip}`
    }, cfg.invoiceLabel), expEditingId === cat.id ? /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: expEditLabel,
      autoFocus: true,
      onChange: e => setExpEditLabel(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') saveExpLabel(cat.id);
        if (e.key === 'Escape') setExpEditingId(null);
      },
      onBlur: () => saveExpLabel(cat.id),
      className: "p-1.5 border border-slate-400 rounded text-sm font-medium"
    }) : /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-medium text-slate-800"
    }, cat.label), isFallback && /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-400"
    }, "(", t('cats.expenseFallback'), ")"), !cat.builtin && /*#__PURE__*/React.createElement("select", {
      value: cat.lineType,
      onChange: e => setExpBucket(cat.id, e.target.value),
      title: t('cats.expenseBucket'),
      className: "text-xs p-1 border border-slate-300 rounded bg-white text-slate-600"
    }, EXP_BUCKETS.map(b => /*#__PURE__*/React.createElement("option", {
      key: b,
      value: b
    }, t('cats.expenseBucket'), ": ", COST_LINE_TYPES[b].invoiceLabel))), /*#__PURE__*/React.createElement("div", {
      className: "ml-auto flex items-center gap-1 shrink-0"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setExpEditingId(cat.id);
        setExpEditLabel(cat.label);
      },
      className: "px-2 py-1 text-xs rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    }, t('btn.edit')), !cat.builtin && /*#__PURE__*/React.createElement("button", {
      onClick: () => removeExpCategory(cat.id),
      className: "text-rose-500 hover:text-rose-700 p-1"
    }, /*#__PURE__*/React.createElement(IconX, {
      size: 15
    })))), !isFallback && /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap items-center gap-1.5 pl-1"
    }, cat.keywords.map(kw => /*#__PURE__*/React.createElement("span", {
      key: kw,
      className: "inline-flex items-center gap-1 text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full"
    }, kw, /*#__PURE__*/React.createElement("button", {
      onClick: () => removeExpKeyword(cat.id, kw),
      className: "text-slate-400 hover:text-rose-600 leading-none"
    }, "\xD7"))), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: expKeywordInputs[cat.id] || '',
      onChange: e => setExpKeywordInputs(prev => ({
        ...prev,
        [cat.id]: e.target.value
      })),
      onKeyDown: e => e.key === 'Enter' && addExpKeyword(cat.id),
      placeholder: t('cats.expenseNewKeyword'),
      className: "text-xs p-1.5 border border-dashed border-slate-300 rounded-full w-36 focus:border-gea-400 focus:outline-none"
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => addExpKeyword(cat.id),
      className: "text-xs text-gea-600 font-medium hover:text-gea-700"
    }, t('btn.add'))));
  })), /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-t border-slate-200 flex gap-2 flex-wrap items-center bg-slate-50/50"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newExpCatLabel,
    onChange: e => setNewExpCatLabel(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addExpCategory(),
    placeholder: t('cats.expenseNewCat'),
    className: "flex-1 min-w-40 p-2 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("select", {
    value: newExpCatType,
    onChange: e => setNewExpCatType(e.target.value),
    className: "p-2 border border-slate-300 rounded text-sm bg-white text-slate-600"
  }, EXP_BUCKETS.map(b => /*#__PURE__*/React.createElement("option", {
    key: b,
    value: b
  }, t('cats.expenseBucket'), ": ", COST_LINE_TYPES[b].invoiceLabel))), /*#__PURE__*/React.createElement("button", {
    onClick: addExpCategory,
    className: "bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700"
  }, t('btn.add'))))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setInactiveOpen(o => !o),
    className: "w-full p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-lg text-slate-900 font-medium"
  }, t('cats.inactive')), totalInactive > 0 && /*#__PURE__*/React.createElement("span", {
    className: "bg-slate-200 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full"
  }, totalInactive)), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-500"
  }, inactiveOpen ? /*#__PURE__*/React.createElement(IconChevronDown, {
    size: 20
  }) : /*#__PURE__*/React.createElement(IconChevronRight, {
    size: 20
  }))), inactiveOpen && /*#__PURE__*/React.createElement("div", null, totalInactive === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "p-6 text-sm text-slate-400 text-center"
  }, t('cats.noInactive')) : /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-100"
  }, inactiveBasicTasks.map(item => /*#__PURE__*/React.createElement("li", {
    key: item.name,
    className: "px-4 py-3 flex items-center gap-3 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0"
  }, "Basic"), /*#__PURE__*/React.createElement("span", {
    className: "flex-1 text-slate-700"
  }, item.name), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400 shrink-0"
  }, t('cats.since'), " ", new Date(item.createdAt).toLocaleDateString('de-DE')), /*#__PURE__*/React.createElement("button", {
    onClick: () => reactivateBasic(item),
    className: "px-2.5 py-1 text-xs bg-gea-50 text-gea-700 border border-gea-200 rounded hover:bg-gea-100 shrink-0"
  }, t('cats.reactivate')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setInactiveBasicTasks(prev => prev.filter(t => t.name !== item.name)),
    className: "text-rose-400 hover:text-rose-600 shrink-0"
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 14
  })))), (inactiveOfftimeTasks || []).map(item => /*#__PURE__*/React.createElement("li", {
    key: item.name,
    className: "px-4 py-3 flex items-center gap-3 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded shrink-0"
  }, "Offtime"), /*#__PURE__*/React.createElement("span", {
    className: "flex-1 text-slate-700"
  }, item.name), /*#__PURE__*/React.createElement("button", {
    onClick: () => setInactiveOfftimeTasks(prev => prev.filter(t => t.name !== item.name)),
    className: "px-2.5 py-1 text-xs bg-gea-50 text-gea-700 border border-gea-200 rounded hover:bg-gea-100 shrink-0"
  }, t('cats.reactivate')))), (inactiveSupportTasks || []).map(task => /*#__PURE__*/React.createElement("li", {
    key: task,
    className: "px-4 py-3 flex items-center gap-3 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded shrink-0"
  }, "Support"), /*#__PURE__*/React.createElement("span", {
    className: "flex-1 text-slate-700"
  }, task), /*#__PURE__*/React.createElement("button", {
    onClick: () => setInactiveSupportTasks(prev => prev.filter(t => t !== task)),
    className: "px-2.5 py-1 text-xs bg-gea-50 text-gea-700 border border-gea-200 rounded hover:bg-gea-100 shrink-0"
  }, t('cats.reactivate')))), (inactiveTrainingTasks || []).map(task => /*#__PURE__*/React.createElement("li", {
    key: task,
    className: "px-4 py-3 flex items-center gap-3 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded shrink-0"
  }, "Training"), /*#__PURE__*/React.createElement("span", {
    className: "flex-1 text-slate-700"
  }, task), /*#__PURE__*/React.createElement("button", {
    onClick: () => setInactiveTrainingTasks(prev => prev.filter(t => t !== task)),
    className: "px-2.5 py-1 text-xs bg-gea-50 text-gea-700 border border-gea-200 rounded hover:bg-gea-100 shrink-0"
  }, t('cats.reactivate')))))))))));
};