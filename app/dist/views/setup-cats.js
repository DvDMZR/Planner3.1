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
    setNewOfftimeTask
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
  const section = (key, title, children) => /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setExpandedSetupCats(prev => ({
      ...prev,
      [key]: !prev[key]
    })),
    className: "w-full p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-lg text-slate-900 font-medium"
  }, title), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-500"
  }, expandedSetupCats[key] ? /*#__PURE__*/React.createElement(IconChevronDown, {
    size: 20
  }) : /*#__PURE__*/React.createElement(IconChevronRight, {
    size: 20
  }))), expandedSetupCats[key] && children);
  return /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-auto p-8 bg-slate-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-4xl mx-auto space-y-6"
  }, section('basic', 'Basic Tasks', /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
  }, t('cats.noBasicTasks'))))), section('other', 'Other Tasks', /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
  }, t('cats.noOtherTasks'))))), section('support', 'Support', /*#__PURE__*/React.createElement("ul", {
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
  }, t('cats.allSupportInactive')))), section('training', 'Trainings', /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
  })))))))), section('offtime', t('cats.section.absences'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
  }, t('cats.noAbsenceTypes'))))), section('empCats', t('cats.section.empCats'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "p-4 flex gap-2 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newEmpCat,
    onChange: e => setNewEmpCat(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && newEmpCat.trim() && !empCategories.includes(newEmpCat.trim())) {
        setEmpCategories([...empCategories, newEmpCat.trim()]);
        setNewEmpCat('');
      }
    },
    placeholder: t('cats.newEmpCat'),
    className: "flex-1 p-2 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (newEmpCat.trim() && !empCategories.includes(newEmpCat.trim())) {
        setEmpCategories([...empCategories, newEmpCat.trim()]);
        setNewEmpCat('');
      }
    },
    className: "bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700"
  }, t('btn.add'))), /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-100"
  }, empCategories.map(cat => /*#__PURE__*/React.createElement("li", {
    key: cat,
    className: "px-4 py-3 flex justify-between items-center text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800"
  }, cat), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEmpCategories(empCategories.filter(c => c !== cat)),
    className: "text-rose-500 hover:text-rose-700"
  }, /*#__PURE__*/React.createElement(IconX, {
    size: 16
  }))))))), section('projCats', t('cats.section.projCats'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
  }, t('cats.noProjCategories'))))), section('projTypes', 'Projekt-Typen', /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
  }, "Noch keine Projekttypen definiert.")))), /*#__PURE__*/React.createElement("div", {
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
  }, t('cats.reactivate')))))))));
};