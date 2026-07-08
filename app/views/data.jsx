// ─── SYSTEM & EXPORT – kombinierter Verwaltungsreiter ────────────────────────
// Enthält: Benutzerverwaltung, Auto-Backup, Email-Vorlage, Daten-Export/Import,
// Rechnungsempfänger und System-Reset. Ersetzt den früher separaten
// "Benutzer"-Reiter.
const DataView = ({ s, h }) => {
    const { useState } = React;
    const { currentUser, appUsers, autoBackup, lastBackupAt, emailTemplate,
            invoiceRecipient, accountingRecipient, employees, empAliases, t } = s;
    const { setAppUsers, loginUser, setAutoBackup, runBackup, setEmailTemplate,
            setInvoiceRecipient, setAccountingRecipient, exportData, importData, showToast, requestConfirm,
            setEmpAliases } = h;

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
        setEmpAliases(prev => ({ ...prev, [norm]: newAliasEmpId }));
        setNewAliasName(''); setNewAliasEmpId('');
    };
    const reassignAlias = (alias, empId) =>
        setEmpAliases(prev => ({ ...prev, [alias]: empId }));
    const removeAlias = (alias) =>
        setEmpAliases(prev => {
            const { [alias]: _removed, ...rest } = prev;
            return rest;
        });

    if (!currentUser) {
        return (
            <main className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                {t('data.noAccess')}
            </main>
        );
    }

    // Show feedback as a real floating toast (anchored to the viewport, so
    // it stays visible regardless of scroll position) with a generous
    // duration. The inline `successMsg` banner is kept as a fallback for
    // contexts where the toast helper isn't available.
    const showSuccess = (msg, type = 'success') => {
        if (showToast) {
            showToast(msg, { type, duration: 6000 });
            return;
        }
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(''), 6000);
    };

    const handleAdd = async () => {
        if (!newName.trim()) { setNewError(t('data.nameRequired')); return; }
        if (newPin.length < 4) { setNewError(t('data.pinTooShort')); return; }
        if (newPin !== newPinConfirm) { setNewError(t('data.pinMismatch')); return; }
        if (appUsers.some(u => u.name.toLowerCase() === newName.trim().toLowerCase())) {
            setNewError(t('data.userExists')); return;
        }
        const pinSalt = generatePinSalt();
        const pinHash = await hashPin(newPin, pinSalt);
        const user = { id: makeId('usr'), name: newName.trim(), pinHash, pinSalt, pinAlgo: PIN_PBKDF2_ALGO, role: 'active' };
        setAppUsers(prev => [...prev, user]);
        setNewName(''); setNewPin(''); setNewPinConfirm(''); setNewError('');
        showSuccess(t('data.userCreated', { name: user.name }));
    };

    const handleDelete = (id) => {
        const user = appUsers.find(u => u.id === id);
        if (!user) return;
        requestConfirm({
            title: t('data.deleteUserTitle'),
            message: t('data.deleteUserMsg', { name: user.name }),
            confirmLabel: t('btn.delete'),
            danger: true,
            onConfirm: () => {
                setAppUsers(prev => prev.filter(u => u.id !== id));
                showSuccess(t('data.userDeleted', { name: user.name }));
            }
        });
    };

    const startEdit = (user) => {
        setEditingId(user.id); setEditName(user.name);
        setEditPin(''); setEditPinConfirm(''); setEditError('');
    };

    const handleSaveEdit = async (user) => {
        if (isAdmin && !editName.trim()) { setEditError(t('data.nameRequired')); return; }
        if (editPin && editPin.length < 4) { setEditError(t('data.pinTooShort')); return; }
        if (editPin && editPin !== editPinConfirm) { setEditError(t('data.pinMismatch')); return; }
        if (!editPin) { setEditError(t('data.enterNewPin')); return; }
        const pinSalt = generatePinSalt();
        const pinHash = await hashPin(editPin, pinSalt);
        const { pin: _legacyPin, ...rest } = user;
        const updated = {
            ...rest,
            name: isAdmin ? editName.trim() : user.name,
            pinHash, pinSalt, pinAlgo: PIN_PBKDF2_ALGO,
        };
        setAppUsers(prev => prev.map(u => u.id === user.id ? updated : u));
        if (currentUser.id === user.id) loginUser(updated);
        setEditingId(null);
        showSuccess(t('data.pinSaved', { name: updated.name }));
    };

    const canEdit = (user) => isAdmin
        ? (user.role !== 'admin' || user.id === currentUser.id) // Admin darf sich selbst und Nicht-Admins bearbeiten
        : user.id === currentUser.id;

    const section = (title, body) => (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
            </div>
            {body}
        </div>
    );

    return (
        <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-6 space-y-6">

                <div className="flex items-center gap-4">
                    <IconSettings size={36} className="text-slate-300 shrink-0"/>
                    <div>
                        <h2 className="text-xl text-slate-900 font-medium">{t('data.title')}</h2>
                        <p className="text-sm text-slate-500">{t('data.subtitle')}</p>
                    </div>
                </div>

                {successMsg && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm">
                        {successMsg}
                    </div>
                )}

            {/* Zwei unabhängige Spalten-Stacks: links Konten/Zugriff, rechts
                System-Einstellungen. Der Reset-Button bleibt unten außerhalb
                der Spalten – als riskante Aktion visuell abgesetzt. */}
            <div className="grid lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">

                {/* ── Benutzer ─────────────────────────────────────────── */}
                {section(t('data.sectionUsers'), (
                    appUsers.length === 0 ? (
                        <div className="px-4 py-6 text-center text-slate-400 text-sm">{t('data.noUsers')}</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {appUsers.map(user => (
                                <div key={user.id}>
                                    {editingId === user.id ? (
                                        <div className="p-4 space-y-3 bg-gea-50">
                                            {isAdmin && (
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">{t('data.fieldName')}</label>
                                                    <input type="text" value={editName}
                                                        onChange={e => { setEditName(e.target.value); setEditError(''); }}
                                                        className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400"/>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">{t('data.fieldNewPin')}</label>
                                                    <input type="password" value={editPin} autoFocus
                                                        onChange={e => { setEditPin(e.target.value); setEditError(''); }}
                                                        className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400"
                                                        placeholder={t('data.pinMinLength')}/>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">{t('data.fieldConfirmPin')}</label>
                                                    <input type="password" value={editPinConfirm}
                                                        onChange={e => { setEditPinConfirm(e.target.value); setEditError(''); }}
                                                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit(user)}
                                                        className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400"
                                                        placeholder={t('data.pinRepeat')}/>
                                                </div>
                                            </div>
                                            {editError && <p className="text-rose-600 text-xs">{editError}</p>}
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">{t('btn.cancel')}</button>
                                                <button onClick={() => handleSaveEdit(user)} className="px-3 py-1.5 text-xs rounded bg-gea-600 text-white hover:bg-gea-700 transition-colors">{t('btn.save')}</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 px-4 py-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${user.role === 'admin' ? 'bg-gea-100 text-gea-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {user.name.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-slate-900 truncate">{user.name}</span>
                                                    {user.role === 'admin' && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-gea-100 text-gea-700 font-medium shrink-0">{t('data.roleAdmin')}</span>
                                                    )}
                                                    {currentUser.id === user.id && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">{t('data.roleMe')}</span>
                                                    )}
                                                </div>
                                            </div>
                                            {canEdit(user) && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => startEdit(user)} className="px-2.5 py-1.5 text-xs rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                                                        {isAdmin ? t('btn.edit') : t('btn.changePin')}
                                                    </button>
                                                    {isAdmin && (
                                                        <button onClick={() => handleDelete(user.id)} className="px-2.5 py-1.5 text-xs rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors">
                                                            {t('btn.delete')}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                ))}

                {/* Neuen Nutzer anlegen – Admins */}
                {isAdmin && section(t('data.sectionNewUser'), (
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('data.fieldName')}</label>
                                <input type="text" value={newName}
                                    onChange={e => { setNewName(e.target.value); setNewError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                    className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400"
                                    placeholder="z.B. Max Mustermann"/>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('data.fieldNewPin')}</label>
                                <input type="password" value={newPin}
                                    onChange={e => { setNewPin(e.target.value); setNewError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                    className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400"
                                    placeholder={t('data.pinMinLength')}/>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('data.fieldConfirmPin')}</label>
                                <input type="password" value={newPinConfirm}
                                    onChange={e => { setNewPinConfirm(e.target.value); setNewError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                    className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400"
                                    placeholder={t('data.pinRepeat')}/>
                            </div>
                        </div>
                        {newError && <p className="text-rose-600 text-xs">{newError}</p>}
                        <button onClick={handleAdd}
                            disabled={!newName.trim() || newPin.length < 4 || newPin !== newPinConfirm}
                            className="px-4 py-2 bg-gea-600 text-white rounded-lg text-sm font-medium hover:bg-gea-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                            {t('btn.add')}
                        </button>
                        <p className="text-xs text-slate-400">{t('data.newUserRole')}</p>
                    </div>
                ))}

                {/* ── Spesen-Import: Namens-Aliase ─────────────────────── */}
                {section(t('data.sectionAliases'), (
                    <div>
                        <p className="px-4 pt-3 pb-2 text-xs text-slate-500">{t('data.aliasHint')}</p>
                        {aliasEntries.length === 0 ? (
                            <div className="px-4 py-5 text-center text-slate-400 text-sm">{t('data.noAliases')}</div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {aliasEntries.map(([alias, empId]) => {
                                    const known = employees?.some(e => e.id === empId);
                                    return (
                                        <li key={alias} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                                            <span className="flex-1 text-slate-800 font-medium truncate" title={alias}>„{alias}"</span>
                                            <span className="text-slate-400 shrink-0">→</span>
                                            <select value={known ? empId : ''}
                                                onChange={e => e.target.value && reassignAlias(alias, e.target.value)}
                                                className={`p-1.5 border rounded text-sm bg-white max-w-52 ${known ? 'border-slate-300 text-slate-700' : 'border-rose-300 text-rose-600'}`}>
                                                {!known && <option value="">{t('data.aliasOrphan')}</option>}
                                                {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                            </select>
                                            <button onClick={() => removeAlias(alias)}
                                                className="text-rose-500 hover:text-rose-700 p-1 shrink-0" title={t('btn.delete')}>
                                                <IconX size={15}/>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <div className="p-4 border-t border-slate-200 flex gap-2 flex-wrap items-center bg-slate-50/50">
                            <input type="text" value={newAliasName}
                                onChange={e => setNewAliasName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addAlias()}
                                placeholder={t('data.aliasPlaceholder')}
                                className="flex-1 min-w-40 p-2 border border-slate-300 rounded text-sm"/>
                            <span className="text-slate-400 text-sm">→</span>
                            <select value={newAliasEmpId} onChange={e => setNewAliasEmpId(e.target.value)}
                                className="p-2 border border-slate-300 rounded text-sm bg-white text-slate-600 max-w-52">
                                <option value="">{t('expense.selectProfile')}</option>
                                {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                            <button onClick={addAlias} disabled={!newAliasName.trim() || !newAliasEmpId}
                                className="bg-gea-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gea-700 disabled:opacity-40">
                                {t('btn.add')}
                            </button>
                        </div>
                    </div>
                ))}

            </div>
            <div className="space-y-6">

                {/* Auto-Backup – Admins */}
                {isAdmin && autoBackup && section(t('data.sectionBackup'), (
                    <div className="p-4 space-y-3">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={!!autoBackup.enabled}
                                onChange={e => setAutoBackup(prev => ({ ...prev, enabled: e.target.checked }))}/>
                            {t('data.enableBackup')}
                        </label>
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                            <span>{t('data.fieldInterval')}</span>
                            <input type="number" min="5" step="5"
                                value={autoBackup.intervalMinutes || 60}
                                onChange={e => {
                                    const v = parseInt(e.target.value, 10);
                                    if (!Number.isFinite(v) || v < 5) return;
                                    setAutoBackup(prev => ({ ...prev, intervalMinutes: v }));
                                }}
                                className="w-20 p-1 border border-slate-300 rounded text-sm"/>
                            <span>{t('data.fieldMinutes')}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            {t('data.fieldLastBackup')} {lastBackupAt ? new Date(lastBackupAt).toLocaleString('de-DE') : '—'}
                        </div>
                        <button
                            onClick={async () => {
                                const res = await runBackup('manual');
                                if (res.ok) {
                                    showSuccess(t('data.backupCreated', { target: res.target === 'fs' ? t('data.backupLocal') : 'SharePoint' }));
                                } else {
                                    showSuccess(t('data.backupFailed', { error: res.error || t('data.backupErrUnknown') }), 'warning');
                                }
                            }}
                            className="px-3 py-1.5 text-xs rounded bg-gea-600 text-white hover:bg-gea-700 transition-colors">
                            {t('data.backupNow')}
                        </button>
                        <p className="text-xs text-slate-400">{t('data.backupLocation')}</p>
                    </div>
                ))}

                {/* Email-Vorlage – Admins */}
                {isAdmin && emailTemplate && section(t('data.sectionEmail'), (
                    <div className="p-4 space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('data.emailSubject')}</label>
                            <input type="text" value={emailTemplate.subject || ''}
                                onChange={e => setEmailTemplate(prev => ({ ...prev, subject: e.target.value }))}
                                className="w-full p-2 border border-slate-300 rounded text-sm font-mono"/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('data.emailBody')}</label>
                            <textarea value={emailTemplate.body || ''}
                                onChange={e => setEmailTemplate(prev => ({ ...prev, body: e.target.value }))}
                                rows={12}
                                className="w-full p-2 border border-slate-300 rounded text-xs font-mono leading-relaxed"/>
                        </div>
                        <div className="text-xs text-slate-500 leading-relaxed">
                            {t('data.emailPlaceholders')}
                            {' '}<code>{'{firstName}'}</code>,
                            {' '}<code>{'{refLabel}'}</code>,
                            {' '}<code>{'{typeLabel}'}</code>,
                            {' '}<code>{'{weekRange}'}</code>,
                            {' '}<code>{'{comment}'}</code>,
                            {' '}<code>{'{attachmentNote}'}</code>.<br/>
                            {t('data.emailOptBlocks')}
                            {' '}<code>{'{{#comment}}…{{/comment}}'}</code>,
                            {' '}<code>{'{{#attachmentNote}}…{{/attachmentNote}}'}</code>.
                        </div>
                        <button
                            onClick={() => { setEmailTemplate(DEFAULT_EMAIL_TEMPLATE); showSuccess(t('data.templateReset')); }}
                            className="px-3 py-1.5 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                            {t('data.resetToDefault')}
                        </button>
                    </div>
                ))}

                {/* Rechnungsempfänger */}
                {section(t('data.sectionInvoice'), (
                    <div className="p-4">
                        <input type="email" value={invoiceRecipient}
                            onChange={e => setInvoiceRecipient(e.target.value)}
                            placeholder="rechnung@kunde.de"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gea-400"/>
                        <p className="text-xs text-slate-400 mt-1">{t('data.invoiceHint')}</p>
                    </div>
                ))}

                {/* Buchhaltung (Reisekosten-Gutschriften, Prozess 2 –
                    getrennt vom Rechnungsempfänger/Auftragszentrum) */}
                {section(t('data.sectionAccounting'), (
                    <div className="p-4">
                        <input type="email" value={accountingRecipient}
                            onChange={e => setAccountingRecipient(e.target.value)}
                            placeholder="buchhaltung@firma.de"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gea-400"/>
                        <p className="text-xs text-slate-400 mt-1">{t('data.accountingHint')}</p>
                    </div>
                ))}

                {/* Export / Import */}
                {section(t('data.sectionExport'), (
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={exportData} className="bg-gea-600 hover:bg-gea-700 text-white py-3 rounded-lg flex justify-center items-center gap-2 font-medium transition-colors">
                                <IconDownload size={18}/> {t('data.exportBtn')}
                            </button>
                            <div className="relative">
                                <input type="file" accept=".json" onChange={importData} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <button className="w-full bg-white border-2 border-dashed border-slate-300 hover:border-gea-400 text-slate-600 py-3 rounded-lg flex justify-center items-center gap-2 font-medium transition-colors">
                                    <IconUpload size={18}/> {t('data.importBtn')}
                                </button>
                            </div>
                        </div>
                        <DepsSection t={t}/>
                    </div>
                ))}

            </div>
            </div>

                {/* Reset – bewusst schmal statt volle 7xl-Breite: eine
                    destruktive Aktion soll nicht wie ein prominenter,
                    breiter Primär-Button wirken. */}
                {isAdmin && (
                    <div className="max-w-md mx-auto">
                    <button onClick={() => {
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
                                            method: 'POST', credentials: 'include',
                                            headers: { 'X-RequestDigest': digest, 'Accept': 'application/json;odata=verbose' }
                                        }).catch(() => {});
                                        const dataFolder = SP_CONTEXT.folderPath + '/' + PLANNER_DATA_DIR;
                                        await fetch(`${SP_CONTEXT.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${SP_ENC(dataFolder)}')/recycle()`, {
                                            method: 'POST', credentials: 'include',
                                            headers: { 'X-RequestDigest': digest, 'Accept': 'application/json;odata=verbose' }
                                        }).catch(() => {});
                                    } catch(e) {}
                                }
                                window.location.reload();
                            },
                        });
                    }} className="w-full text-rose-500 hover:bg-rose-50 py-3 rounded-lg text-sm font-medium transition-colors border border-rose-200">
                        {t('data.resetSystem')}
                    </button>
                    </div>
                )}
            </div>
        </main>
    );
};
