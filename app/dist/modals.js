// ─── MODAL COMPONENTS ───────────────────────────────────────────────────────
// All modals receive explicit props; none closes over App() state.
const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback
} = React;
const AssignmentModal = ({
  assignContext,
  assignmentsRef,
  showToast,
  employeeById,
  basicTasks,
  basicTasksMeta,
  offtimeTasks,
  inactiveOfftimeTasks,
  inactiveSupportTasks,
  inactiveTrainingTasks,
  customTrainingTasks,
  projects,
  computeAutoStatus,
  getUtilization,
  getEmpWeeklyHours,
  setBasicTasks,
  setBasicTasksMeta,
  emailTemplate,
  onClose,
  onSave,
  onDelete,
  onDeleteSeries,
  requestConfirm,
  t = k => k
}) => {
  useEscapeToClose(onClose);
  // Guard against weeklyHours = 0 / negative – would otherwise produce
  // NaN / Infinity in the percent calculations and freeze the slider.
  const rawWeeklyHours = employeeById.get(assignContext.empId)?.weeklyHours;
  const empWeeklyHours = rawWeeklyHours > 0 ? rawWeeklyHours : HOURS_PER_WEEK;
  const activeSupportTasks = useMemo(() => SUPPORT_TASKS.filter(t => !(inactiveSupportTasks || []).includes(t)), [inactiveSupportTasks]);
  const activeTrainingTasks = useMemo(() => [...TRAINING_TASKS, ...(customTrainingTasks || [])].filter(t => !(inactiveTrainingTasks || []).includes(t)), [inactiveTrainingTasks, customTrainingTasks]);
  const activeOfftimeTasks = useMemo(() => offtimeTasks.filter(t => !(inactiveOfftimeTasks || []).some(iot => iot.name === t)), [offtimeTasks, inactiveOfftimeTasks]);
  const otherTasks = useMemo(() => basicTasks.filter(t => basicTasksMeta && basicTasksMeta[t]), [basicTasks, basicTasksMeta]);
  const allowedType = assignContext.allowedType || null;
  const getInitialType = () => {
    if (allowedType) return allowedType;
    const ex = assignContext.existing;
    if (ex) return ex.type || 'basic';
    return assignContext.defaultType || 'basic';
  };
  const getInitialRef = type => {
    const ex = assignContext.existing;
    if (ex) return ex.reference || '';
    if (type === 'project') return projects.find(p => ['active', 'planned'].includes(computeAutoStatus(p)))?.id || '';
    if (type === 'basic') return basicTasks.filter(t => !basicTasksMeta?.[t])[0] || basicTasks[0] || '';
    if (type === 'support') return activeSupportTasks[0] || '';
    if (type === 'training') return activeTrainingTasks[0] || '';
    if (type === 'other') return otherTasks[0] || '';
    if (type === 'offtime') return activeOfftimeTasks[0] || '';
    return '';
  };
  const initType = getInitialType();
  const [formData, setFormData] = useState(assignContext.existing || {
    empId: assignContext.empId,
    week: assignContext.week,
    type: initType,
    reference: getInitialRef(initType),
    hours: empWeeklyHours
  });
  const [newTaskName, setNewTaskName] = useState('');
  const [recurRule, setRecurRule] = useState({
    enabled: false,
    everyXWeeks: 1,
    endWeek: addWeeks(assignContext.week || formData.week || getWeekString(new Date()), 4)
  });
  const [planWeeks, setPlanWeeks] = useState(1);
  const [notifyByEmail, setNotifyByEmail] = useState(false);
  const emp = employeeById.get(formData.empId);
  const exactPct = (formData.hours ?? empWeeklyHours) / empWeeklyHours * 100;
  const pct = Math.round(exactPct);
  const hoursDisp = Math.round((formData.hours ?? empWeeklyHours) * 10) / 10;
  const empEmail = emp?.email || '';
  const canNotify = !!empEmail && !formData.id;
  const handleTypeChange = type => {
    let ref = '';
    if (type === 'project') ref = projects.find(p => ['active', 'planned'].includes(computeAutoStatus(p)))?.id || '';else if (type === 'basic') ref = basicTasks.filter(t => !basicTasksMeta?.[t])[0] || basicTasks[0] || '';else if (type === 'support') ref = activeSupportTasks[0] || '';else if (type === 'training') ref = activeTrainingTasks[0] || '';else if (type === 'other') ref = otherTasks[0] || '';else if (type === 'offtime') ref = activeOfftimeTasks[0] || '';
    setFormData({
      ...formData,
      type,
      reference: ref
    });
    setNewTaskName('');
  };
  const refLabelFor = data => data.type === 'project' ? projects.find(p => p.id === data.reference)?.name || data.reference : data.reference;
  const typeLabelFor = data => ({
    project: 'Project',
    basic: 'Task',
    other: 'Task',
    support: 'Support',
    training: 'Training',
    offtime: 'Time off'
  })[data.type] || 'Assignment';
  const buildEmailDraft = (data, lastWeek, attachmentNote) => {
    const firstName = empEmail ? (() => {
      const p = empEmail.split('@')[0].split('.')[0];
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    })() : emp?.name?.split(' ')[0] || emp?.name || '';
    const refLabel = refLabelFor(data);
    const typeLabel = typeLabelFor(data);
    const weekRange = lastWeek && lastWeek !== data.week ? `${data.week} – ${lastWeek}` : data.week;
    const tpl = emailTemplate || DEFAULT_EMAIL_TEMPLATE;
    // Replace {firstName}, {refLabel}, {typeLabel}, {weekRange}, {comment},
    // {attachmentNote}. Empty optional blocks collapse cleanly.
    const vars = {
      firstName,
      refLabel,
      typeLabel,
      weekRange,
      comment: data.comment || '',
      attachmentNote: attachmentNote || ''
    };
    const fillVars = text => text.replace(/\{(firstName|refLabel|typeLabel|weekRange|comment|attachmentNote)\}/g, (_, k) => vars[k] || '');
    // {{#comment}}…{{/comment}} blocks render only when the var is non-empty.
    const fillBlocks = text => text.replace(/\{\{#comment\}\}([\s\S]*?)\{\{\/comment\}\}/g, (_, body) => vars.comment ? fillVars(body) : '').replace(/\{\{#attachmentNote\}\}([\s\S]*?)\{\{\/attachmentNote\}\}/g, (_, body) => vars.attachmentNote ? fillVars(body) : '');
    const subject = fillVars(tpl.subject || DEFAULT_EMAIL_TEMPLATE.subject);
    const body = fillVars(fillBlocks(tpl.body || DEFAULT_EMAIL_TEMPLATE.body));
    return {
      subject,
      body
    };
  };

  // Build a minimal RFC-5545 calendar invite. METHOD:REQUEST + ATTENDEE makes
  // Outlook open this as a meeting that can be sent as an invite.
  const buildIcsContent = (data, lastWeek) => {
    const refLabel = refLabelFor(data);
    const typeLabel = typeLabelFor(data);
    const start = weekIdToMonday(data.week);
    const endWeek = lastWeek || data.week;
    const endMonday = weekIdToMonday(endWeek);
    // DTEND for all-day events is exclusive → Saturday of the last week
    // (Mon + 5 days = Sat) gives a Mon-Fri block.
    const endExclusive = new Date(endMonday.getTime() + 5 * 86400000);
    const fmtDate = d => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    const now = new Date();
    const fmtStamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
    const escape = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const summary = escape(`${typeLabel}: ${refLabel}`);
    const description = escape(data.comment ? `${refLabel}\n${data.comment}` : refLabel);
    const uid = `${makeId('cal')}@planner-3`;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planner-3//Assignment//EN', 'CALSCALE:GREGORIAN', 'METHOD:REQUEST', 'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${fmtStamp}`, `DTSTART;VALUE=DATE:${fmtDate(start)}`, `DTEND;VALUE=DATE:${fmtDate(endExclusive)}`, `SUMMARY:${summary}`, `DESCRIPTION:${description}`, 'TRANSP:OPAQUE', `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${(empEmail || '').replace(/[\r\n,;:]/g, '').trim()}`, 'END:VEVENT', 'END:VCALENDAR'];
    // RFC 5545 mandates CRLF line endings.
    return lines.join('\r\n');
  };
  const downloadIcs = (data, lastWeek) => {
    if (!empEmail) return null;
    const ics = buildIcsContent(data, lastWeek);
    const blob = new Blob([ics], {
      type: 'text/calendar;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const refLabel = refLabelFor(data);
    const safeRef = refLabel.replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 40);
    const filename = `Termin_${safeRef}_${data.week}.ics`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  };
  const sendNotification = (data, lastWeek) => {
    if (!empEmail) return;
    const filename = downloadIcs(data, lastWeek);
    const note = filename || null;
    const {
      subject,
      body
    } = buildEmailDraft(data, lastWeek, note);
    const url = `mailto:${encodeURIComponent(empEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };
  const doSave = data => {
    const numWeeks = Math.max(1, parseInt(planWeeks) || 1);
    if (numWeeks > 1 && !data.id) {
      const series = [];
      let cur = formData.week;
      for (let i = 0; i < numWeeks; i++) {
        series.push({
          ...data,
          week: cur,
          id: makeId('ass')
        });
        cur = addWeeks(cur, 1);
      }
      const lastWeek = series[series.length - 1].week;
      if (canNotify && notifyByEmail) sendNotification(data, lastWeek);
      onSave(series);
      return;
    }
    if (recurRule.enabled && !data.id && compareWeekIds(recurRule.endWeek, formData.week) > 0) {
      const ruleId = makeId('rule');
      const series = [];
      let cur = formData.week;
      // Hard safety cap so a malformed endWeek can't spin forever.
      let guard = 520;
      while (compareWeekIds(cur, recurRule.endWeek) <= 0 && guard-- > 0) {
        series.push({
          ...data,
          week: cur,
          id: makeId('ass'),
          ruleId
        });
        cur = addWeeks(cur, recurRule.everyXWeeks);
      }
      if (canNotify && notifyByEmail) sendNotification(data, recurRule.endWeek);
      onSave(series);
      return;
    }
    if (canNotify && notifyByEmail) sendNotification(data, null);
    onSave(data);
  };
  const handleSave = () => {
    // Race guard: the entry we're editing may have been deleted by another
    // tab/user between modal-open and save. Adding it back as a new row
    // would resurrect a deleted assignment with the old id.
    if (formData.id && assignmentsRef?.current && !assignmentsRef.current.some(a => a.id === formData.id)) {
      showToast?.(t('modal.entryDeleted'), {
        type: 'warning',
        duration: 5000
      });
      onClose();
      return;
    }
    let data = {
      ...formData
    };
    if (formData.type === 'new') {
      const trimmed = newTaskName.trim();
      if (!trimmed) return;
      if (!basicTasks.includes(trimmed)) {
        setBasicTasks(prev => [...prev, trimmed]);
        setBasicTasksMeta(prev => ({
          ...prev,
          [trimmed]: {
            createdAt: new Date().toISOString(),
            permanent: false
          }
        }));
      }
      data = {
        ...formData,
        type: 'other',
        reference: trimmed
      };
    }
    const weeklyH = getEmpWeeklyHours(formData.empId);
    const {
      total: currentTotal
    } = getUtilization(formData.empId, formData.week);
    const existingH = assignContext?.existing ? assignContext.existing.hours ?? (assignContext.existing.percent ?? 100) / 100 * weeklyH : 0;
    const newH = data.hours ?? weeklyH;
    const newTotal = currentTotal - existingH / weeklyH * 100 + newH / weeklyH * 100;
    if (newTotal > 100) {
      const empName = employeeById.get(formData.empId)?.name || '';
      requestConfirm({
        title: t('modal.overutilTitle') || 'Überauslastung',
        message: t('modal.overutilWarning', {
          empName,
          pct: Math.round(newTotal)
        }),
        confirmLabel: t('btn.save'),
        onConfirm: () => doSave(data)
      });
      return;
    }
    doSave(data);
  };
  const TYPE_BUTTONS = [{
    value: 'training',
    label: t('modal.typeTraining')
  }, {
    value: 'support',
    label: t('modal.typeSupport')
  }, {
    value: 'basic',
    label: t('modal.typeBasic')
  }, {
    value: 'other',
    label: t('modal.typeOther')
  }, {
    value: 'project',
    label: t('modal.typeProject')
  }, {
    value: 'offtime',
    label: t('modal.typeOfftime')
  }, {
    value: 'new',
    label: t('modal.typeNew')
  }];

  // Speichern nur mit vollständigen Eingaben – vorher tat der Button bei
  // Typ "+ Neu" ohne Namen einfach nichts (stummer return).
  const newNameMissing = formData.type === 'new' && !newTaskName.trim();
  const canSave = !newNameMissing;
  const hardcodedBasicTasks = basicTasks.filter(t => !basicTasksMeta?.[t]);
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
  }, /*#__PURE__*/React.createElement(ModalHeader, {
    title: formData.id ? t('modal.assignEdit') : t('modal.assignAdd'),
    onClose: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto p-6 space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-500"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-900 font-medium"
  }, emp?.name), /*#__PURE__*/React.createElement("span", {
    className: "mx-2"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-slate-700"
  }, formData.week)), !allowedType && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide"
  }, t('modal.typeLabel')), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-4 gap-1"
  }, TYPE_BUTTONS.map(opt => /*#__PURE__*/React.createElement("button", {
    key: opt.value,
    onClick: () => handleTypeChange(opt.value),
    className: `py-2 px-1 text-xs rounded-md border font-medium transition-colors ${formData.type === opt.value ? 'bg-gea-600 text-white border-gea-600' : 'bg-white text-slate-600 border-slate-300 hover:border-gea-400'}`
  }, opt.label)))), !allowedType && formData.type === 'new' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-500 mb-1 font-medium"
  }, t('modal.newTaskName')), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newTaskName,
    onChange: e => setNewTaskName(e.target.value),
    autoFocus: true,
    placeholder: t('modal.newTaskPlaceholder'),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 mt-1"
  }, t('modal.newTaskHint'))), formData.type !== 'new' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide"
  }, t('modal.selectionLabel')), formData.type === 'project' && /*#__PURE__*/React.createElement("select", {
    value: formData.reference,
    onChange: e => setFormData({
      ...formData,
      reference: e.target.value
    }),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }, projects.filter(p => ['active', 'planned'].includes(computeAutoStatus(p))).sort((a, b) => {
    const ta = (a.projType || '').toLowerCase();
    const tb = (b.projType || '').toLowerCase();
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return (a.name || '').localeCompare(b.name || '');
  }).map(p => {
    const cc = resolveCountryCode(p.country);
    const numericSize = String(p.size ?? '').replace(/[^\d.]/g, '');
    const label = [p.projType, numericSize, p.name, cc !== '/' ? cc : ''].filter(Boolean).join(' ');
    return /*#__PURE__*/React.createElement("option", {
      key: p.id,
      value: p.id
    }, label);
  })), formData.type === 'basic' && /*#__PURE__*/React.createElement("select", {
    value: formData.reference,
    onChange: e => setFormData({
      ...formData,
      reference: e.target.value
    }),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }, hardcodedBasicTasks.map(bt => /*#__PURE__*/React.createElement("option", {
    key: bt,
    value: bt
  }, bt))), formData.type === 'other' && /*#__PURE__*/React.createElement("select", {
    value: formData.reference,
    onChange: e => setFormData({
      ...formData,
      reference: e.target.value
    }),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }, otherTasks.length > 0 ? otherTasks.map(ot => /*#__PURE__*/React.createElement("option", {
    key: ot,
    value: ot
  }, ot)) : /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t('modal.noOtherTasks'))), formData.type === 'support' && /*#__PURE__*/React.createElement("select", {
    value: formData.reference,
    onChange: e => setFormData({
      ...formData,
      reference: e.target.value
    }),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }, activeSupportTasks.map(st => /*#__PURE__*/React.createElement("option", {
    key: st,
    value: st
  }, st))), formData.type === 'training' && /*#__PURE__*/React.createElement("select", {
    value: formData.reference,
    onChange: e => setFormData({
      ...formData,
      reference: e.target.value
    }),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }, activeTrainingTasks.map(tt => /*#__PURE__*/React.createElement("option", {
    key: tt,
    value: tt
  }, tt))), formData.type === 'offtime' && /*#__PURE__*/React.createElement("select", {
    value: formData.reference,
    onChange: e => setFormData({
      ...formData,
      reference: e.target.value
    }),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }, activeOfftimeTasks.map(oft => /*#__PURE__*/React.createElement("option", {
    key: oft,
    value: oft
  }, oft)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide"
  }, t('modal.utilization'), ": ", /*#__PURE__*/React.createElement("span", {
    className: "text-gea-600 font-medium"
  }, pct, "%"), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 ml-2"
  }, "(", hoursDisp, "h)")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "200",
    step: "5",
    value: exactPct,
    onChange: e => setFormData({
      ...formData,
      hours: parseFloat(e.target.value) / 100 * empWeeklyHours
    }),
    className: "w-full accent-gea-600 block"
  }), /*#__PURE__*/React.createElement("div", {
    className: "relative h-2 mt-0.5"
  }, [0, 25, 50, 75, 100, 125, 150, 175, 200].map(v => {
    const major = v % 50 === 0;
    return /*#__PURE__*/React.createElement("div", {
      key: v,
      className: `absolute top-0 w-px ${major ? 'h-2 bg-slate-400' : 'h-1 bg-slate-300'}`,
      style: {
        left: `${v / 2}%`
      }
    });
  })), /*#__PURE__*/React.createElement("div", {
    className: "relative h-4 mt-0.5 text-xs text-slate-400"
  }, [0, 50, 100, 150, 200].map(v => /*#__PURE__*/React.createElement("span", {
    key: v,
    className: "absolute",
    style: {
      left: `${v / 2}%`,
      transform: 'translateX(-50%)'
    }
  }, v, "%")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide"
  }, t('modal.comment')), /*#__PURE__*/React.createElement("textarea", {
    value: formData.comment || '',
    onChange: e => setFormData({
      ...formData,
      comment: e.target.value
    }),
    placeholder: t('modal.commentPlaceholder'),
    rows: 2,
    className: "w-full p-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gea-400"
  })), !formData.id && /*#__PURE__*/React.createElement("div", {
    className: "border-t border-slate-100 pt-3 space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-medium uppercase tracking-wide text-slate-500 whitespace-nowrap"
  }, t('modal.planFor')), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: "52",
    value: planWeeks,
    onChange: e => setPlanWeeks(Math.max(1, parseInt(e.target.value) || 1)),
    className: "w-20 p-2 border border-slate-300 rounded-md text-sm text-center"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-slate-600"
  }, t('modal.weeks', {
    s: planWeeks > 1 ? t('modal.weekPluralSuffix') : ''
  })), planWeeks > 1 && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400 ml-auto"
  }, t('modal.until'), " ", addWeeks(formData.week, planWeeks - 1))), planWeeks === 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer select-none"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: recurRule.enabled,
    onChange: e => setRecurRule(r => ({
      ...r,
      enabled: e.target.checked
    })),
    className: "rounded accent-gea-600"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-1"
  }, /*#__PURE__*/React.createElement(IconRepeat, {
    size: 12
  }), " ", t('modal.recurring'))), recurRule.enabled && /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-400 mb-1"
  }, t('modal.everyXWeeks')), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: "52",
    value: recurRule.everyXWeeks,
    onChange: e => setRecurRule(r => ({
      ...r,
      everyXWeeks: Math.max(1, parseInt(e.target.value) || 1)
    })),
    className: "w-20 p-2 border border-slate-300 rounded-md text-sm text-center"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-400 mb-1"
  }, t('modal.untilWeek')), /*#__PURE__*/React.createElement(WeekPickerInput, {
    value: recurRule.endWeek,
    minWeek: formData.week,
    onChange: w => setRecurRule(r => ({
      ...r,
      endWeek: w
    }))
  }))))), /*#__PURE__*/React.createElement("label", {
    className: `flex items-center gap-2 select-none ${canNotify ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: notifyByEmail && canNotify,
    disabled: !canNotify,
    onChange: e => setNotifyByEmail(e.target.checked),
    className: "rounded accent-gea-600"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-xs flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-medium uppercase tracking-wide text-slate-500"
  }, t('modal.notifyEmail')), /*#__PURE__*/React.createElement("span", {
    className: "relative group/tip cursor-help",
    onClick: e => e.preventDefault()
  }, /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 text-xs font-bold leading-none"
  }, "?"), /*#__PURE__*/React.createElement("span", {
    className: "pointer-events-none absolute bottom-5 left-0 z-50 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg",
    style: {
      whiteSpace: 'normal'
    }
  }, empEmail ? t('modal.notifyEmailTip', {
    email: empEmail
  }) : t('modal.noEmail'))))))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-50 border-t border-slate-100 flex justify-between"
  }, formData.id ? /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onDelete(formData.id),
    className: "text-rose-600 text-sm hover:bg-rose-50 px-3 py-2 rounded font-medium"
  }, t('btn.delete')), formData.ruleId && onDeleteSeries && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const seriesCount = (assignmentsRef?.current || []).filter(a => a.ruleId === formData.ruleId && a.week >= formData.week).length;
      requestConfirm({
        title: t('modal.deleteSeries'),
        message: t('modal.deleteSeriesCount', {
          n: seriesCount,
          s: seriesCount === 1 ? '' : t('modal.assignmentPluralSuffix')
        }),
        confirmLabel: t('modal.deleteSeriesBtn'),
        danger: true,
        onConfirm: () => onDeleteSeries(formData.id)
      });
    },
    className: "text-rose-500 text-xs hover:bg-rose-50 px-2 py-1 rounded font-medium border border-rose-200 flex items-center gap-1",
    title: t('modal.deleteSeriesFromTitle')
  }, /*#__PURE__*/React.createElement(IconRepeat, {
    size: 11
  }), " ", t('modal.deleteSeriesFrom'))) : /*#__PURE__*/React.createElement("div", null), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, newNameMissing && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400 mr-1"
  }, t('modal.newTaskNameRequired')), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium"
  }, t('btn.cancel')), /*#__PURE__*/React.createElement("button", {
    onClick: handleSave,
    disabled: !canSave,
    className: "px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
  }, t('btn.save'))))));
};
const CopyModal = ({
  copyContext,
  assignmentsRef,
  showToast,
  employees,
  activeEmps,
  empsByCategory,
  empCategories,
  weeks,
  projectById,
  assignments,
  setAssignments,
  onClose,
  t = k => k
}) => {
  useEscapeToClose(onClose);
  const {
    assignment
  } = copyContext;

  // Lookup of ALL employees (not just active) so the source weeklyHours is
  // correct even when copying off an inactive MA. The copy preserves the
  // *percentage* (Auslastung) – 100 % on 35h → 100 % on 40h (= 40h), not 35h.
  const empById = useMemo(() => {
    const m = new Map();
    (employees || []).forEach(e => m.set(e.id, e));
    return m;
  }, [employees]);
  const sourceEmp = empById.get(assignment.empId);
  const sourceWeeklyHours = sourceEmp?.weeklyHours > 0 ? sourceEmp.weeklyHours : HOURS_PER_WEEK;
  const sourcePctFraction = getAssignmentHours(assignment, sourceWeeklyHours) / sourceWeeklyHours;
  const [selWeeks, setSelWeeks] = useState({});
  const [selEmps, setSelEmps] = useState({});
  const [error, setError] = useState('');
  const [collapsedTeams, setCollapsedTeams] = useState(() => {
    const init = {};
    (empCategories || []).forEach(cat => {
      init[cat] = true;
    });
    return init;
  });
  const toggleWeek = wId => {
    setError('');
    setSelWeeks(prev => ({
      ...prev,
      [wId]: !prev[wId]
    }));
  };
  const toggleEmp = eId => {
    setError('');
    setSelEmps(prev => ({
      ...prev,
      [eId]: !prev[eId]
    }));
  };
  const toggleTeam = cat => setCollapsedTeams(prev => ({
    ...prev,
    [cat]: !prev[cat]
  }));
  const toggleAllWeeks = () => {
    const allSelected = weeks.every(w => selWeeks[w.id]);
    const next = {};
    weeks.forEach(w => {
      next[w.id] = !allSelected;
    });
    setSelWeeks(next);
  };
  const toggleAllInTeam = cat => {
    const catEmps = empsByCategory?.get(cat) || [];
    const allSel = catEmps.every(e => selEmps[e.id]);
    setSelEmps(prev => {
      const next = {
        ...prev
      };
      catEmps.forEach(e => {
        next[e.id] = !allSel;
      });
      return next;
    });
  };
  let label = assignment.reference;
  if (assignment.type === 'project') {
    const p = projectById.get(assignment.reference);
    label = p ? p.name : assignment.reference;
  }
  const handleCopy = () => {
    // Race guard: source assignment may have been deleted while the modal
    // was open; copying it would resurrect deleted data on every target.
    if (assignment.id && assignmentsRef?.current && !assignmentsRef.current.some(a => a.id === assignment.id)) {
      showToast?.(t('copy.sourceDeleted'), {
        type: 'warning',
        duration: 5000
      });
      onClose();
      return;
    }
    const targetWeeks = weeks.filter(w => selWeeks[w.id]).map(w => w.id);
    const targetEmps = activeEmps.filter(e => selEmps[e.id]).map(e => e.id);
    if (targetEmps.length === 0 && targetWeeks.length === 0) {
      setError(t('copy.errorBoth'));
      return;
    }
    if (targetEmps.length === 0) {
      setError(t('copy.errorEmp'));
      return;
    }
    if (targetWeeks.length === 0) {
      setError(t('copy.errorWeek'));
      return;
    }
    setError('');
    const newAssignments = [];
    targetEmps.forEach(empId => {
      // Recompute hours per target employee so the *percentage* is preserved
      // when the target's weeklyHours differs from the source's.
      const targetEmp = empById.get(empId);
      const targetWeeklyHours = targetEmp?.weeklyHours > 0 ? targetEmp.weeklyHours : sourceWeeklyHours;
      const targetHours = sourcePctFraction * targetWeeklyHours;
      targetWeeks.forEach(week => {
        if (empId === assignment.empId && week === assignment.week) return;
        const exists = assignments.some(a => a.empId === empId && a.week === week && a.reference === assignment.reference && a.type === assignment.type);
        if (!exists) {
          // Drop legacy `percent` so the new assignment is unambiguously
          // hours-based on the target side.
          const {
            percent: _legacy,
            ...rest
          } = assignment;
          newAssignments.push({
            ...rest,
            id: makeId('ass'),
            empId,
            week,
            hours: targetHours
          });
        }
      });
    });
    setAssignments(prev => [...prev, ...newAssignments]);
    onClose();
  };
  const pct = Math.round(sourcePctFraction * 100);
  const selEmpCount = Object.values(selEmps).filter(Boolean).length;
  const selWeekCount = Object.values(selWeeks).filter(Boolean).length;

  // Use team grouping if available, otherwise fall back to flat list
  const useTeams = empsByCategory && empCategories && empCategories.length > 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
  }, /*#__PURE__*/React.createElement(ModalHeader, {
    title: t('copy.title'),
    subtitle: `"${label}" · ${pct}%`,
    onClose: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto p-6 space-y-6"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "text-sm font-medium text-slate-700 mb-3"
  }, t('copy.selectEmployees')), useTeams ? /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 border border-slate-200 rounded-lg overflow-hidden"
  }, empCategories.map(cat => {
    const catEmps = empsByCategory.get(cat) || [];
    if (catEmps.length === 0) return null;
    const isCollapsed = collapsedTeams[cat];
    const selInTeam = catEmps.filter(e => selEmps[e.id]).length;
    const allInTeam = catEmps.every(e => selEmps[e.id]);
    return /*#__PURE__*/React.createElement("div", {
      key: cat,
      className: "border-b border-slate-100 last:border-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleTeam(cat),
      className: "flex items-center gap-2 flex-1 text-left"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: `text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`
    }, /*#__PURE__*/React.createElement("polyline", {
      points: "6 9 12 15 18 9"
    })), /*#__PURE__*/React.createElement("span", {
      className: "text-xs font-semibold text-slate-600 uppercase tracking-wide"
    }, cat), selInTeam > 0 && /*#__PURE__*/React.createElement("span", {
      className: "ml-1 text-xs bg-gea-100 text-gea-700 px-1.5 py-0.5 rounded-full font-medium"
    }, selInTeam, "/", catEmps.length)), /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleAllInTeam(cat),
      className: `text-xs font-medium px-2 py-0.5 rounded transition-colors ${allInTeam ? 'text-gea-600 hover:text-gea-800' : 'text-slate-500 hover:text-gea-600'}`
    }, allInTeam ? t('copy.allDeselect') : t('copy.allSelect'))), !isCollapsed && /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-2 px-3 py-2.5 bg-white"
    }, catEmps.map(e => /*#__PURE__*/React.createElement("button", {
      key: e.id,
      onClick: () => toggleEmp(e.id),
      className: `px-3 py-1.5 rounded-full text-sm border font-medium transition-colors ${selEmps[e.id] ? 'bg-gea-600 text-white border-gea-600' : 'bg-white text-slate-600 border-slate-300 hover:border-gea-400'}`
    }, e.name))));
  })) : /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, activeEmps.map(e => /*#__PURE__*/React.createElement("button", {
    key: e.id,
    onClick: () => toggleEmp(e.id),
    className: `px-3 py-1.5 rounded-full text-sm border font-medium transition-colors ${selEmps[e.id] ? 'bg-gea-600 text-white border-gea-600' : 'bg-white text-slate-600 border-slate-300 hover:border-gea-400'}`
  }, e.name)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-3"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-sm font-medium text-slate-700"
  }, t('copy.selectWeeks')), /*#__PURE__*/React.createElement("button", {
    onClick: toggleAllWeeks,
    className: "text-xs text-gea-600 hover:text-gea-700 font-medium"
  }, weeks.every(w => selWeeks[w.id]) ? t('copy.weeksDeselectAll') : t('copy.weeksSelectAll'))), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 max-h-48 overflow-y-auto"
  }, weeks.map(w => {
    const isSource = w.id === assignment.week;
    return /*#__PURE__*/React.createElement("button", {
      key: w.id,
      onClick: () => toggleWeek(w.id),
      title: isSource ? t('copy.sourceWeekTip') : '',
      className: `px-2.5 py-1 rounded text-xs border font-medium transition-colors ${selWeeks[w.id] ? 'bg-gea-600 text-white border-gea-600' : isSource ? 'bg-amber-50 text-amber-700 border-amber-300 hover:border-gea-400' : 'bg-white text-slate-600 border-slate-200 hover:border-gea-300'}`
    }, w.label, isSource ? ' ★' : '');
  })))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3"
  }, error ? /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-rose-600 font-medium flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "8",
    x2: "12",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "16",
    x2: "12.01",
    y2: "16"
  })), error) : /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400"
  }, t('copy.stats', {
    ma: selEmpCount,
    kw: selWeekCount,
    total: selEmpCount * selWeekCount
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium"
  }, t('btn.cancel')), /*#__PURE__*/React.createElement("button", {
    onClick: handleCopy,
    className: "px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 font-medium flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(IconCopy, {
    size: 15
  }), " ", t('btn.copy'))))));
};

// Klick auf eine leere Projekt×Woche-Zelle in der Timeline-Ansicht (ersetzt
// die frühere Mitarbeiter-Drag-Leiste): Team-gruppierte Mehrfachauswahl,
// die bei Bestätigen direkt neue Zuweisungen anlegt (kein Folge-Dialog).
// Feinschliff einzelner Zuweisungen (Stunden, Kommentar, Serie) bleibt wie
// gehabt über den Klick auf den entstandenen Chip → AssignmentModal.
// Mitarbeiter-Auswahlblock 1:1 aus CopyModal übernommen, nur ohne
// Wochen-Mehrfachauswahl (die Woche kommt fix aus `context.week`).
const QuickAssignModal = ({
  context,
  employees,
  activeEmps,
  empsByCategory,
  empCategories,
  projectById,
  assignments,
  setAssignments,
  logAudit,
  onClose,
  t = k => k
}) => {
  useEscapeToClose(onClose);
  const {
    projectId,
    week
  } = context;
  const empById = useMemo(() => {
    const m = new Map();
    (employees || []).forEach(e => m.set(e.id, e));
    return m;
  }, [employees]);
  const [selEmps, setSelEmps] = useState({});
  const [error, setError] = useState('');
  const [collapsedTeams, setCollapsedTeams] = useState(() => {
    const init = {};
    (empCategories || []).forEach(cat => {
      init[cat] = true;
    });
    return init;
  });
  const toggleEmp = eId => {
    setError('');
    setSelEmps(prev => ({
      ...prev,
      [eId]: !prev[eId]
    }));
  };
  const toggleTeam = cat => setCollapsedTeams(prev => ({
    ...prev,
    [cat]: !prev[cat]
  }));
  const toggleAllInTeam = cat => {
    const catEmps = empsByCategory?.get(cat) || [];
    const allSel = catEmps.every(e => selEmps[e.id]);
    setSelEmps(prev => {
      const next = {
        ...prev
      };
      catEmps.forEach(e => {
        next[e.id] = !allSel;
      });
      return next;
    });
  };
  const proj = projectById.get(projectId);
  const projLabel = proj?.name || projectId;
  const handleAssign = () => {
    const targetEmps = activeEmps.filter(e => selEmps[e.id]).map(e => e.id);
    if (targetEmps.length === 0) {
      setError(t('quickAssign.errorEmp'));
      return;
    }
    setError('');
    const newAssignments = [];
    targetEmps.forEach(empId => {
      const exists = assignments.some(a => a.empId === empId && a.week === week && a.type === 'project' && a.reference === projectId);
      if (exists) return;
      const emp = empById.get(empId);
      const weeklyHours = emp?.weeklyHours > 0 ? emp.weeklyHours : HOURS_PER_WEEK;
      newAssignments.push({
        id: makeId('ass'),
        empId,
        week,
        type: 'project',
        reference: projectId,
        hours: weeklyHours
      });
    });
    if (newAssignments.length > 0) {
      setAssignments(prev => [...prev, ...newAssignments]);
      logAudit('assignment_create', `${newAssignments.length}× ${projLabel} zugewiesen (${formatKW(week)})`, {
        type: 'del_assignments',
        ids: newAssignments.map(a => a.id)
      });
    }
    onClose();
  };
  const selEmpCount = Object.values(selEmps).filter(Boolean).length;
  const useTeams = empsByCategory && empCategories && empCategories.length > 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
  }, /*#__PURE__*/React.createElement(ModalHeader, {
    title: t('quickAssign.title'),
    subtitle: `${projLabel} · ${formatKW(week)}`,
    onClose: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto p-6 space-y-6"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "text-sm font-medium text-slate-700 mb-3"
  }, t('copy.selectEmployees')), useTeams ? /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 border border-slate-200 rounded-lg overflow-hidden"
  }, empCategories.map(cat => {
    const catEmps = empsByCategory.get(cat) || [];
    if (catEmps.length === 0) return null;
    const isCollapsed = collapsedTeams[cat];
    const selInTeam = catEmps.filter(e => selEmps[e.id]).length;
    const allInTeam = catEmps.every(e => selEmps[e.id]);
    return /*#__PURE__*/React.createElement("div", {
      key: cat,
      className: "border-b border-slate-100 last:border-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleTeam(cat),
      className: "flex items-center gap-2 flex-1 text-left"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: `text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`
    }, /*#__PURE__*/React.createElement("polyline", {
      points: "6 9 12 15 18 9"
    })), /*#__PURE__*/React.createElement("span", {
      className: "text-xs font-semibold text-slate-600 uppercase tracking-wide"
    }, cat), selInTeam > 0 && /*#__PURE__*/React.createElement("span", {
      className: "ml-1 text-xs bg-gea-100 text-gea-700 px-1.5 py-0.5 rounded-full font-medium"
    }, selInTeam, "/", catEmps.length)), /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleAllInTeam(cat),
      className: `text-xs font-medium px-2 py-0.5 rounded transition-colors ${allInTeam ? 'text-gea-600 hover:text-gea-800' : 'text-slate-500 hover:text-gea-600'}`
    }, allInTeam ? t('copy.allDeselect') : t('copy.allSelect'))), !isCollapsed && /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-2 px-3 py-2.5 bg-white"
    }, catEmps.map(e => /*#__PURE__*/React.createElement("button", {
      key: e.id,
      onClick: () => toggleEmp(e.id),
      className: `px-3 py-1.5 rounded-full text-sm border font-medium transition-colors ${selEmps[e.id] ? 'bg-gea-600 text-white border-gea-600' : 'bg-white text-slate-600 border-slate-300 hover:border-gea-400'}`
    }, e.name))));
  })) : /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, activeEmps.map(e => /*#__PURE__*/React.createElement("button", {
    key: e.id,
    onClick: () => toggleEmp(e.id),
    className: `px-3 py-1.5 rounded-full text-sm border font-medium transition-colors ${selEmps[e.id] ? 'bg-gea-600 text-white border-gea-600' : 'bg-white text-slate-600 border-slate-300 hover:border-gea-400'}`
  }, e.name))))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3"
  }, error ? /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-rose-600 font-medium flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "8",
    x2: "12",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "16",
    x2: "12.01",
    y2: "16"
  })), error) : /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400"
  }, t('quickAssign.stats', {
    n: selEmpCount
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium"
  }, t('btn.cancel')), /*#__PURE__*/React.createElement("button", {
    onClick: handleAssign,
    className: "px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 font-medium flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(IconPlus, {
    size: 15
  }), " ", t('quickAssign.confirmBtn'))))));
};
const CostItemModal = ({
  projectId,
  existingItem,
  assignments,
  employees,
  costItems,
  setCostItems,
  showToast,
  onClose,
  t = k => k
}) => {
  useEscapeToClose(onClose);
  // Coerce a free-text number to a finite, non-negative float. parseFloat
  // alone returns NaN for '' / undefined which then gets serialised into
  // the persisted state; this keeps the JSON safe to re-import.
  const safeNum = v => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const projAssignments = assignments.filter(a => a.reference === projectId);
  const empIds = new Set(projAssignments.map(a => a.empId));
  const projEmployees = employees.filter(e => empIds.has(e.id));
  const kwRangeFromDates = (from, to) => {
    if (!from) return null;
    const kwFrom = parseInt(getWeekString(new Date(from)).split('-W')[1]);
    const kwTo = to ? parseInt(getWeekString(new Date(to)).split('-W')[1]) : kwFrom;
    return kwFrom === kwTo ? `KW${kwFrom}` : `KW${kwFrom}–${kwTo}`;
  };
  const [form, setForm] = useState({
    empId: existingItem?.empId || projEmployees[0]?.id || '',
    description: existingItem?.description || '',
    dateFrom: existingItem?.dateFrom || '',
    dateTo: existingItem?.dateTo || ''
  });

  // Verrechnung (Prozess 2): Gutschrift-Status + Gegenkonto sind hier als
  // Zweit-Editierstelle neben der Reisekostenübersicht pflegbar.
  const [settleStatus, setSettleStatus] = useState(existingItem ? getSettlementStatus(existingItem) : projectId ? 'to_submit' : 'remain_on_kst');
  const [targetAccount, setTargetAccount] = useState(existingItem?.targetAccount || '');

  // Lines are kept as strings while editing so empty inputs don't read as 0.
  const [lines, setLines] = useState(() => (existingItem?.lines || []).map(l => ({
    id: l.id || makeId('cl'),
    type: l.type,
    amount: l.type === 'hours' ? '' : l.amount != null ? String(l.amount) : '',
    hours: l.hours != null ? String(l.hours) : '',
    hourlyRate: l.hourlyRate != null ? String(l.hourlyRate) : '',
    comment: l.comment || ''
  })));
  const addLine = type => {
    const base = {
      id: makeId('cl'),
      type,
      amount: '',
      comment: ''
    };
    if (type === 'hours') {
      base.hours = '';
      base.hourlyRate = String(DEFAULT_HOURLY_RATE);
    }
    setLines(prev => [...prev, base]);
  };
  const updateLine = (id, field, val) => setLines(prev => prev.map(l => l.id === id ? {
    ...l,
    [field]: val
  } : l));
  const removeLine = id => setLines(prev => prev.filter(l => l.id !== id));
  const lineAmount = l => l.type === 'hours' ? safeNum(l.hours) * safeNum(l.hourlyRate) : safeNum(l.amount);
  const total = lines.reduce((s, l) => s + lineAmount(l), 0);
  const handleSave = () => {
    if (!form.empId || lines.length === 0) return;
    // Race guard: the cost item we're editing may have been removed.
    if (existingItem?.id && Array.isArray(costItems) && !costItems.some(c => c.id === existingItem.id)) {
      showToast?.(t('costitem.deleted'), {
        type: 'warning',
        duration: 5000
      });
      onClose();
      return;
    }
    const cleanedLines = lines.map(l => {
      if (l.type === 'hours') {
        const hrs = safeNum(l.hours);
        const rate = safeNum(l.hourlyRate);
        return {
          id: l.id,
          type: 'hours',
          hours: hrs,
          hourlyRate: rate,
          amount: hrs * rate,
          comment: l.comment || ''
        };
      }
      return {
        id: l.id,
        type: l.type,
        amount: safeNum(l.amount),
        comment: l.comment || ''
      };
    });
    // Bestehende Felder (expenseReportId, reportKey, submittedBy, …) beim
    // Edit erhalten – das Item wird sonst bei jedem Speichern auf die
    // Formularfelder reduziert.
    const prevStatus = existingItem ? getSettlementStatus(existingItem) : null;
    const statusChanged = settleStatus !== prevStatus;
    const item = {
      ...(existingItem || {}),
      id: existingItem?.id || makeId('ci'),
      projectId,
      empId: form.empId,
      description: form.description,
      dateFrom: form.dateFrom || null,
      dateTo: form.dateTo || null,
      week: form.dateFrom ? getWeekString(new Date(form.dateFrom)) : null,
      lines: cleanedLines,
      amount: cleanedLines.reduce((s, l) => s + (l.amount || 0), 0),
      settlementStatus: settleStatus,
      targetAccount: targetAccount.trim() || null,
      // Zeitstempel nur beim Statuswechsel anfassen (setzen/abräumen)
      ...(statusChanged ? settleStatus === 'submitted' ? {
        submittedAt: new Date().toISOString()
      } : {
        submittedAt: null,
        submittedBy: null
      } : {})
    };
    if (existingItem) {
      setCostItems(costItems.map(c => c.id === existingItem.id ? item : c));
    } else {
      setCostItems([...costItems, item]);
    }
    onClose();
  };
  const handleDelete = () => {
    setCostItems(costItems.filter(c => c.id !== existingItem.id));
    onClose();
  };
  const kwLabel = kwRangeFromDates(form.dateFrom, form.dateTo);
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
  }, /*#__PURE__*/React.createElement(ModalHeader, {
    title: existingItem ? t('costitem.editTitle') : t('costitem.addTitle'),
    onClose: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "p-6 space-y-5 overflow-y-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-500 mb-1 font-medium"
  }, t('costitem.employee')), /*#__PURE__*/React.createElement("select", {
    value: form.empId,
    onChange: e => setForm({
      ...form,
      empId: e.target.value
    }),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t('costitem.selectEmployee')), projEmployees.map(e => /*#__PURE__*/React.createElement("option", {
    key: e.id,
    value: e.id
  }, e.name)), employees.filter(e => !empIds.has(e.id)).map(e => /*#__PURE__*/React.createElement("option", {
    key: e.id,
    value: e.id
  }, e.name, " (", t('costitem.notScheduled'), ")")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-500 mb-1 font-medium"
  }, t('costitem.occasion')), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: form.description,
    onChange: e => setForm({
      ...form,
      description: e.target.value
    }),
    placeholder: t('costitem.occasionPlaceholder'),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-500 mb-1 font-medium"
  }, t('costitem.period'), kwLabel && /*#__PURE__*/React.createElement("span", {
    className: "ml-2 text-gea-600 font-medium"
  }, kwLabel)), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: form.dateFrom,
    onChange: e => setForm({
      ...form,
      dateFrom: e.target.value
    }),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: form.dateTo,
    min: form.dateFrom,
    onChange: e => setForm({
      ...form,
      dateTo: e.target.value
    }),
    className: "w-full p-2 border border-slate-300 rounded-md text-sm"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "border border-slate-200 rounded-lg overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-medium text-slate-600 mr-1"
  }, t('costitem.lineItems')), COST_LINE_TYPE_ORDER.map(lt => {
    const cfg = COST_LINE_TYPES[lt];
    return /*#__PURE__*/React.createElement("button", {
      key: lt,
      onClick: () => addLine(lt),
      title: cfg.example ? `z.B. ${cfg.example}` : t('costitem.hoursX'),
      className: `text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 transition-opacity hover:opacity-80 ${cfg.chip}`
    }, /*#__PURE__*/React.createElement(IconPlus, {
      size: 11
    }), " ", cfg.label);
  })), lines.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-6 text-center text-xs text-slate-400"
  }, t('costitem.noItems')) : /*#__PURE__*/React.createElement("div", {
    className: "p-3 space-y-2"
  }, lines.map(l => {
    const cfg = COST_LINE_TYPES[l.type] || COST_LINE_TYPES.other;
    return /*#__PURE__*/React.createElement("div", {
      key: l.id,
      className: "flex gap-2 items-center"
    }, /*#__PURE__*/React.createElement("span", {
      className: `text-xs font-medium px-2.5 py-1 rounded-full border w-32 text-center shrink-0 ${cfg.chip}`
    }, cfg.label), l.type === 'hours' ? /*#__PURE__*/React.createElement("div", {
      className: "flex gap-1 items-center w-44 shrink-0"
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      step: "0.5",
      value: l.hours,
      onChange: e => updateLine(l.id, 'hours', e.target.value),
      placeholder: t('costitem.hourPlaceholder'),
      className: "w-20 p-2 border border-slate-300 rounded text-sm"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400 text-xs"
    }, "\xD7"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      step: "1",
      value: l.hourlyRate,
      onChange: e => updateLine(l.id, 'hourlyRate', e.target.value),
      placeholder: "\u20AC/h",
      className: "w-20 p-2 border border-slate-300 rounded text-sm"
    })) : /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      step: "0.01",
      value: l.amount,
      onChange: e => updateLine(l.id, 'amount', e.target.value),
      placeholder: "\u20AC",
      className: "w-28 p-2 border border-slate-300 rounded text-sm shrink-0"
    }), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: l.comment,
      onChange: e => updateLine(l.id, 'comment', e.target.value),
      placeholder: cfg.example ? t('costitem.commentPrefix', {
        example: cfg.example
      }) : t('costitem.commentGeneric'),
      className: "flex-1 p-2 border border-slate-300 rounded text-sm"
    }), /*#__PURE__*/React.createElement("span", {
      className: "w-20 text-right text-sm text-slate-700 tabular-nums shrink-0"
    }, lineAmount(l).toFixed(2), " \u20AC"), /*#__PURE__*/React.createElement("button", {
      onClick: () => removeLine(l.id),
      className: "text-slate-400 hover:text-rose-500 p-1 shrink-0"
    }, /*#__PURE__*/React.createElement(IconX, {
      size: 14
    })));
  })), lines.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-500"
  }, t('costitem.total')), /*#__PURE__*/React.createElement("span", {
    className: "text-base font-semibold text-slate-900 tabular-nums"
  }, total.toFixed(2), " \u20AC"))), /*#__PURE__*/React.createElement("div", {
    className: "p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-medium text-slate-600"
  }, t('costitem.settlement'), ":"), /*#__PURE__*/React.createElement("select", {
    value: settleStatus,
    onChange: e => setSettleStatus(e.target.value),
    className: "p-1.5 border border-slate-300 rounded-md text-xs bg-white"
  }, SETTLEMENT_STATUS_ORDER.map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, t(`travel.status.${k}`)))), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-500 ml-1"
  }, t('costitem.targetAccount'), ":"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: targetAccount,
    onChange: e => setTargetAccount(e.target.value),
    placeholder: t('costitem.targetAccountPlaceholder'),
    className: "w-28 p-1.5 border border-slate-300 rounded text-xs font-mono"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-400"
  }, t('costitem.settlementHint')))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-50 border-t border-slate-100 flex justify-between"
  }, existingItem ? /*#__PURE__*/React.createElement("button", {
    onClick: handleDelete,
    className: "text-rose-600 text-sm hover:bg-rose-50 px-3 py-2 rounded font-medium"
  }, t('btn.delete')) : /*#__PURE__*/React.createElement("div", null), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium"
  }, t('btn.cancel')), /*#__PURE__*/React.createElement("button", {
    onClick: handleSave,
    disabled: !form.empId || lines.length === 0,
    className: "px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
  }, t('btn.save'))))));
};

// --- DEPENDENCIES / SECURITY INFO ---
const DEPS_LIST = [{
  name: 'React',
  pkg: 'react',
  cdnUrl: 'https://unpkg.com/react@18.3.1/umd/react.development.js',
  getLoaded: () => window.React?.version,
  desc: 'Kern-Bibliothek für die UI-Komponenten. Verwaltet den Anwendungsstatus und sorgt für effizientes Neurendering bei Datenänderungen.'
}, {
  name: 'ReactDOM',
  pkg: 'react-dom',
  cdnUrl: 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js',
  getLoaded: () => window.ReactDOM?.version,
  desc: 'Verbindet React mit dem Browser-DOM. Rendert die React-Komponentenstruktur in die HTML-Seite.'
}, {
  name: 'Babel Standalone',
  pkg: '@babel/standalone',
  cdnUrl: 'https://unpkg.com/@babel/standalone@7.27.1/babel.min.js',
  getLoaded: () => window.Babel?.version,
  desc: 'Kompiliert JSX-Syntax (HTML-in-JavaScript) direkt im Browser zu normalem JavaScript, da kein Build-Server vorhanden ist.'
}, {
  name: 'Tailwind CSS',
  pkg: 'tailwindcss',
  cdnUrl: 'https://cdn.tailwindcss.com',
  getLoaded: () => window.tailwind?.version || '(Play CDN)',
  desc: 'CSS-Utility-Framework für das gesamte Styling der App. Die Play-CDN-Version wird direkt im Browser generiert – keine separate CSS-Datei nötig.'
}];
const DepsSection = ({
  t = k => k
}) => {
  const [latest, setLatest] = React.useState({});
  const [checking, setChecking] = React.useState(false);
  const [checked, setChecked] = React.useState(false);
  const checkUpdates = async () => {
    setChecking(true);
    const results = {};
    await Promise.all(DEPS_LIST.map(async dep => {
      try {
        const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(dep.pkg)}/latest`, {
          cache: 'no-store'
        });
        if (!r.ok) throw new Error('http ' + r.status);
        const d = await r.json();
        results[dep.pkg] = d.version || '–';
      } catch (e) {
        results[dep.pkg] = '–';
      }
    }));
    setLatest(results);
    setChecking(false);
    setChecked(true);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-8 text-left border border-slate-200 rounded-lg overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-semibold text-slate-700"
  }, t('deps.title')), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 mt-0.5"
  }, t('deps.subtitle'))), /*#__PURE__*/React.createElement("button", {
    onClick: checkUpdates,
    disabled: checking,
    className: "text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-600 hover:border-gea-400 hover:text-gea-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
  }, checking ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("svg", {
    className: "animate-spin",
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12a9 9 0 1 1-6.219-8.56"
  })), t('deps.checking')) : t('deps.checkUpdates'))), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-slate-500 border-b border-slate-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-2 font-medium"
  }, t('deps.colLibrary')), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-2 font-medium"
  }, t('deps.colLoaded')), checked && /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-2 font-medium"
  }, t('deps.colLatest')), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-2 font-medium"
  }, t('deps.colSource')))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-slate-50"
  }, DEPS_LIST.map(dep => {
    const loaded = dep.getLoaded();
    const latestVer = latest[dep.pkg];
    const isUpToDate = latestVer && loaded && latestVer === loaded;
    const isOutdated = latestVer && loaded && latestVer !== loaded && loaded !== '(Play CDN)';
    return /*#__PURE__*/React.createElement("tr", {
      key: dep.pkg,
      className: "hover:bg-slate-50"
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-2.5 font-medium text-slate-700"
    }, /*#__PURE__*/React.createElement("span", {
      className: "flex items-center gap-1.5"
    }, dep.name, /*#__PURE__*/React.createElement("span", {
      className: "relative group/tip cursor-help"
    }, /*#__PURE__*/React.createElement("span", {
      className: "inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 text-xs font-bold leading-none select-none"
    }, "?"), /*#__PURE__*/React.createElement("span", {
      className: "pointer-events-none absolute left-5 top-0 z-50 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg",
      style: {
        whiteSpace: 'normal'
      }
    }, dep.desc)))), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-2.5"
    }, loaded ? /*#__PURE__*/React.createElement("span", {
      className: "font-mono text-slate-600"
    }, loaded) : /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400"
    }, "\u2013")), checked && /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-2.5"
    }, latestVer && latestVer !== '–' ? /*#__PURE__*/React.createElement("span", {
      className: `font-mono px-1.5 py-0.5 rounded text-xs ${isUpToDate ? 'bg-emerald-50 text-emerald-700' : isOutdated ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`
    }, latestVer, " ", isUpToDate ? '✓' : isOutdated ? '↑' : '') : /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400"
    }, "\u2013")), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-2.5 max-w-xs"
    }, /*#__PURE__*/React.createElement("a", {
      href: dep.cdnUrl,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "text-gea-600 hover:text-gea-800 underline truncate block font-mono",
      style: {
        maxWidth: '220px'
      }
    }, dep.cdnUrl.replace('https://', ''))));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-2.5 bg-slate-50 border-t border-slate-100"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, t('deps.footer'))));
};

// ─── LOGIN MODAL ─────────────────────────────────────────────────────────────
// LOGIN_LOCK_THRESHOLD and LOGIN_LOCK_DURATION_MS live in config.js
const LoginModal = ({
  appUsers,
  onLogin,
  onClose,
  t = k => k
}) => {
  const {
    useState,
    useEffect,
    useRef
  } = React;
  useEscapeToClose(onClose);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(() => {
    try {
      return parseInt(localStorage.getItem('plannerLoginFails') || '0', 10) || 0;
    } catch (e) {
      return 0;
    }
  });
  const [lockUntil, setLockUntil] = useState(() => {
    try {
      return parseInt(localStorage.getItem('plannerLoginLockUntil') || '0', 10) || 0;
    } catch (e) {
      return 0;
    }
  });
  const [now, setNow] = useState(Date.now());
  const pinRef = useRef(null);
  useEffect(() => {
    if (selectedUserId) pinRef.current?.focus();
  }, [selectedUserId]);

  // Tick once a second while locked so the countdown UI updates.
  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockUntil]);
  const isLocked = lockUntil > now;
  const secondsLeft = isLocked ? Math.ceil((lockUntil - now) / 1000) : 0;
  const handleLogin = async () => {
    if (isLocked) return;
    const user = appUsers.find(u => u.id === selectedUserId);
    if (!user) {
      setError(t('login.noUser'));
      return;
    }
    // New hashed flow (preferred). Legacy plaintext `pin` is also accepted
    // as a fallback so users with un-migrated records can still log in –
    // the next save will migrate them to a hash.
    let ok = false;
    if (user.role === 'admin') {
      // Admin: try stored hash and the recovery credential.
      try {
        ok = await verifyAdminPin(pin, user);
      } catch (e) {
        ok = false;
      }
      // Legacy plaintext admin PIN (pre-migration records).
      if (!ok && typeof user.pin === 'string') ok = user.pin === pin;
    } else if (user.pinHash && user.pinSalt) {
      try {
        ok = await verifyPin(pin, user.pinHash, user.pinSalt, user.pinAlgo);
      } catch (e) {
        ok = false;
      }
    } else if (typeof user.pin === 'string') {
      ok = user.pin === pin;
    } else {
      // No credentials stored at all – SP records were saved without
      // pinHash (old stripUserSecrets bug). Inform the user explicitly.
      setError(t('login.noCredentials'));
      setPin('');
      return;
    }
    if (!ok) {
      const next = failedAttempts + 1;
      setFailedAttempts(next);
      try {
        localStorage.setItem('plannerLoginFails', String(next));
      } catch (e) {}
      if (next >= LOGIN_LOCK_THRESHOLD) {
        const until = Date.now() + LOGIN_LOCK_DURATION_MS;
        setLockUntil(until);
        setNow(Date.now());
        try {
          localStorage.setItem('plannerLoginLockUntil', String(until));
        } catch (e) {}
        setError(t('login.tooManyFails', {
          s: Math.ceil(LOGIN_LOCK_DURATION_MS / 1000)
        }));
      } else {
        setError(t('login.wrongPin', {
          n: LOGIN_LOCK_THRESHOLD - next
        }));
      }
      setPin('');
      return;
    }
    setFailedAttempts(0);
    setLockUntil(0);
    try {
      localStorage.removeItem('plannerLoginFails');
      localStorage.removeItem('plannerLoginLockUntil');
    } catch (e) {}
    // Opportunistically upgrade legacy SHA-256 / plaintext-pin records to
    // PBKDF2 on a successful login. The next save persists the new hash.
    let upgraded = user;
    if (user.pinAlgo !== PIN_PBKDF2_ALGO) {
      try {
        const newSalt = generatePinSalt();
        const newHash = await hashPin(pin, newSalt);
        const {
          pin: _plain,
          ...rest
        } = user;
        upgraded = {
          ...rest,
          pinHash: newHash,
          pinSalt: newSalt,
          pinAlgo: PIN_PBKDF2_ALGO
        };
      } catch (e) {/* fall back to original user on crypto failure */}
    }
    onLogin(upgraded);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
  }, /*#__PURE__*/React.createElement(ModalHeader, {
    title: t('login.title'),
    onClose: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "p-6 space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-700 mb-2 font-semibold"
  }, t('login.selectUser')), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, appUsers.map(u => {
    const active = selectedUserId === u.id;
    return /*#__PURE__*/React.createElement("button", {
      key: u.id,
      type: "button",
      onClick: () => {
        setSelectedUserId(u.id);
        setPin('');
        setError('');
      },
      className: `px-3 py-1.5 rounded-full text-sm border font-medium transition-colors ${active ? 'bg-gea-600 text-white border-gea-600' : 'bg-white text-slate-600 border-slate-300 hover:border-gea-400 hover:text-gea-700'}`
    }, u.name, u.role === 'admin' ? ' ★' : '');
  }))), selectedUserId && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-slate-700 mb-1 font-semibold"
  }, t('login.pinLabel')), /*#__PURE__*/React.createElement("input", {
    ref: pinRef,
    type: "password",
    value: pin,
    disabled: isLocked,
    onChange: e => {
      setPin(e.target.value);
      setError('');
    },
    onKeyDown: e => e.key === 'Enter' && !isLocked && handleLogin(),
    className: "w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400 disabled:bg-slate-100",
    placeholder: t('login.pinPlaceholder')
  })), error && /*#__PURE__*/React.createElement("p", {
    className: "text-rose-600 text-sm"
  }, error), isLocked && /*#__PURE__*/React.createElement("p", {
    className: "text-amber-700 text-sm"
  }, t('login.locked', {
    s: secondsLeft
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 pt-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "flex-1 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
  }, t('btn.cancel')), /*#__PURE__*/React.createElement("button", {
    onClick: handleLogin,
    disabled: !selectedUserId || isLocked,
    className: "flex-1 bg-gea-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gea-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  }, isLocked ? t('login.lockedBtn', {
    s: secondsLeft
  }) : t('login.loginBtn'))))));
};

// ─── CASCADE DELETE CONFIRMATION ─────────────────────────────────────────────
// Modal that shows which assignments + cost items would be deleted alongside
// a project or employee. Triggered from app.requestDeleteProject /
// requestDeleteEmployee whenever the entity has dependents. Confirming runs
// a single batched delete with full Undo from the audit log.
// Generic two-button confirmation. Used for destructive actions that don't
// have their own dependency-cascade modal: logout, delete app-user, delete a
// recurring assignment series. Body is a plain string; pass `\n` for line
// breaks. `danger` swaps the confirm button to a rose accent.
const ConfirmModal = ({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  danger = false,
  onConfirm,
  onCancel
}) => {
  useEscapeToClose(onCancel);
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
  }, /*#__PURE__*/React.createElement(ModalHeader, {
    title: title,
    onClose: onCancel
  }), /*#__PURE__*/React.createElement("div", {
    className: "p-6 space-y-4"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-700 whitespace-pre-wrap"
  }, message), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 pt-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    className: "flex-1 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
  }, cancelLabel), /*#__PURE__*/React.createElement("button", {
    onClick: onConfirm,
    className: `flex-1 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-gea-600 hover:bg-gea-700'} text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors`
  }, confirmLabel || 'Bestätigen')))));
};
const CascadeDeleteModal = ({
  entityKind,
  entityName,
  dependents,
  employees,
  projects,
  onConfirm,
  onCancel,
  t = k => k
}) => {
  useEscapeToClose(onCancel);
  const empById = useMemo(() => {
    const m = new Map();
    (employees || []).forEach(e => m.set(e.id, e));
    return m;
  }, [employees]);
  const projById = useMemo(() => {
    const m = new Map();
    (projects || []).forEach(p => m.set(p.id, p));
    return m;
  }, [projects]);

  // formatKW + describeAssignment live in utils.js; bind the lookup here.
  const describeAss = a => describeAssignment(a, id => projById.get(id));
  const total = (dependents.assignments?.length || 0) + (dependents.costItems?.length || 0);
  const kindLabel = entityKind === 'project' ? t('cascade.entityProject') : t('cascade.entityEmployee');
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
  }, /*#__PURE__*/React.createElement(ModalHeader, {
    title: t('cascade.deleteTitle', {
      kind: kindLabel
    }),
    subtitle: entityName,
    onClose: onCancel
  }), /*#__PURE__*/React.createElement("div", {
    className: "p-6 space-y-4 overflow-y-auto"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-700"
  }, t('cascade.willDelete', {
    kind: kindLabel,
    name: entityName
  })), dependents.assignments?.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2"
  }, t('cascade.assignments', {
    n: dependents.assignments.length,
    s: dependents.assignments.length !== 1 ? t('modal.assignmentPluralSuffix') : ''
  })), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-1 max-h-48 overflow-y-auto pr-1 border border-slate-100 rounded-md p-2 bg-slate-50"
  }, dependents.assignments.slice(0, 50).map(a => {
    const emp = empById.get(a.empId);
    return /*#__PURE__*/React.createElement("li", {
      key: a.id,
      className: "text-xs text-slate-700 flex justify-between gap-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "truncate"
    }, describeAss(a), " \xB7 ", emp?.name || '?'), /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400 shrink-0 tabular-nums"
    }, formatKW(a.week)));
  }), dependents.assignments.length > 50 && /*#__PURE__*/React.createElement("li", {
    className: "text-xs text-slate-400"
  }, t('cascade.andMore', {
    n: dependents.assignments.length - 50
  })))), dependents.costItems?.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2"
  }, t('cascade.costItems', {
    n: dependents.costItems.length,
    s: dependents.costItems.length !== 1 ? t('cascade.costItemPluralSuffix') : ''
  })), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-1 max-h-40 overflow-y-auto pr-1 border border-slate-100 rounded-md p-2 bg-slate-50"
  }, dependents.costItems.slice(0, 50).map(c => {
    const emp = empById.get(c.empId);
    const proj = projById.get(c.projectId);
    return /*#__PURE__*/React.createElement("li", {
      key: c.id,
      className: "text-xs text-slate-700 flex justify-between gap-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "truncate"
    }, c.description || t('cascade.costDefault'), entityKind === 'employee' && proj ? ` · ${proj.name}` : '', entityKind === 'project' && emp ? ` · ${emp.name}` : ''), /*#__PURE__*/React.createElement("span", {
      className: "text-slate-500 shrink-0 tabular-nums"
    }, (c.amount || 0).toFixed(2), " \u20AC"));
  }), dependents.costItems.length > 50 && /*#__PURE__*/React.createElement("li", {
    className: "text-xs text-slate-400"
  }, t('cascade.andMore', {
    n: dependents.costItems.length - 50
  })))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500"
  }, t('cascade.undoHint'))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    className: "px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium"
  }, t('btn.cancel')), /*#__PURE__*/React.createElement("button", {
    onClick: onConfirm,
    className: "px-4 py-2 text-sm text-white bg-rose-600 rounded-md hover:bg-rose-700 font-medium"
  }, t('cascade.deleteIncl', {
    n: total,
    entry: t(total === 1 ? 'cascade.entryWordSingular' : 'cascade.entryWordPlural')
  })))));
};

// --- MAIN APP ---