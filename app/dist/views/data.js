// ─── SYSTEM & EXPORT – kombinierter Verwaltungsreiter ────────────────────────
// Enthält: Benutzerverwaltung, Auto-Backup, Email-Vorlage, Daten-Export/Import,
// Rechnungsempfänger und System-Reset. Ersetzt den früher separaten
// "Benutzer"-Reiter.
const DataView = ({
  s,
  h
}) => {
  const {
    useState
  } = React;
  const {
    currentUser,
    appUsers,
    autoBackup,
    lastBackupAt,
    emailTemplate,
    invoiceRecipient,
    accountingRecipient,
    employees,
    empAliases,
    t
  } = s;
  const {
    setAppUsers,
    loginUser,
    setAutoBackup,
    runBackup,
    setEmailTemplate,
    setInvoiceRecipient,
    setAccountingRecipient,
    exportData,
    importData,
    showToast,
    requestConfirm,
    setEmpAliases
  } = h;
  const isAdmin = currentUser?.role === 'admin';

  // ── User-Edit-State ──
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [newError, setNewError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editPin, setEditPin] = useState('');
  const [editPinConfirm, setEditPinConfirm] = useState('');
  const [editError, setEditError] = useState('');
  const [editName, setEditName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Spesen-Import: Namens-Aliase ──
  const [newAliasName, setNewAliasName] = useState('');
  const [newAliasEmpId, setNewAliasEmpId] = useState('');
  const activeEmployees = (employees || []).filter(e => e.active !== false);
  const aliasEntries = Object.entries(empAliases || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const addAlias = () => {
    const norm = normalizeEmpName(newAliasName);
    if (!norm || !newAliasEmpId) return;
    setEmpAliases(prev => ({
      ...prev,
      [norm]: newAliasEmpId
    }));
    setNewAliasName('');
    setNewAliasEmpId('');
  };
  const reassignAlias = (alias, empId) => setEmpAliases(prev => ({
    ...prev,
    [alias]: empId
  }));
  const removeAlias = alias => setEmpAliases(prev => {
    const {
      [alias]: _removed,
      ...rest
    } = prev;
    return rest;
  });
  if (!currentUser) {
    return /*#__PURE__*/React.createElement("main", {
      className: "flex-1 flex items-center justify-center text-slate-400 text-sm"
    }, t('data.noAccess'));
  }

  // Show feedback as a real floating toast (anchored to the viewport, so
  // it stays visible regardless of scroll position) with a generous
  // duration. The inline `successMsg` banner is kept as a fallback for
  // contexts where the toast helper isn't available.
  const showSuccess = (msg, type = 'success') => {
    if (showToast) {
      showToast(msg, {
        type,
        duration: 6000
      });
      return;
    }
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 6000);
  };
  const handleAdd = async () => {
    if (!newName.trim()) {
      setNewError(t('data.nameRequired'));
      return;
    }
    if (newPin.length < 4) {
      setNewError(t('data.pinTooShort'));
      return;
    }
    if (newPin !== newPinConfirm) {
      setNewError(t('data.pinMismatch'));
      return;
    }
    if (appUsers.some(u => u.name.toLowerCase() === newName.trim().toLowerCase())) {
      setNewError(t('data.userExists'));
      return;
    }
    const pinSalt = generatePinSalt();
    const pinHash = await hashPin(newPin, pinSalt);
    const user = {
      id: makeId('usr'),
      name: newName.trim(),
      pinHash,
      pinSalt,
      pinAlgo: PIN_PBKDF2_ALGO,
      role: 'active'
    };
    setAppUsers(prev => [...prev, user]);
    setNewName('');
    setNewPin('');
    setNewPinConfirm('');
    setNewError('');
    showSuccess(t('data.userCreated', {
      name: user.name
    }));
  };
  const handleDelete = id => {
    const user = appUsers.find(u => u.id === id);
    if (!user) return;
    requestConfirm({
      title: t('data.deleteUserTitle'),
      message: t('data.deleteUserMsg', {
        name: user.name
      }),
      confirmLabel: t('btn.delete'),
      danger: true,
      onConfirm: () => {
        setAppUsers(prev => prev.filter(u => u.id !== id));
        showSuccess(t('data.userDeleted', {
          name: user.name
        }));
      }
    });
  };
  const startEdit = user => {
    setEditingId(user.id);
    setEditName(user.name);
    setEditPin('');
    setEditPinConfirm('');
    setEditError('');
  };
  const handleSaveEdit = async user => {
    if (isAdmin && !editName.trim()) {
      setEditError(t('data.nameRequired'));
      return;
    }
    if (editPin && editPin.length < 4) {
      setEditError(t('data.pinTooShort'));
      return;
    }
    if (editPin && editPin !== editPinConfirm) {
      setEditError(t('data.pinMismatch'));
      return;
    }
    if (!editPin) {
      setEditError(t('data.enterNewPin'));
      return;
    }
    const pinSalt = generatePinSalt();
    const pinHash = await hashPin(editPin, pinSalt);
    const {
      pin: _legacyPin,
      ...rest
    } = user;
    const updated = {
      ...rest,
      name: isAdmin ? editName.trim() : user.name,
      pinHash,
      pinSalt,
      pinAlgo: PIN_PBKDF2_ALGO
    };
    setAppUsers(prev => prev.map(u => u.id === user.id ? updated : u));
    if (currentUser.id === user.id) loginUser(updated);
    setEditingId(null);
    showSuccess(t('data.pinSaved', {
      name: updated.name
    }));
  };
  const canEdit = user => isAdmin ? user.role !== 'admin' || user.id === currentUser.id // Admin darf sich selbst und Nicht-Admins bearbeiten
  : user.id === currentUser.id;
  const section = (title, body) => /*#__PURE__*/React.createElement("div", {
    className: "bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-3 bg-slate-50 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-semibold text-slate-700 uppercase tracking-wide"
  }, title)), body);
  return /*#__PURE__*/React.createElement("main", {
    className: "flex-1 overflow-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-7xl mx-auto p-6 space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4"
  }, /*#__PURE__*/React.createElement(IconSettings, {
    size: 36,
    className: "text-slate-300 shrink-0"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "text-xl text-slate-900 font-medium"
  }, t('data.title')), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-500"
  }, t('data.subtitle')))), successMsg && /*#__PURE__*/React.createElement("div", {
    className: "bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm"
  }, successMsg), /*#__PURE__*/React.createElement("div", {
    className: "grid lg:grid-cols-2 gap-6 items-start"
  }, /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, section(t('data.sectionUsers'), appUsers.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-6 text-center text-slate-400 text-sm"
  }, t('data.noUsers')) : /*#__PURE__*/React.createElement("div", {
    className: "divide-y divide-slate-100"
  }, appUsers.map(user => /*#__PURE__*/React.createElement("div", {
    key: user.id
  }, editingId === user.id ? /*#__PURE__*/React.createElement("div", {
    className: "p-4 space-y-3 bg-gea-50"
  }, isAdmin && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-semibold text-slate-600 mb-1"
  }, t('data.fieldName')), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: editName,
    onChange: e => {
      setEditName(e.target.value);
      setEditError('');
    },
    className: "w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-semibold text-slate-600 mb-1"
  }, t('data.fieldNewPin')), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: editPin,
    autoFocus: true,
    onChange: e => {
      setEditPin(e.target.value);
      setEditError('');
    },
    className: "w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400",
    placeholder: t('data.pinMinLength')
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-semibold text-slate-600 mb-1"
  }, t('data.fieldConfirmPin')), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: editPinConfirm,
    onChange: e => {
      setEditPinConfirm(e.target.value);
      setEditError('');
    },
    onKeyDown: e => e.key === 'Enter' && handleSaveEdit(user),
    className: "w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400",
    placeholder: t('data.pinRepeat')
  }))), editError && /*#__PURE__*/React.createElement("p", {
    className: "text-rose-600 text-xs"
  }, editError), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditingId(null),
    className: "px-3 py-1.5 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
  }, t('btn.cancel')), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleSaveEdit(user),
    className: "px-3 py-1.5 text-xs rounded bg-gea-600 text-white hover:bg-gea-700 transition-colors"
  }, t('btn.save')))) : /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: `w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${user.role === 'admin' ? 'bg-gea-100 text-gea-700' : 'bg-slate-100 text-slate-600'}`
  }, user.name.slice(0, 2).toUpperCase()), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-medium text-slate-900 truncate"
  }, user.name), user.role === 'admin' && /*#__PURE__*/React.createElement("span", {
    className: "text-xs px-1.5 py-0.5 rounded-full bg-gea-100 text-gea-700 font-medium shrink-0"
  }, t('data.roleAdmin')), currentUser.id === user.id && /*#__PURE__*/React.createElement("span", {
    className: "text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0"
  }, t('data.roleMe')))), canEdit(user) && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1 shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => startEdit(user),
    className: "px-2.5 py-1.5 text-xs rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
  }, isAdmin ? t('btn.edit') : t('btn.changePin')), isAdmin && /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDelete(user.id),
    className: "px-2.5 py-1.5 text-xs rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
  }, t('btn.delete')))))))), isAdmin && section(t('data.sectionNewUser'), /*#__PURE__*/React.createElement("div", {
    className: "p-4 space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-semibold text-slate-600 mb-1"
  }, t('data.fieldName')), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newName,
    onChange: e => {
      setNewName(e.target.value);
      setNewError('');
    },
    onKeyDown: e => e.key === 'Enter' && handleAdd(),
    className: "w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400",
    placeholder: "z.B. Max Mustermann"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-semibold text-slate-600 mb-1"
  }, t('data.fieldNewPin')), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: newPin,
    onChange: e => {
      setNewPin(e.target.value);
      setNewError('');
    },
    onKeyDown: e => e.key === 'Enter' && handleAdd(),
    className: "w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400",
    placeholder: t('data.pinMinLength')
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-semibold text-slate-600 mb-1"
  }, t('data.fieldConfirmPin')), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: newPinConfirm,
    onChange: e => {
      setNewPinConfirm(e.target.value);
      setNewError('');
    },
    onKeyDown: e => e.key === 'Enter' && handleAdd(),
    className: "w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400",
    placeholder: t('data.pinRepeat')
  }))), newError && /*#__PURE__*/React.createElement("p", {
    className: "text-rose-600 text-xs"
  }, newError), /*#__PURE__*/React.createElement("button", {
    onClick: handleAdd,
    disabled: !newName.trim() || newPin.length < 4 || newPin !== newPinConfirm,
    className: "px-4 py-2 bg-gea-600 text-white rounded-lg text-sm font-medium hover:bg-gea-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  }, t('btn.add')), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, t('data.newUserRole')))), section(t('data.sectionAliases'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "px-4 pt-3 pb-2 text-xs text-slate-500"
  }, t('data.aliasHint')), aliasEntries.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-5 text-center text-slate-400 text-sm"
  }, t('data.noAliases')) : /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-slate-100"
  }, aliasEntries.map(([alias, empId]) => {
    const known = employees?.some(e => e.id === empId);
    return /*#__PURE__*/React.createElement("li", {
      key: alias,
      className: "px-4 py-2.5 flex items-center gap-3 text-sm"
    }, /*#__PURE__*/React.createElement("span", {
      className: "flex-1 text-slate-800 font-medium truncate",
      title: alias
    }, "\u201E", alias, "\""), /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400 shrink-0"
    }, "\u2192"), /*#__PURE__*/React.createElement("select", {
      value: known ? empId : '',
      onChange: e => e.target.value && reassignAlias(alias, e.target.value),
      className: `p-1.5 border rounded text-sm bg-white max-w-52 ${known ? 'border-slate-300 text-slate-700' : 'border-rose-300 text-rose-600'}`
    }, !known && /*#__PURE__*/React.createElement("option", {
      value: ""
    }, t('data.aliasOrphan')), activeEmployees.map(e => /*#__PURE__*/React.createElement("option", {
      key: e.id,
      value: e.id
    }, e.name))), /*#__PURE__*/React.createElement("button", {
      onClick: () => removeAlias(alias),
      className: "text-rose-500 hover:text-rose-700 p-1 shrink-0",
      title: t('btn.delete')
    }, /*#__PURE__*/React.createElement(IconX, {
      size: 15
    })));
  })), /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-t border-slate-200 flex gap-2 flex-wrap items-center bg-slate-50/50"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newAliasName,
    onChange: e => setNewAliasName(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addAlias(),
    placeholder: t('data.aliasPlaceholder'),
    className: "flex-1 min-w-40 p-2 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 text-sm"
  }, "\u2192"), /*#__PURE__*/React.createElement("select", {
    value: newAliasEmpId,
    onChange: e => setNewAliasEmpId(e.target.value),
    className: "p-2 border border-slate-300 rounded text-sm bg-white text-slate-600 max-w-52"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t('expense.selectProfile')), activeEmployees.map(e => /*#__PURE__*/React.createElement("option", {
    key: e.id,
    value: e.id
  }, e.name))), /*#__PURE__*/React.createElement("button", {
    onClick: addAlias,
    disabled: !newAliasName.trim() || !newAliasEmpId,
    className: "bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700 disabled:opacity-40"
  }, t('btn.add')))))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, isAdmin && autoBackup && section(t('data.sectionBackup'), /*#__PURE__*/React.createElement("div", {
    className: "p-4 space-y-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-sm text-slate-700"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!autoBackup.enabled,
    onChange: e => setAutoBackup(prev => ({
      ...prev,
      enabled: e.target.checked
    }))
  }), t('data.enableBackup')), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-sm text-slate-700"
  }, /*#__PURE__*/React.createElement("span", null, t('data.fieldInterval')), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "5",
    step: "5",
    value: autoBackup.intervalMinutes || 60,
    onChange: e => {
      const v = parseInt(e.target.value, 10);
      if (!Number.isFinite(v) || v < 5) return;
      setAutoBackup(prev => ({
        ...prev,
        intervalMinutes: v
      }));
    },
    className: "w-20 p-1 border border-slate-300 rounded text-sm"
  }), /*#__PURE__*/React.createElement("span", null, t('data.fieldMinutes'))), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, t('data.fieldLastBackup'), " ", lastBackupAt ? new Date(lastBackupAt).toLocaleString('de-DE') : '—'), /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      const res = await runBackup('manual');
      if (res.ok) {
        showSuccess(t('data.backupCreated', {
          target: res.target === 'fs' ? t('data.backupLocal') : 'SharePoint'
        }));
      } else {
        showSuccess(t('data.backupFailed', {
          error: res.error || t('data.backupErrUnknown')
        }), 'warning');
      }
    },
    className: "px-3 py-1.5 text-xs rounded bg-gea-600 text-white hover:bg-gea-700 transition-colors"
  }, t('data.backupNow')), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, t('data.backupLocation')))), isAdmin && emailTemplate && section(t('data.sectionEmail'), /*#__PURE__*/React.createElement("div", {
    className: "p-4 space-y-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-semibold text-slate-600 mb-1"
  }, t('data.emailSubject')), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: emailTemplate.subject || '',
    onChange: e => setEmailTemplate(prev => ({
      ...prev,
      subject: e.target.value
    })),
    className: "w-full p-2 border border-slate-300 rounded text-sm font-mono"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-semibold text-slate-600 mb-1"
  }, t('data.emailBody')), /*#__PURE__*/React.createElement("textarea", {
    value: emailTemplate.body || '',
    onChange: e => setEmailTemplate(prev => ({
      ...prev,
      body: e.target.value
    })),
    rows: 12,
    className: "w-full p-2 border border-slate-300 rounded text-xs font-mono leading-relaxed"
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 leading-relaxed"
  }, t('data.emailPlaceholders'), ' ', /*#__PURE__*/React.createElement("code", null, '{firstName}'), ",", ' ', /*#__PURE__*/React.createElement("code", null, '{refLabel}'), ",", ' ', /*#__PURE__*/React.createElement("code", null, '{typeLabel}'), ",", ' ', /*#__PURE__*/React.createElement("code", null, '{weekRange}'), ",", ' ', /*#__PURE__*/React.createElement("code", null, '{comment}'), ",", ' ', /*#__PURE__*/React.createElement("code", null, '{attachmentNote}'), ".", /*#__PURE__*/React.createElement("br", null), t('data.emailOptBlocks'), ' ', /*#__PURE__*/React.createElement("code", null, '{{#comment}}…{{/comment}}'), ",", ' ', /*#__PURE__*/React.createElement("code", null, '{{#attachmentNote}}…{{/attachmentNote}}'), "."), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEmailTemplate(DEFAULT_EMAIL_TEMPLATE);
      showSuccess(t('data.templateReset'));
    },
    className: "px-3 py-1.5 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
  }, t('data.resetToDefault')))), section(t('data.sectionInvoice'), /*#__PURE__*/React.createElement("div", {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: invoiceRecipient,
    onChange: e => setInvoiceRecipient(e.target.value),
    placeholder: "rechnung@kunde.de",
    className: "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gea-400"
  }), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 mt-1"
  }, t('data.invoiceHint')))), section(t('data.sectionAccounting'), /*#__PURE__*/React.createElement("div", {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: accountingRecipient,
    onChange: e => setAccountingRecipient(e.target.value),
    placeholder: "buchhaltung@firma.de",
    className: "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gea-400"
  }), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 mt-1"
  }, t('data.accountingHint')))), section(t('data.sectionExport'), /*#__PURE__*/React.createElement("div", {
    className: "p-4 space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: exportData,
    className: "bg-gea-600 hover:bg-gea-700 text-white py-3 rounded-lg flex justify-center items-center gap-2 font-medium transition-colors"
  }, /*#__PURE__*/React.createElement(IconDownload, {
    size: 18
  }), " ", t('data.exportBtn')), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: ".json",
    onChange: importData,
    className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer"
  }), /*#__PURE__*/React.createElement("button", {
    className: "w-full bg-white border-2 border-dashed border-slate-300 hover:border-gea-400 text-slate-600 py-3 rounded-lg flex justify-center items-center gap-2 font-medium transition-colors"
  }, /*#__PURE__*/React.createElement(IconUpload, {
    size: 18
  }), " ", t('data.importBtn')))), /*#__PURE__*/React.createElement(DepsSection, {
    t: t
  }))))), isAdmin && /*#__PURE__*/React.createElement("div", {
    className: "max-w-md mx-auto"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      requestConfirm({
        title: t('data.resetSystem'),
        message: t('data.deleteAll'),
        confirmLabel: t('btn.delete') || 'Löschen',
        danger: true,
        onConfirm: async () => {
          localStorage.removeItem('teamMasterProData');
          if (SP_CONTEXT) {
            try {
              const digest = await spGetDigest(SP_CONTEXT.siteUrl);
              await fetch(`${SP_CONTEXT.siteUrl}/_api/web/GetFileByServerRelativeUrl('${SP_ENC(SP_CONTEXT.stateFilePath)}')/recycle()`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'X-RequestDigest': digest,
                  'Accept': 'application/json;odata=verbose'
                }
              }).catch(() => {});
              const dataFolder = SP_CONTEXT.folderPath + '/' + PLANNER_DATA_DIR;
              await fetch(`${SP_CONTEXT.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${SP_ENC(dataFolder)}')/recycle()`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'X-RequestDigest': digest,
                  'Accept': 'application/json;odata=verbose'
                }
              }).catch(() => {});
            } catch (e) {}
          }
          window.location.reload();
        }
      });
    },
    className: "w-full text-rose-500 hover:bg-rose-50 py-3 rounded-lg text-sm font-medium transition-colors border border-rose-200"
  }, t('data.resetSystem')))));
};