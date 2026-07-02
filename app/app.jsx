// --- MAIN APP ---
function App() {
    // Local aliases for React hooks; avoids duplicate top-level `const` clash
    // when multiple pre-compiled scripts share the same browser global scope.
    const { useState, useEffect, useRef, useMemo, useCallback } = React;

    // --- STATE ---
    const [activeTab, setActiveTab] = useState('resource'); 
    
    const [employees, setEmployees] = useState([]);
    const [projects, setProjects] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [expenses, setExpenses] = useState([]); // legacy, migrated to costItems
    const [costItems, setCostItems] = useState([]);
    
    // Dynamic Categories
    const [empCategories, setEmpCategories] = useState(['AS', 'CMS', 'CSS', 'HM', 'I&C', 'Other']);
    const [projCategories, setProjCategories] = useState(['AMS', 'AFS', 'CMS', 'Other']);
    const [projTypes, setProjTypes] = useState([]);
    const [basicTasks, setBasicTasks] = useState(['Office']);
    const [basicTasksMeta, setBasicTasksMeta] = useState({});       // { [taskName]: { createdAt: ISO, permanent: bool, color?: string } }
    const [inactiveBasicTasks, setInactiveBasicTasks] = useState([]); // [{ name, createdAt }]
    const [basicTasksSubTab, setBasicTasksSubTab] = useState('aktiv');
    const [offtimeTasks, setOfftimeTasks] = useState(['Vacation', 'Sickness', 'Gleitzeit', 'Other']);
    const [inactiveOfftimeTasks, setInactiveOfftimeTasks] = useState([]); // [{ name }]
    const [inactiveSupportTasks, setInactiveSupportTasks] = useState([]); // string[]
    const [inactiveTrainingTasks, setInactiveTrainingTasks] = useState([]); // string[]
    const [customTrainingTasks, setCustomTrainingTasks] = useState([]); // user-added training tasks
    const [isChangelogOpen, setIsChangelogOpen] = useState(false);

    const [weeks, setWeeks] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [collapsedCategories, setCollapsedCategories] = useState({});
    const [collapsedProjCategories, setCollapsedProjCategories] = useState({});
    const [collapsedEmpSetup, setCollapsedEmpSetup] = useState({});

    // Ansichten-Steuerung für Projekt-Details
    const [selectedProjectDetails, setSelectedProjectDetails] = useState(null);

    // Zeitspanne für Auslastungs-Berechnung
    const [weeksAhead, setWeeksAhead] = useState(DEFAULT_WEEKS_AHEAD);

    // Compact chip rendering shared by Ressourcen + Support so the choice
    // survives tab switches. Logged-in users have this persisted per-user
    // via user.preferences.compactView (restored on login, written back on
    // change).
    const [compactView, setCompactView] = useState(true);

    // UI language ('de' | 'en'). Per-user preference, stored alongside compactView.
    const [language, setLanguage] = useState('de');
    const t = useMemo(() => makeT(language), [language]);

    // Auslastung click → Ressourcen jump: target week to scroll to once
    // ResourceView mounts. Cleared after the scroll runs.
    const [scrollTarget, setScrollTarget] = useState(null);

    // Modals
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignContext, setAssignContext] = useState(null); 
    
    const [isCostItemModalOpen, setIsCostItemModalOpen] = useState(false);
    const [editingCostItem, setEditingCostItem] = useState(null);

    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [copyContext, setCopyContext] = useState(null);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [pastProjectsExpanded, setPastProjectsExpanded] = useState(false);

    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [invoiceSelection, setInvoiceSelection] = useState({ emps: {}, costs: {} });
    const [invoiceRecipient, setInvoiceRecipient] = useState('');
    const [isProjFormOpen, setIsProjFormOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [timelineYear, setTimelineYear] = useState(new Date().getFullYear());
    const currentWeekColRef = useRef(null);
    const resourceScrollRef = useRef(null);
    const timelineScrollRef = useRef(null);

    const scrollToCurrentWeek = useCallback((containerRef, weeks, weekW) => {
        const container = containerRef?.current;
        if (!container) return;
        const weekEl = currentWeekColRef?.current;

        if (weekEl) {
            const cRect = container.getBoundingClientRect();
            const wRect = weekEl.getBoundingClientRect();
            const stickyEl = container.querySelector('thead th:first-child');
            const stickyW = stickyEl ? stickyEl.offsetWidth : 0;
            const colW = weekEl.offsetWidth || weekW;
            const contentLeft = wRect.left - cRect.left + container.scrollLeft;
            container.scrollLeft = Math.max(0, contentLeft - stickyW - colW);
            return;
        }
        // Fallback: ref unavailable (wrong year selected, pre-render).
        const currentWeek = getWeekString(new Date());
        const idx = weeks ? weeks.findIndex(w => w.id === currentWeek) : -1;
        if (idx < 0) return;
        container.scrollLeft = Math.max(0, (idx - 1) * weekW);
    }, [currentWeekColRef]);

    // Scroll a specific week (by id) into view, just past the sticky column.
    // Used by the Auslastung-cell → Ressourcen jump.
    const scrollToWeekById = useCallback((containerRef, weeks, weekId, weekW) => {
        const container = containerRef?.current;
        if (!container || !weeks) return;
        const idx = weeks.findIndex(w => w.id === weekId);
        if (idx < 0) return;
        container.scrollLeft = idx * weekW;
    }, []);

    // Forms
    const [empForm, setEmpForm] = useState({ name: '', category: '', weeklyHours: HOURS_PER_WEEK, email: '', role: '', notes: '' });
    const [editingEmpId, setEditingEmpId] = useState(null);
    const [isEmpFormOpen, setIsEmpFormOpen] = useState(false);
    const [projForm, setProjForm] = useState({ name: '', category: '', projectNumber: '', address: '', country: '', startWeek: '', ibnWeek: '', color: 'gea', hourlyRate: DEFAULT_HOURLY_RATE, billable: true, projType: '', size: '', sharepointLink: '', notes: '' });
    const [editingProjectId, setEditingProjectId] = useState(null);

    // Category Forms
    const [newEmpCat, setNewEmpCat] = useState('');
    const [newProjCat, setNewProjCat] = useState('');
    const [newBasicTask, setNewBasicTask] = useState('');
    const [newOfftimeTask, setNewOfftimeTask] = useState('');
    const [expandedSetupCats, setExpandedSetupCats] = useState({ basic: true, other: false, support: false, training: false, offtime: false, empCats: false, projCats: false, projTypes: false });

    // ── USER ROLES & SESSION ───────────────────────────────────────────────────
    // Seeded with a placeholder admin; the load effect replaces it with the
    // hashed record from users.json (or seeds one with the default PIN if
    // none exists yet).
    const [appUsers, setAppUsers] = useState([{ ...ADMIN_SEED, _needsSeed: true }]);
    const [auditLog, setAuditLog] = useState([]);
    // Auto-backup config (persisted in settings.json). Default: every 60 min,
    // enabled. The "last backup at" timestamp is intentionally NOT stored
    // here — it is derived from the backups folder listing so periodic
    // backups never touch settings.json (which would re-introduce conflicts).
    const [autoBackup, setAutoBackup] = useState({ enabled: true, intervalMinutes: 60 });
    const [lastBackupAt, setLastBackupAt] = useState(null); // ISO string, never persisted
    const [emailTemplate, setEmailTemplate] = useState(DEFAULT_EMAIL_TEMPLATE);
    const [currentUser, setCurrentUser] = useState(() => {
        try { return validateRestoredSession(JSON.parse(sessionStorage.getItem('plannerSession'))); }
        catch { return null; }
    });
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    const currentUserRef = useRef(null);
    useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

    const dismissToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message, opts = {}) => {
        const id = makeId('toast');
        const duration = opts.duration ?? 4000;
        const toast = { id, message, type: opts.type || 'info', action: opts.action || null };
        setToasts(prev => [...prev, toast]);
        if (duration > 0) {
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
        }
        return id;
    }, []);

    // Open the generic confirm dialog. The onConfirm callback fires only when
    // the user clicks the primary action; Cancel/Escape/backdrop dismiss
    // without calling it. Dialog auto-closes on either path.
    const requestConfirm = useCallback(({ title, message, confirmLabel = 'Bestätigen', danger = false, onConfirm }) => {
        setConfirmDialog({
            title, message, confirmLabel, danger,
            onConfirm: () => { setConfirmDialog(null); onConfirm?.(); }
        });
    }, []);

    // Escape-to-close for the inline modals that App renders directly (the
    // self-contained modals in modals.jsx call useEscapeToClose themselves).
    const closeProjForm    = useCallback(() => setIsProjFormOpen(false), []);
    const closeHelp        = useCallback(() => setIsHelpModalOpen(false), []);
    const closeInvoice     = useCallback(() => setIsInvoiceModalOpen(false), []);
    const closeChangelog   = useCallback(() => setIsChangelogOpen(false), []);
    useEscapeToClose(isProjFormOpen    ? closeProjForm  : null);
    useEscapeToClose(isHelpModalOpen   ? closeHelp      : null);
    useEscapeToClose(isInvoiceModalOpen ? closeInvoice  : null);
    useEscapeToClose(isChangelogOpen   ? closeChangelog : null);

    // Loaded meta.schemaVersion if it is *newer* than this build understands.
    // Filled during loadData and read by a one-shot effect below.
    const [futureSchemaSeen, setFutureSchemaSeen] = useState(null);
    // One-shot warning when the data on disk was written by a newer build.
    // Saving still works but downgrades meta.schemaVersion and silently drops
    // any unknown fields the newer client added.
    useEffect(() => {
        if (futureSchemaSeen == null) return;
        showToast(
            `Achtung: Diese Daten wurden mit einer neueren App-Version gespeichert (Schema v${futureSchemaSeen}, diese App: v${SCHEMA_VERSION}). Bitte aktualisiere die App, bevor du speicherst – sonst gehen neue Felder verloren.`,
            { type: 'error', duration: 0 }
        );
    }, [futureSchemaSeen, showToast]);

    // Stable ref so audit handlers see current assignments without deps
    const assignmentsRef = useRef([]);
    useEffect(() => { assignmentsRef.current = assignments; }, [assignments]);
    const projectsRef = useRef([]);
    useEffect(() => { projectsRef.current = projects; }, [projects]);
    const costItemsRef = useRef([]);
    useEffect(() => { costItemsRef.current = costItems; }, [costItems]);

    // Cascade-delete prompt state: { entityKind, entityName, entityId, dependents, onConfirm }.
    // null = no prompt visible. The modal lives at the bottom of the App render
    // tree so it overlays the active view.
    const [cascadeConfirm, setCascadeConfirm] = useState(null);
    // Generic confirm dialog: { title, message, confirmLabel, danger, onConfirm }.
    // Used for destructive actions without entity dependents (logout, app-user
    // delete, series delete). Set via requestConfirm().
    const [confirmDialog, setConfirmDialog] = useState(null);

    // Conflict-loop cap: each SpConflictError increments; on >=3 we stop
    // auto-reloading and tell the user to refresh.
    const conflictRetryRef = useRef(0);

    // The cascade-delete handlers below already write a richer audit entry
    // (with the dependents bundled into undoData). The legacy length-diff
    // watchers would otherwise log a second, less-informative entry — set
    // this ref to skip the next watcher emit per entity.
    const suppressEmployeeAuditRef = useRef(false);
    const suppressProjectAuditRef = useRef(false);

    // Audit-log helpers. formatKW + describeAssignment now live in utils.js;
    // describeAssignment needs a project-lookup callback bound to projectsRef
    // so audit entries see the latest names without re-creating the closure.
    const describeAssignmentLocal = (ass) =>
        describeAssignment(ass, id => projectsRef.current.find(x => x.id === id));

    // Ref so loginUser can fire a backup without re-creating the callback
    // each time runBackup's deps change.
    const runBackupRef = useRef(null);
    // Flipped true once the initial loadData() finishes. loginUser uses this
    // to avoid backing up a half-initialised state when the user logs in
    // during a slow SP load.
    const initialLoadDoneRef = useRef(false);
    // Serialises PIN-migration so two near-simultaneous applyRemoteSnapshot
    // calls (or initial-load + polling) can't race to setAppUsers with
    // overlapping migration results.
    const userMigrationInFlightRef = useRef(false);
    // Holds a freshly generated admin PIN between migrateAndSetUsers and the
    // effect that shows it as a one-time toast notification.
    const pendingInitialPinRef = useRef(null);
    const migrateAndSetUsers = useCallback(async (rawUsers) => {
        if (userMigrationInFlightRef.current) return;
        userMigrationInFlightRef.current = true;
        try {
            const { users: withAdmin, initialPin } = await ensureAdmin(rawUsers || []);
            if (initialPin) pendingInitialPinRef.current = initialPin;
            const { users: hashed } = await migrateUsersList(withAdmin);
            // Defensive: strip any _needsSeed placeholders that survived.
            setAppUsers(hashed.filter(u => !u._needsSeed));
        } finally {
            userMigrationInFlightRef.current = false;
        }

    }, []);

    const loginUser = useCallback((user) => {
        const session = { id: user.id, name: user.name, role: user.role };
        try { sessionStorage.setItem('plannerSession', JSON.stringify(session)); } catch(e) {}
        setCurrentUser(session);
        setIsLoginModalOpen(false);
        // If LoginModal rehashed the PIN to the strong algo, splice the
        // upgraded record into appUsers so the next save persists it.
        if (user.pinAlgo === PIN_PBKDF2_ALGO && user.pinHash) {
            setAppUsers(prev => {
                const i = prev.findIndex(u => u.id === user.id);
                if (i < 0) return prev;
                if (prev[i].pinHash === user.pinHash && prev[i].pinAlgo === user.pinAlgo) return prev;
                const next = [...prev];
                next[i] = user;
                return next;
            });
        }
        // Restore the user's UI preferences (compactView + language).
        // Missing preferences mean "use last value" – nothing to apply.
        const prefs = user?.preferences;
        if (prefs && typeof prefs.compactView === 'boolean') {
            setCompactView(prefs.compactView);
        }
        if (prefs && (prefs.language === 'de' || prefs.language === 'en')) {
            setLanguage(prefs.language);
        }
        // Best-effort recovery backup. Skipped when the initial load hasn't
        // populated state yet – we'd otherwise persist a near-empty snapshot.
        // Rate-limited via spListBackups so rapid logins don't spam the
        // backups folder.
        (async () => {
            if (!initialLoadDoneRef.current) return;
            if (!SP_CONTEXT && !dirHandleRef.current) return;
            try {
                if (SP_CONTEXT) {
                    const files = await spListBackups(SP_CONTEXT).catch(() => []);
                    const newest = files.reduce((acc, f) => (!acc || f.ts > acc.ts ? f : acc), null);
                    if (newest && Date.now() - new Date(newest.ts).getTime() < 30 * 60 * 1000) return;
                }
                runBackupRef.current?.('login');
            } catch(e) { /* never block login on backup failure */ }
        })();
    }, []);

    const logoutUser = useCallback(() => {
        try { sessionStorage.removeItem('plannerSession'); } catch(e) {}
        setCurrentUser(null);
        // Redirect away from restricted tabs
        setActiveTab(prev => {
            const restricted = ['utilization', 'setup_emp', 'setup_proj', 'setup_cats', 'data', 'audit'];
            return restricted.includes(prev) ? 'resource' : prev;
        });
    }, []);


    // Central audit-log writer – uses refs to avoid stale closures
    const logAudit = useCallback((action, description, undoData = null) => {
        const user = currentUserRef.current;
        if (!user) return;
        const entry = {
            id: makeId('aud'),
            timestamp: new Date().toISOString(),
            userId: user.id,
            userName: user.name,
            action,
            description,
            undoData,
        };
        setAuditLog(prev => [entry, ...prev].slice(0, 500));
    }, []);

    // SharePoint / FS sync
    const syncStatusRef = useRef(SP_CONTEXT ? 'connecting' : 'local');
    const isRemoteUpdateRef = useRef(false);
    const spSaveTimer = useRef(null);
    const [syncStatus, setSyncStatusState] = useState(SP_CONTEXT ? 'connecting' : 'local');
    const setSyncStatus = (s) => { syncStatusRef.current = s; setSyncStatusState(s); };

    // File System sync (OneDrive lokal)
    const dirHandleRef = useRef(null);
    const [fsStatus, setFsStatus] = useState(FS_MODE ? 'checking' : 'off');
    // fsStatus: 'checking' | 'needs-setup' | 'needs-permission' | 'connected' | 'off'

    // meta.json is a commit-marker, never a target for If-Match conditional
    // writes – strip it so we don't store an ETag we'd never use.
    const stripMetaEtag = (etags) => {
        if (!etags) return {};
        const { 'meta.json': _meta, ...rest } = etags;
        return rest;
    };

    // Team-split sync state
    const spFileTimestampsRef = useRef({}); // { 'file.json': 'ISO', ... } for SP polling
    const spFileEtagsRef = useRef({});      // { 'file.json': etag } for conditional writes
    const fsFileTimestampsRef = useRef({}); // { 'file.json': <ms>, ... } for FS polling
    const lastSavedSpRef = useRef({});      // { filename: JSON string } for diff-based writes
    const lastSavedFsRef = useRef({});      // same for FS
    const employeesRef = useRef([]);
    const empCategoriesRef = useRef(DEFAULT_TEAMS);
    const latestStateRef = useRef({});

    // --- INIT ---
    useEffect(() => {
        const loadData = async () => {
            let parsedData = null;
            let currentEmpCats = DEFAULT_TEAMS;

            // 0. Try File System (local OneDrive folder)
            if (FS_MODE) {
                const handle = await idbGetHandle();
                if (handle) {
                    dirHandleRef.current = handle;
                    const perm = await handle.queryPermission({ mode: 'readwrite' });
                    if (perm === 'granted') {
                        try {
                            const { state, timestamps, loadedSchemaVersion } = await loadSplitStateFs(handle);
                            if (Number.isFinite(loadedSchemaVersion) && loadedSchemaVersion > SCHEMA_VERSION) {
                                setFutureSchemaSeen(loadedSchemaVersion);
                            }
                            if (state && (state.employees.length || state.assignments.length || state.projects.length)) {
                                parsedData = state;
                                fsFileTimestampsRef.current = timestamps;
                                isRemoteUpdateRef.current = true;
                            }
                        } catch(e) { console.warn('[FS] load failed', e); }
                        setFsStatus('connected');
                    } else {
                        setFsStatus('needs-permission'); // Popup erscheint
                    }
                } else {
                    setFsStatus('needs-setup'); // Popup erscheint
                }
            }

            // 1. Try SharePoint first (wins over local data if available)
            if (SP_CONTEXT) {
                const runLoad = async () => {
                    const { state, timestamps, etags, loadedSchemaVersion } = await loadSplitStateSp(SP_CONTEXT);
                    if (Number.isFinite(loadedSchemaVersion) && loadedSchemaVersion > SCHEMA_VERSION) {
                        setFutureSchemaSeen(loadedSchemaVersion);
                    }
                    // Treat "all empty" as fresh install → fall through to
                    // localStorage / generateInitialData so the app has
                    // sensible defaults to seed the new files.
                    if (state && (state.employees.length || state.assignments.length || state.projects.length)) {
                        parsedData = state;
                        spFileTimestampsRef.current = timestamps;
                        spFileEtagsRef.current = stripMetaEtag(etags);
                        isRemoteUpdateRef.current = true; // Loaded from SP – don't write back
                    } else {
                        spFileTimestampsRef.current = timestamps || {};
                        spFileEtagsRef.current = stripMetaEtag(etags);
                    }
                };
                try {
                    await runLoad();
                    setSyncStatus('idle');
                    // Check for a dirty-write checkpoint left by a previous session
                    // that may have crashed or closed mid-write. If the checkpoint
                    // timestamp is newer than SharePoint's last committed meta.json,
                    // the data on SP may be incomplete.
                    try {
                        const pendingTs = Number(localStorage.getItem('plannerPendingWrite') || '0');
                        if (pendingTs) {
                            const spMetaTs = spFileTimestampsRef.current['meta.json']
                                ? new Date(spFileTimestampsRef.current['meta.json']).getTime()
                                : 0;
                            if (pendingTs > spMetaTs + 5000) {
                                showToast(
                                    'Vorsicht: Beim letzten Schließen konnten Änderungen möglicherweise nicht vollständig gespeichert werden. Bitte prüfe die Daten.',
                                    { type: 'warning', duration: 0 }
                                );
                            }
                            localStorage.removeItem('plannerPendingWrite');
                        }
                    } catch(e) {}
                } catch(e) {
                    if (e instanceof SpAuthError) {
                        // Session expired between page load and our first
                        // REST call – try a silent refresh before giving up.
                        setSyncStatus('reconnecting');
                        const ok = await spEnsureSession(SP_CONTEXT, { interactive: false });
                        if (ok) {
                            try { await runLoad(); setSyncStatus('idle'); }
                            catch(e2) { console.warn('[SP] load retry failed', e2); setSyncStatus('needs-auth'); }
                        } else {
                            setSyncStatus('needs-auth');
                        }
                    } else {
                        console.warn('[SP] load failed', e);
                        setSyncStatus('offline');
                    }
                }
            }

            // 2. Fallback to localStorage
            if (!parsedData) {
                const savedData = localStorage.getItem('teamMasterProData');
                if (savedData) { try { parsedData = JSON.parse(savedData); } catch(e) {} }
            }

            // 3. Apply data
            if (parsedData) {
                setEmployees(parsedData.employees || []);
                setProjects(parsedData.projects || []);
                setAssignments(parsedData.assignments || []);
                setExpenses(parsedData.expenses || []);
                // Load costItems or migrate old expenses; then bring forward
                // single-amount entries to the new line-items shape.
                if (parsedData.costItems) {
                    setCostItems(migrateCostItems(parsedData.costItems));
                } else if (parsedData.expenses && parsedData.expenses.length > 0) {
                    setCostItems(migrateCostItems(migrateExpensesToCostItems(parsedData.expenses)));
                }
                if (parsedData.empCategories) {
                    // Migrate old team name 'ME' → 'CSS'
                    const migratedCats = parsedData.empCategories.map(c => c === 'ME' ? 'CSS' : c);
                    if (!migratedCats.includes('I&C')) migratedCats.splice(migratedCats.indexOf('Other'), 0, 'I&C');
                    setEmpCategories(migratedCats);
                    currentEmpCats = migratedCats;
                    // Also migrate employees
                    if (parsedData.employees) {
                        parsedData.employees = parsedData.employees.map(e => e.category === 'ME' ? {...e, category: 'CSS'} : e);
                    }
                }
                if (parsedData.projCategories) setProjCategories(parsedData.projCategories);
                if (parsedData.projTypes !== undefined) setProjTypes(parsedData.projTypes || []);
                if (parsedData.basicTasks) {
                    const loadedMeta     = parsedData.basicTasksMeta     || {};
                    const loadedInactive = parsedData.inactiveBasicTasks || [];
                    const expiryMs = BASIC_TASK_EXPIRY_WEEKS * 7 * 24 * 60 * 60 * 1000;
                    const now = Date.now();
                    // Skip tasks that are marked permanent or have no createdAt
                    const toExpire = parsedData.basicTasks.filter(t =>
                        loadedMeta[t] && !loadedMeta[t].permanent && loadedMeta[t].createdAt &&
                        (now - new Date(loadedMeta[t].createdAt).getTime()) > expiryMs
                    );
                    if (toExpire.length > 0) {
                        setBasicTasks(parsedData.basicTasks.filter(t => !toExpire.includes(t)));
                        setInactiveBasicTasks([...loadedInactive, ...toExpire.map(t => ({ name: t, createdAt: loadedMeta[t].createdAt }))]);
                    } else {
                        setBasicTasks(parsedData.basicTasks);
                        setInactiveBasicTasks(loadedInactive);
                    }
                    setBasicTasksMeta(parsedData.basicTasksMeta || {});
                }
                if (parsedData.offtimeTasks) setOfftimeTasks(parsedData.offtimeTasks);
                if (parsedData.inactiveOfftimeTasks) setInactiveOfftimeTasks(parsedData.inactiveOfftimeTasks);
                if (parsedData.inactiveSupportTasks) setInactiveSupportTasks(parsedData.inactiveSupportTasks);
                if (parsedData.inactiveTrainingTasks) setInactiveTrainingTasks(parsedData.inactiveTrainingTasks);
                if (parsedData.customTrainingTasks) setCustomTrainingTasks(parsedData.customTrainingTasks);
                if (parsedData.invoiceRecipient) setInvoiceRecipient(parsedData.invoiceRecipient);
                if (parsedData.autoBackup) {
                    const { lastBackupAt: _ignored, ...rest } = parsedData.autoBackup;
                    setAutoBackup(prev => ({ ...prev, ...rest }));
                }
                if (parsedData.emailTemplate) setEmailTemplate(prev => ({ ...prev, ...parsedData.emailTemplate }));
                // Migrate plaintext PINs to hashes and seed admin if missing.
                // Async; result triggers a re-render and the normal save cycle
                // will persist the hashed records.
                migrateAndSetUsers(parsedData.appUsers);
                if (parsedData.auditLog) setAuditLog(parsedData.auditLog);

                // Seed diff snapshots so the first save cycle is a no-op for
                // files that are already in sync.
                try {
                    seedLastSaved(parsedData, lastSavedSpRef.current);
                    seedLastSaved(parsedData, lastSavedFsRef.current);
                } catch(e) { console.warn('[SEED] snapshot seeding failed', e); }
            } else {
                const init = generateInitialData(currentEmpCats);
                setEmployees(init.employees);
                setProjects(init.projects);
                setAssignments(init.assignments);
                setExpenses(init.expenses);
                // Fresh install: seed the admin with the default hashed PIN.
                migrateAndSetUsers([]);
            }

            const w = [];
            const today = new Date();
            // Anchor to Monday of the current ISO week so the resource view
            // is consistent with the timeline tab (which also starts on Monday).
            const todayDow = today.getDay() || 7; // 1=Mon … 7=Sun
            const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - todayDow + 1);
            // Use 54 iterations to cover 53-week ISO years; deduplicate by ID.
            const seenIds = new Set();
            for(let i=0; i<54; i++) {
                const d = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + (i*7));
                const weekId = getWeekString(d);
                if (seenIds.has(weekId)) continue;
                seenIds.add(weekId);
                if (w.length >= 54) break;
                const kw = parseInt(weekId.split('-W')[1], 10);
                w.push({
                    id: weekId,
                    label: `KW ${kw}`,
                    sub: `${d.getDate()}.${d.getMonth()+1}.`,
                    month: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
                });
            }
            setWeeks(w);
            initialLoadDoneRef.current = true;
            setEmpForm(prev => ({...prev, category: currentEmpCats[0] || ''}));
            setProjForm(prev => ({...prev, startWeek: w[0].id, ibnWeek: w[10]?.id || w[w.length-1].id}));
        };
        loadData();
    }, []);

    // Keep refs aligned with state so polling closures see fresh data.
    useEffect(() => { employeesRef.current = employees; }, [employees]);
    useEffect(() => { empCategoriesRef.current = empCategories; }, [empCategories]);

    // Refresh the rolling `weeks` window once a day so a tab left open past
    // midnight of New Year's doesn't keep showing last year's KW1 as "today".
    // Cheap: getWeekString() of today vs weeks[0].id once per hour.
    useEffect(() => {
        const tick = () => {
            if (weeks.length === 0) return;
            const today = new Date();
            const todayDow = today.getDay() || 7;
            const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - todayDow + 1);
            const expectedFirst = getWeekString(thisMonday);
            if (weeks[0].id === expectedFirst) return;
            const w = [];
            const seenIds = new Set();
            for (let i = 0; i < 54; i++) {
                const d = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + (i * 7));
                const weekId = getWeekString(d);
                if (seenIds.has(weekId)) continue;
                seenIds.add(weekId);
                if (w.length >= 54) break;
                const kw = parseInt(weekId.split('-W')[1], 10);
                w.push({
                    id: weekId,
                    label: `KW ${kw}`,
                    sub: `${d.getDate()}.${d.getMonth() + 1}.`,
                    month: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
                });
            }
            setWeeks(w);
        };
        const interval = setInterval(tick, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [weeks]);

    // Titel zentral aus APP_VERSION ableiten – verhindert Versions-Drift
    // zwischen index.html und config.js.
    useEffect(() => { document.title = `Einsatzplanung 3.0 – ${APP_VERSION}`; }, []);

    // ── AUDIT WATCH: employees ─────────────────────────────────────────────────
    // Must run BEFORE the save effect so isRemoteUpdateRef is still true for
    // remote-sync updates when this effect checks it.
    const prevEmployeesRef = useRef(null);
    useEffect(() => {
        if (prevEmployeesRef.current === null) { prevEmployeesRef.current = employees; return; }
        const prev = prevEmployeesRef.current;
        prevEmployeesRef.current = employees;
        if (prev === employees || isRemoteUpdateRef.current) return;
        const user = currentUserRef.current;
        if (!user) return;
        if (suppressEmployeeAuditRef.current) { suppressEmployeeAuditRef.current = false; return; }
        if (employees.length > prev.length) {
            const prevIds = new Set(prev.map(p => p.id));
            const added = employees.find(e => !prevIds.has(e.id));
            if (added) logAudit('employee_create', `Mitarbeiter angelegt: ${added.name}`, { type: 'del_employee', id: added.id });
        } else if (employees.length < prev.length) {
            const currIds = new Set(employees.map(e => e.id));
            const removed = prev.find(e => !currIds.has(e.id));
            if (removed) {
                logAudit('employee_delete', `Mitarbeiter gelöscht: ${removed.name}`, { type: 'restore_employee', prev: removed });
                showToast(`Mitarbeiter „${removed.name}" gelöscht`, {
                    type: 'success', duration: 6000,
                    action: { label: 'Rückgängig', onClick: () => setEmployees(p => p.some(e => e.id === removed.id) ? p : [...p, removed]) }
                });
            }
        } else {
            const prevById = new Map(prev.map(p => [p.id, p]));
            let changed = null, prevEmp = null;
            for (const e of employees) {
                const p = prevById.get(e.id);
                if (p && JSON.stringify(e) !== JSON.stringify(p)) { changed = e; prevEmp = p; break; }
            }
            if (changed) {
                logAudit('employee_update', `Mitarbeiter bearbeitet: ${changed.name}`, { type: 'restore_employee', prev: prevEmp });
            }
        }
    }, [employees, logAudit, showToast]);

    // ── AUDIT WATCH: projects ──────────────────────────────────────────────────
    const prevProjectsRef = useRef(null);
    useEffect(() => {
        if (prevProjectsRef.current === null) { prevProjectsRef.current = projects; return; }
        const prev = prevProjectsRef.current;
        prevProjectsRef.current = projects;
        if (prev === projects || isRemoteUpdateRef.current) return;
        const user = currentUserRef.current;
        if (!user) return;
        if (suppressProjectAuditRef.current) { suppressProjectAuditRef.current = false; return; }
        if (projects.length > prev.length) {
            const prevIds = new Set(prev.map(q => q.id));
            const added = projects.find(p => !prevIds.has(p.id));
            if (added) logAudit('project_create', `Projekt angelegt: ${added.name}`, { type: 'del_project', id: added.id });
        } else if (projects.length < prev.length) {
            const currIds = new Set(projects.map(q => q.id));
            const removed = prev.find(p => !currIds.has(p.id));
            if (removed) {
                logAudit('project_delete', `Projekt gelöscht: ${removed.name}`, { type: 'restore_project', prev: removed });
                showToast(`Projekt „${removed.name}" gelöscht`, {
                    type: 'success', duration: 6000,
                    action: { label: 'Rückgängig', onClick: () => setProjects(p => p.some(q => q.id === removed.id) ? p : [...p, removed]) }
                });
            }
        } else {
            const prevById = new Map(prev.map(q => [q.id, q]));
            let changed = null, prevProj = null;
            for (const p of projects) {
                const q = prevById.get(p.id);
                if (q && JSON.stringify(p) !== JSON.stringify(q)) { changed = p; prevProj = q; break; }
            }
            if (changed) {
                logAudit('project_update', `Projekt bearbeitet: ${changed.name}`, { type: 'restore_project', prev: prevProj });
            }
        }
    }, [projects, logAudit, showToast]);

    // Save on change. localStorage runs at ~400 ms, SharePoint at 1.5 s. The
    // SharePoint write is split per entity / team; saveSplitState() only
    // writes files whose content actually changed (diff against the last
    // saved snapshot), so Chef A editing CMS only touches assignments-CMS.json
    // while Chef B editing AS only touches assignments-AS.json – no conflicts.
    const localSaveTimer = useRef(null);
    useEffect(() => {
        if (employees.length === 0) return;

        // Skip writes triggered by remote updates (SharePoint polling or initial load)
        if (isRemoteUpdateRef.current) {
            isRemoteUpdateRef.current = false;
            return;
        }

        const stateData = {
            employees, projects, assignments, expenses, costItems,
            empCategories, projCategories, projTypes, basicTasks, basicTasksMeta, inactiveBasicTasks,
            offtimeTasks, inactiveOfftimeTasks, inactiveSupportTasks, inactiveTrainingTasks,
            customTrainingTasks, invoiceRecipient, appUsers: stripUserSecrets(appUsers), auditLog, autoBackup, emailTemplate
        };
        // Remote stores (SharePoint, local FS) carry the full user records
        // including PIN hashes so accounts survive a page reload. The localStorage
        // copy uses stripped users (no hashes) – it is a less-protected store
        // and credential data must not be cached there.
        const stateDataFull = { ...stateData, appUsers };

        if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
        localSaveTimer.current = setTimeout(() => {
            try { localStorage.setItem('teamMasterProData', JSON.stringify(stateData));
            } catch(e) {
                console.warn('[LS] save failed', e);
                // Quota exceeded or storage disabled – warn the user instead
                // of silently dropping data on the next reload.
                showToast('Lokaler Speicher voll – bitte Browserdaten freigeben oder Snapshot exportieren.', { type: 'error', duration: 8000 });
            }
            if (FS_MODE && dirHandleRef.current) {
                saveSplitState(stateDataFull, lastSavedFsRef.current,
                    (filename, payload) => fsSaveFile(dirHandleRef.current, filename, payload)
                ).then(async () => {
                    fsFileTimestampsRef.current = await fsGetFolderTimestamps(dirHandleRef.current);
                }).catch(err => {
                    console.warn('[FS] save failed', err);
                    // The user revoked the folder permission (browser settings
                    // → site permissions). Surface it so the existing
                    // "Aktivieren"-CTA pops up instead of silently failing
                    // every subsequent save.
                    if (err && (err.name === 'SecurityError' || err.name === 'NotAllowedError')) {
                        setFsStatus('needs-permission');
                    }
                });
            }
        }, 400);

        if (SP_CONTEXT) {
            if (spSaveTimer.current) clearTimeout(spSaveTimer.current);
            spSaveTimer.current = setTimeout(async () => {
                // Don't clobber a known-broken auth state – the user will
                // retry the save by clicking "neu verbinden".
                if (syncStatusRef.current === 'needs-auth') return;
                const runSave = async () => {
                    await spEnsureFolder(SP_CONTEXT, PLANNER_DATA_DIR);
                    const written = await saveSplitState(stateDataFull, lastSavedSpRef.current,
                        (filename, payload) => spSaveFile(SP_CONTEXT, filename, payload,
                            filename === 'meta.json' ? null : spFileEtagsRef.current[filename])
                    );
                    // No-Op-Save (Diff leer, z. B. Echo eines Remote-Updates):
                    // Timestamp-/ETag-Refresh sparen – nichts hat sich geändert.
                    if (!written) return;
                    // Refresh timestamps AND etags in one request after a successful save.
                    const meta = await spGetFolderMeta(SP_CONTEXT);
                    const refreshedEtags = {};
                    Object.entries(meta).forEach(([f, v]) => {
                        spFileTimestampsRef.current[f] = v.ts;
                        refreshedEtags[f] = v.etag;
                    });
                    Object.assign(spFileEtagsRef.current, stripMetaEtag(refreshedEtags));
                };
                pollIdleCyclesRef.current = 0;
                setSyncStatus('syncing');
                try { localStorage.setItem('plannerPendingWrite', String(Date.now())); } catch(e) {}
                try {
                    await runSave();
                    conflictRetryRef.current = 0;
                    setSyncStatus('idle');
                    try { localStorage.removeItem('plannerPendingWrite'); } catch(e) {}
                } catch(e) {
                    if (e instanceof SpConflictError) {
                        conflictRetryRef.current += 1;
                        if (conflictRetryRef.current >= 3) {
                            spFileEtagsRef.current = {};
                            setSyncStatus('conflict-loop');
                            showToast('Wiederholte Sync-Konflikte – bitte Seite neu laden.', { type: 'warning', duration: 8000 });
                            return;
                        }
                        // Another client modified the file while we were editing.
                        // Reload the remote snapshot and let the user see a toast.
                        setSyncStatus('reconnecting');
                        try {
                            const { state, timestamps, etags } = await loadSplitStateSp(SP_CONTEXT);
                            spFileTimestampsRef.current = timestamps;
                            spFileEtagsRef.current = stripMetaEtag(etags);
                            applyRemoteSnapshot(state, { notify: false });
                            conflictRetryRef.current = 0;
                            setSyncStatus('conflict-reload');
                            showToast('Änderung eines Kollegen wurde übernommen.', { type: 'warning', duration: 5000 });
                            setTimeout(() => { if (syncStatusRef.current === 'conflict-reload') setSyncStatus('idle'); }, 3000);
                        } catch(e2) {
                            console.warn('[SP] conflict reload failed', e2);
                            // Drop ETags so the next save uses overwrite=true
                            // and can't loop on a stale 412.
                            spFileEtagsRef.current = {};
                            setSyncStatus('offline');
                        }
                    } else if (e instanceof SpAuthError) {
                        // Session expired while idle – try silent re-auth and
                        // replay the save exactly once. lastSavedSpRef is only
                        // updated per successful file write, so interrupted
                        // writes are naturally retried on the next save.
                        setSyncStatus('reconnecting');
                        const ok = await spEnsureSession(SP_CONTEXT, { interactive: false });
                        if (ok) {
                            try { await runSave(); setSyncStatus('idle'); }
                            catch(e2) { console.warn('[SP] save retry failed', e2); setSyncStatus('needs-auth'); }
                        } else {
                            setSyncStatus('needs-auth');
                        }
                    } else {
                        console.warn('[SP] save failed', e);
                        setSyncStatus('offline');
                    }
                }
            }, 1500);
        }
    }, [employees, projects, assignments, expenses, costItems, empCategories, projCategories, projTypes, basicTasks, basicTasksMeta, inactiveBasicTasks, offtimeTasks, inactiveOfftimeTasks, inactiveSupportTasks, inactiveTrainingTasks, customTrainingTasks, invoiceRecipient, appUsers, auditLog, autoBackup, emailTemplate]);

    // Show the generated initial admin PIN once as a persistent toast so the
    // operator can note it down and change it immediately after first login.
    useEffect(() => {
        const pin = pendingInitialPinRef.current;
        if (!pin) return;
        pendingInitialPinRef.current = null;
        showToast(
            `Erster Start: Admin-PIN ist ${pin} – bitte sofort unter Verwaltung → Benutzer ändern!`,
            { type: 'warning', duration: 0 }
        );
    }, [appUsers, showToast]);

    // Force logout if the session user no longer exists in appUsers (deleted
    // between sessions, or role downgraded). Only fires once appUsers has
    // actually been populated to avoid logging out during the initial load
    // race when the user list is still the seed placeholder.
    const orphanCheckedRef = useRef(false);
    useEffect(() => {
        if (!currentUser) { orphanCheckedRef.current = false; return; }
        if (!appUsers || appUsers.length === 0) return;
        if (appUsers.some(u => u._needsSeed)) return; // still seeding
        if (orphanCheckedRef.current) return;
        const match = appUsers.find(u => u.id === currentUser.id);
        if (!match || match.role !== currentUser.role) {
            orphanCheckedRef.current = true;
            showToast('Konto wurde entfernt oder geändert – bitte neu anmelden.', { type: 'warning', duration: 6000 });
            logoutUser();
            return;
        }
        orphanCheckedRef.current = true;
    }, [appUsers, currentUser, logoutUser, showToast]);

    // On page reload, the session is restored from sessionStorage *before*
    // appUsers loads from SP. Once appUsers arrives, re-apply the stored
    // preferences for the current session user.
    const prefsAppliedRef = useRef(false);
    useEffect(() => {
        if (prefsAppliedRef.current) return;
        if (!currentUser) return;
        const full = appUsers.find(u => u.id === currentUser.id);
        if (!full) return;
        prefsAppliedRef.current = true;
        const prefs = full.preferences;
        if (prefs && typeof prefs.compactView === 'boolean') {
            setCompactView(prefs.compactView);
        }
        if (prefs && (prefs.language === 'de' || prefs.language === 'en')) {
            setLanguage(prefs.language);
        }
    }, [appUsers, currentUser]);

    // Persist UI preferences back to the logged-in user. Only writes when
    // the value actually differs from what's stored, so this effect doesn't
    // cause a save loop when prefs are restored on login.
    useEffect(() => {
        const u = currentUserRef.current;
        if (!u) return;
        setAppUsers(prev => {
            const cur = prev.find(p => p.id === u.id);
            if (!cur) return prev;
            if (cur.preferences?.compactView === compactView && cur.preferences?.language === language) return prev;
            return prev.map(p => p.id === u.id
                ? { ...p, preferences: { ...(p.preferences || {}), compactView, language } }
                : p);
        });
    }, [compactView, language, currentUser]);

    // ── AUTO-BACKUP (periodic snapshot of all data to planner-data/backups/) ──
    // Runs only when SharePoint is connected. One check per minute; writes a
    // single timestamped JSON when `intervalMinutes` has elapsed since the last
    // successful backup. Triggered manually via the "Jetzt sichern" button too.
    const lastBackupTriedRef = useRef(0);
    // Returns { ok: bool, error?: string, target?: 'sp' | 'fs' }
    const runBackup = useCallback(async (reason = 'auto') => {
        const payload = {
            employees, projects, assignments, expenses, costItems,
            empCategories, projCategories, projTypes,
            basicTasks, basicTasksMeta, inactiveBasicTasks,
            offtimeTasks, inactiveOfftimeTasks,
            inactiveSupportTasks, inactiveTrainingTasks, customTrainingTasks,
            invoiceRecipient,
            appUsers: stripUserSecrets(appUsers),
            auditLog,
            backupReason: reason,
            backupAt: new Date().toISOString(),
            schemaVersion: SCHEMA_VERSION
        };
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        // Random suffix prevents same-second filename collisions when two
        // clients hit the auto-backup tick simultaneously – SP overwrite=true
        // would otherwise silently clobber the first write.
        const rand = Math.random().toString(16).slice(2, 6);
        const backupName = `backup-${ts}-${rand}.json`;
        const body = JSON.stringify(payload);
        // Prune auto-backups older than the keep-count. Manual snapshots are
        // left untouched so user-triggered safety copies don't disappear.
        const pruneSp = async () => {
            if (reason !== 'auto') return;
            try {
                const files = await spListBackups(SP_CONTEXT);
                const autos = files
                    .filter(f => f.name?.startsWith('backup-'))
                    .sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
                const excess = autos.length - BACKUP_KEEP_COUNT;
                for (let i = 0; i < excess; i++) {
                    await spDeleteBackup(SP_CONTEXT, autos[i].name).catch(() => {});
                }
            } catch(e) { console.warn('[BACKUP] SP prune failed', e); }
        };
        const pruneFs = async () => {
            if (reason !== 'auto') return;
            try {
                const files = await fsListBackups(dirHandleRef.current);
                const autos = files
                    .filter(f => f.name?.startsWith('backup-'))
                    .sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
                const excess = autos.length - BACKUP_KEEP_COUNT;
                for (let i = 0; i < excess; i++) {
                    await fsDeleteBackup(dirHandleRef.current, autos[i].name).catch(() => {});
                }
            } catch(e) { console.warn('[BACKUP] FS prune failed', e); }
        };
        // Prefer SharePoint when connected; fall back to local FS if a folder
        // handle is available. If neither is reachable, surface why.
        if (SP_CONTEXT) {
            try {
                await spSaveBackup(SP_CONTEXT, backupName, body);
                setLastBackupAt(new Date().toISOString());
                await pruneSp();
                return { ok: true, target: 'sp' };
            } catch(e) {
                console.error('[BACKUP] SharePoint write failed', e);
                return { ok: false, error: e?.message || String(e), target: 'sp' };
            }
        }
        if (dirHandleRef.current) {
            try {
                await fsSaveBackup(dirHandleRef.current, backupName, body);
                setLastBackupAt(new Date().toISOString());
                await pruneFs();
                return { ok: true, target: 'fs' };
            } catch(e) {
                console.error('[BACKUP] FS write failed', e);
                return { ok: false, error: e?.message || String(e), target: 'fs' };
            }
        }
        return { ok: false, error: 'Kein Backup-Ziel verfügbar (weder SharePoint noch lokaler Ordner verbunden).' };
    }, [employees, projects, assignments, expenses, costItems, empCategories, projCategories,
        basicTasks, basicTasksMeta, inactiveBasicTasks, offtimeTasks, inactiveOfftimeTasks,
        inactiveSupportTasks, inactiveTrainingTasks, customTrainingTasks, invoiceRecipient,
        appUsers, auditLog]);

    // Mirror runBackup into a ref so loginUser (which has no deps) can call
    // it with the latest closure.
    useEffect(() => { runBackupRef.current = runBackup; }, [runBackup]);

    // Probe the backups folder once on mount (and after a successful backup)
    // so the UI shows an accurate "last backup at" without writing anywhere.
    useEffect(() => {
        if (!SP_CONTEXT) return;
        let cancelled = false;
        (async () => {
            const files = await spListBackups(SP_CONTEXT).catch(() => []);
            if (cancelled) return;
            const newest = files.reduce((acc, f) => (!acc || f.ts > acc.ts ? f : acc), null);
            setLastBackupAt(newest?.ts || null);
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!SP_CONTEXT) return;
        if (!autoBackup?.enabled) return;
        const intervalMs = Math.max(5, autoBackup.intervalMinutes || 60) * 60 * 1000;
        const tick = async () => {
            const now = Date.now();
            if (now - lastBackupTriedRef.current < 60 * 1000) return; // anti-flap
            // Re-read the folder so all clients see the same "last backup"
            // truth; avoids two clients backing up in the same minute.
            const files = await spListBackups(SP_CONTEXT).catch(() => []);
            const newest = files.reduce((acc, f) => (!acc || f.ts > acc.ts ? f : acc), null);
            const lastTs = newest ? new Date(newest.ts).getTime() : 0;
            if (lastTs && now - lastTs < intervalMs) {
                // Another client (or an earlier session) covered it.
                if (newest?.ts && newest.ts !== lastBackupAt) setLastBackupAt(newest.ts);
                return;
            }
            lastBackupTriedRef.current = now;
            await runBackup('auto');
        };
        const t1 = setTimeout(tick, 30 * 1000);
        const t2 = setInterval(tick, 60 * 1000);
        return () => { clearTimeout(t1); clearInterval(t2); };
    }, [autoBackup, runBackup, lastBackupAt]);

    // Keep latestStateRef current so the beforeunload flush always sees the
    // latest data without re-registering the event listener on every change.
    useEffect(() => {
        latestStateRef.current = {
            employees, projects, assignments, expenses, costItems,
            empCategories, projCategories, projTypes, basicTasks, basicTasksMeta, inactiveBasicTasks,
            offtimeTasks, inactiveOfftimeTasks, inactiveSupportTasks, inactiveTrainingTasks,
            customTrainingTasks, invoiceRecipient, appUsers: stripUserSecrets(appUsers), auditLog, autoBackup, emailTemplate
        };
    }, [employees, projects, assignments, expenses, costItems, empCategories, projCategories, projTypes, basicTasks, basicTasksMeta, inactiveBasicTasks, offtimeTasks, inactiveOfftimeTasks, inactiveSupportTasks, inactiveTrainingTasks, customTrainingTasks, invoiceRecipient, appUsers, auditLog, autoBackup, emailTemplate]);

    // Flush pending local save before the page unloads so a fast tab close
    // doesn't drop the most recent edits.
    useEffect(() => {
        const flush = () => {
            if (!localSaveTimer.current) return;
            clearTimeout(localSaveTimer.current);
            localSaveTimer.current = null;
            try {
                localStorage.setItem('teamMasterProData', JSON.stringify(latestStateRef.current));
            } catch(e) {}
        };
        window.addEventListener('beforeunload', flush);
        return () => window.removeEventListener('beforeunload', flush);
    }, []);

    const applyRemoteSnapshot = useCallback((data, { notify = true } = {}) => {
        isRemoteUpdateRef.current = true;
        setEmployees(data.employees || []);
        setProjects(data.projects || []);
        setAssignments(data.assignments || []);
        setExpenses(data.expenses || []);
        if (data.costItems) setCostItems(migrateCostItems(data.costItems));
        else if (data.expenses && data.expenses.length > 0) setCostItems(migrateCostItems(migrateExpensesToCostItems(data.expenses)));
        // Guard: never overwrite non-empty local arrays with empty remote data.
        // Protects against transient load races (e.g. partial file fetches)
        // wiping user-defined categories/tasks/inactive lists.
        if (data.empCategories?.length) setEmpCategories(data.empCategories);
        setProjCategories(prev => data.projCategories?.length > 0 ? data.projCategories : prev);
        if (data.projTypes !== undefined) setProjTypes(data.projTypes || []);
        setBasicTasks(prev => data.basicTasks?.length > 0 ? data.basicTasks : prev);
        // Meta is a map that can legitimately be empty (all Basic Tasks
        // hardcoded, no user-created Other Tasks). Only skip when the remote
        // didn't even include the field – `undefined` means "no signal".
        if (data.basicTasksMeta !== undefined) setBasicTasksMeta(data.basicTasksMeta);
        setInactiveBasicTasks(prev => data.inactiveBasicTasks?.length > 0 ? data.inactiveBasicTasks : prev);
        setOfftimeTasks(prev => data.offtimeTasks?.length > 0 ? data.offtimeTasks : prev);
        setInactiveOfftimeTasks(prev => data.inactiveOfftimeTasks?.length > 0 ? data.inactiveOfftimeTasks : prev);
        setInactiveSupportTasks(prev => data.inactiveSupportTasks?.length > 0 ? data.inactiveSupportTasks : prev);
        setInactiveTrainingTasks(prev => data.inactiveTrainingTasks?.length > 0 ? data.inactiveTrainingTasks : prev);
        setCustomTrainingTasks(prev => data.customTrainingTasks?.length > 0 ? data.customTrainingTasks : prev);
        if (data.invoiceRecipient !== undefined) setInvoiceRecipient(data.invoiceRecipient);
        if (data.autoBackup) {
            const { lastBackupAt: _ignored, ...rest } = data.autoBackup;
            setAutoBackup(prev => ({ ...prev, ...rest }));
        }
        if (data.emailTemplate) setEmailTemplate(prev => ({ ...prev, ...data.emailTemplate }));
        // Skip updating users if the incoming snapshot is a stripped localStorage
        // copy (no PIN data present). PIN hashes are intentionally omitted from
        // localStorage to avoid persisting secrets; only SP/FS snapshots carry
        // full user records. An empty-or-absent users array is still passed
        // through so fresh installs trigger the admin seed flow correctly.
        // applyRemoteSnapshot is only called with data from SP/FS (which always
        // carries pinHash) or from localStorage cross-tab events (stripped,
        // no pinHash). Only process users when real PIN data is present to
        // prevent empty-user snapshots from triggering admin re-seeding and
        // wiping previously created users.
        const incomingUsers = data.appUsers;
        const hasAnyPinData = (incomingUsers || []).some(u => u.pinHash || u.pin);
        if (hasAnyPinData) {
            migrateAndSetUsers(incomingUsers);
        }
        // Audit log is append-only across clients – never replace local
        // pending entries with a remote snapshot that doesn't have them.
        // Union by id, newest first, capped at 500.
        setAuditLog(prev => mergeAuditLogs(prev, data.auditLog || []));
        // Also re-seed the snapshots so the save cascade triggered by these
        // setStates doesn't rewrite identical data back to the server.
        try {
            seedLastSaved(data, lastSavedSpRef.current);
            seedLastSaved(data, lastSavedFsRef.current);
        } catch(e) { console.warn('[SEED] snapshot seeding failed in applyRemoteSnapshot', e); }
        if (notify) {
            setSyncStatus('updated');
            setTimeout(() => { if (syncStatusRef.current === 'updated') setSyncStatus('idle'); }, 2000);
        }
    }, []);

    // Cross-tab sync: when another tab on the same origin writes the local
    // snapshot, react to it instead of letting both tabs clobber each other.
    // The browser only fires this event for OTHER tabs, so we never echo our
    // own writes.
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key !== 'teamMasterProData') return;
            if (!e.newValue) return;
            try {
                const data = JSON.parse(e.newValue);
                applyRemoteSnapshot(data, { notify: true });
            } catch (err) { /* malformed write from another tab – ignore */ }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [applyRemoteSnapshot]);

    // SharePoint polling – pick up changes from other users every 5 seconds.
    // One folder-list call returns timestamps+etags for all files; if only team
    // assignment/cost-item files changed, only those are reloaded (selective
    // reload). A full reload is triggered when employees/projects/settings change.
    const pollFailuresRef = useRef(0);
    // Counts consecutive poll cycles that found no remote changes. Used for
    // adaptive back-off: after 12 quiet cycles (≈1 min at 5 s interval) the
    // effective poll rate drops to ≈1 per 15 s to reduce SP request volume
    // during idle periods. Resets to 0 on any remote change or local save.
    const pollIdleCyclesRef = useRef(0);
    const pollInFlightRef = useRef(false);
    // True when we saw changes without meta.json (possible mid-write); forces
    // a full reload on the next cycle as a safety net.
    const pendingReloadRef = useRef(false);
    useEffect(() => {
        if (!SP_CONTEXT) return;
        const poll = async () => {
            if (document.visibilityState === 'hidden') return;
            if (pollInFlightRef.current) return;
            const st = syncStatusRef.current;
            if (st === 'syncing' || st === 'connecting' || st === 'reconnecting' || st === 'needs-auth') return;
            // Adaptive back-off: after 12 quiet cycles skip 2 of every 3 ticks
            // (effective interval ≈15 s). Avoids spamming SP when no one is editing.
            const idleCount = pollIdleCyclesRef.current;
            if (idleCount > 12 && idleCount % 3 !== 0) {
                pollIdleCyclesRef.current++;
                return;
            }
            pollInFlightRef.current = true;
            try {
                const newMeta = await spGetFolderMeta(SP_CONTEXT);
                const changedFiles = Object.keys(newMeta).filter(f => newMeta[f].ts !== spFileTimestampsRef.current[f]);
                if (changedFiles.length > 0) {
                    pollIdleCyclesRef.current = 0; // remote changes → restore fast polling
                    // A local save is debounced and about to fire – skip this cycle so
                    // we don't overwrite our pending state with a stale remote snapshot.
                    if (spSaveTimer.current !== null) return;

                    // Files changed but meta.json (the commit marker) is not among
                    // them: probably a mid-write.  Defer; on the next cycle
                    // pendingReloadRef forces a full reload regardless.
                    if (!changedFiles.includes('meta.json') && !pendingReloadRef.current) {
                        pendingReloadRef.current = true;
                        return;
                    }
                    pendingReloadRef.current = false;

                    // audit.json ändert sich bei JEDER Planungsänderung (logAudit).
                    // Als globale Datei würde sie sonst bei jedem Edit eines
                    // Kollegen einen Voll-Reload aller Dateien auslösen – bei
                    // mehreren gleichzeitigen Nutzern der mit Abstand größte
                    // Request-Treiber. Ist audit.json die EINZIGE geänderte
                    // globale Datei, reicht ein selektiver Merge (mergeAuditLogs
                    // ist ohnehin die Konfliktstrategie fürs Audit-Log).
                    const changedGlobals = changedFiles.filter(f => GLOBAL_DATA_FILES.includes(f));
                    const onlyAuditChanged = changedGlobals.length > 0 && changedGlobals.every(f => f === 'audit.json');
                    const needsFullReload = changedGlobals.length > 0 && !onlyAuditChanged;

                    // A changed team file referring to an unknown team can happen when
                    // an employee's team was renamed mid-air – fall back to full reload.
                    const knownTeams = new Set(empCategoriesRef.current || DEFAULT_TEAMS);
                    const hasUnknownTeam = !needsFullReload && changedFiles.some(f => {
                        if (f.startsWith('assignments-')) {
                            return !knownTeams.has(f.slice('assignments-'.length, -'.json'.length));
                        }
                        return false;
                    });

                    if (needsFullReload || hasUnknownTeam) {
                        const { state, timestamps, etags } = await loadSplitStateSp(SP_CONTEXT);
                        spFileTimestampsRef.current = timestamps;
                        spFileEtagsRef.current = stripMetaEtag(etags);
                        applyRemoteSnapshot(state);
                    } else {
                        // Selektiver Audit-Merge (siehe Kommentar oben): Union
                        // per Eintrags-ID statt Voll-Reload; konvergiert, weil
                        // der Merge deterministisch sortiert und kappt.
                        if (onlyAuditChanged) {
                            const auditData = await spLoadFile(SP_CONTEXT, 'audit.json').catch(() => null);
                            if (Array.isArray(auditData?.auditLog)) {
                                setAuditLog(prev => {
                                    const merged = mergeAuditLogs(prev, auditData.auditLog);
                                    // Diff-Basis mitziehen: enthält das lokale Log
                                    // nichts Neues, ist der nächste Save für
                                    // audit.json ein No-Op statt eines Echo-Writes.
                                    lastSavedSpRef.current['audit.json'] = JSON.stringify({ auditLog: merged });
                                    return merged;
                                });
                            }
                        }
                        const { assignmentsByTeam, costItemsByTeam } =
                            await loadChangedTeamFilesSp(SP_CONTEXT, changedFiles);
                        const empTeamMap = new Map(
                            employeesRef.current.map(e => [e.id, e.category || 'Other'])
                        );
                        const teamsUpdated = new Set([
                            ...Object.keys(assignmentsByTeam),
                            ...Object.keys(costItemsByTeam),
                        ]);
                        setAssignments(prev => {
                            const kept = prev.filter(a => !teamsUpdated.has(empTeamMap.get(a.empId) || 'Other'));
                            return [...kept, ...Object.values(assignmentsByTeam).flat()];
                        });
                        setCostItems(prev => {
                            const kept = prev.filter(c => !teamsUpdated.has(empTeamMap.get(c.empId) || 'Other'));
                            return [...kept, ...migrateCostItems(Object.values(costItemsByTeam).flat())];
                        });
                        // Update timestamps; invalidate ETags for remotely-changed files so
                        // our next write for those files uses overwrite=true (safe: we just
                        // applied the remote state, so there's no local-only version to protect).
                        changedFiles.forEach(f => {
                            spFileTimestampsRef.current[f] = newMeta[f].ts;
                            delete spFileEtagsRef.current[f];
                        });
                        changedFiles.forEach(f => {
                            if (f.startsWith('assignments-')) {
                                const team = f.slice('assignments-'.length, -'.json'.length);
                                lastSavedSpRef.current[f] = JSON.stringify({ assignments: assignmentsByTeam[team] || [] });
                            } else if (f.startsWith('cost-items-')) {
                                const team = f.slice('cost-items-'.length, -'.json'.length);
                                lastSavedSpRef.current[f] = JSON.stringify({ costItems: costItemsByTeam[team] || [] });
                            }
                        });
                    }
                } else {
                    // No remote changes – if a mid-write deferral was pending it
                    // can be cleared safely (the write either completed and our
                    // save covered it, or never actually happened).
                    pendingReloadRef.current = false;
                    pollIdleCyclesRef.current++; // quiet cycle → adaptive back-off
                }
                pollFailuresRef.current = 0;
                // Recover from a prior 'offline' as soon as the next poll
                // succeeds – no need to wait for a user edit.
                if (syncStatusRef.current === 'offline') setSyncStatus('idle');
            } catch(e) {
                if (e instanceof SpAuthError) {
                    // Session expired – drive the recovery pipeline. Silent
                    // refresh succeeds while the user's Entra session is
                    // alive, otherwise we surface the manual reconnect CTA.
                    setSyncStatus('reconnecting');
                    const ok = await spEnsureSession(SP_CONTEXT, { interactive: false });
                    setSyncStatus(ok ? 'idle' : 'needs-auth');
                    pollFailuresRef.current = 0;
                } else {
                    pollFailuresRef.current += 1;
                    if (pollFailuresRef.current >= 3 && syncStatusRef.current === 'idle') {
                        setSyncStatus('offline');
                    }
                }
            } finally {
                pollInFlightRef.current = false;
            }
        };
        // Jitter (5 s ± 1 s) statt festem setInterval-Raster: verhindert, dass
        // mehrere Clients ihre Folder-Meta-Requests dauerhaft synchron abfeuern
        // (Thundering Herd → unnötiges SharePoint-Throttling bei mehreren
        // gleichzeitigen Nutzern).
        let cancelled = false;
        let timer = null;
        const schedule = () => {
            if (cancelled) return;
            timer = setTimeout(async () => {
                try { await poll(); } finally { schedule(); }
            }, 4000 + Math.random() * 2000);
        };
        schedule();
        // Beim Zurückkehren in den Tab sofort pollen statt bis zu 15 s
        // (Idle-Back-off) zu warten – Änderungen von Kollegen erscheinen ohne
        // spürbare Verzögerung.
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            pollIdleCyclesRef.current = 0;
            poll();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // [] is intentional: applyRemoteSnapshot has its own [] deps and therefore
    // never changes identity; empCategoriesRef is a stable ref object whose
    // .current is read inside the callback. Re-registering the interval on
    // every render would reset the polling cadence without benefit.
    }, []);
    // nicht auf 'idle' flippt (z.B. wegen eines geschluckten Fetches
    // oder Browser-Quirks), aber Saves trotzdem durchgehen, nach 10 s
    // auf 'idle' umstellen, damit die UI nicht dauerhaft „Verbindet ..."
    // zeigt.
    useEffect(() => {
        if (!SP_CONTEXT) return;
        const t = setTimeout(() => {
            if (syncStatusRef.current === 'connecting') setSyncStatus('idle');
        }, 10000);
        return () => clearTimeout(t);
    }, []);

    // File System polling – Änderungen von Kollegen alle 5 Sek. erkennen.
    useEffect(() => {
        if (!FS_MODE) return;
        const poll = async () => {
            if (document.visibilityState === 'hidden') return;
            if (!dirHandleRef.current) return;
            try {
                const newTs = await fsGetFolderTimestamps(dirHandleRef.current);
                const prev = fsFileTimestampsRef.current;
                const changed = Object.keys(newTs).some(f => newTs[f] !== prev[f]);
                if (changed) {
                    const { state, timestamps } = await loadSplitStateFs(dirHandleRef.current);
                    fsFileTimestampsRef.current = timestamps;
                    applyRemoteSnapshot(state);
                }
            } catch(e) {
                // Transient errors are expected (file mid-write, handle busy);
                // still log them so a permanently broken poll is diagnosable.
                console.warn('[FS] poll failed', e);
            }
        };
        // Gleicher Jitter wie beim SharePoint-Polling (siehe oben).
        let cancelled = false;
        let timer = null;
        const schedule = () => {
            if (cancelled) return;
            timer = setTimeout(async () => {
                try { await poll(); } finally { schedule(); }
            }, 4000 + Math.random() * 2000);
        };
        schedule();
        const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // [] is intentional: applyRemoteSnapshot has its own [] deps and therefore
    // never changes identity; dirHandleRef is a stable ref whose .current is
    // read inside the callback. Re-registering the interval resets the cadence.
    }, []);

    // Shared helper: after any kind of successful re-auth we want to pull the
    // latest remote snapshot so the UI can't show stale data.
    const refreshSpSnapshot = useCallback(async () => {
        try {
            const { state, timestamps, etags } = await loadSplitStateSp(SP_CONTEXT);
            spFileTimestampsRef.current = timestamps;
            spFileEtagsRef.current = stripMetaEtag(etags);
            if (state && (state.employees.length || state.assignments.length || state.projects.length)) {
                applyRemoteSnapshot(state, { notify: false });
            }
            return true;
        } catch(e) {
            console.warn('[SP] snapshot refresh failed', e);
            return false;
        }
    }, [applyRemoteSnapshot]);

    // Manual reconnect button on the status pill. Must run inside a click
    // handler so the browser allows the popup used for interactive re-auth.
    const reconnectSharePoint = useCallback(async () => {
        if (!SP_CONTEXT) return;
        setSyncStatus('reconnecting');
        const ok = await spEnsureSession(SP_CONTEXT, { interactive: true });
        if (!ok) { setSyncStatus('needs-auth'); return; }
        const loaded = await refreshSpSnapshot();
        setSyncStatus(loaded ? 'idle' : 'needs-auth');
    }, [refreshSpSnapshot]);

    // Ensure form defaults align with categories
    useEffect(() => {
        if (!empForm.category && empCategories.length > 0) {
            setEmpForm(prev => ({...prev, category: empCategories[0]}));
        }
        if (!projForm.category && projCategories.length > 0) {
            setProjForm(prev => ({...prev, category: projCategories[0]}));
        }
    }, [empCategories, projCategories]);

    // Auto-scroll to current week when switching to resource or project tab.
    // If a scrollTarget was set (e.g. via the Auslastung cell-jump), the
    // ResourceView itself honours it from its own effect so we just skip
    // the default jump-to-today here.
    useEffect(() => {
        if (activeTab === 'resource') {
            if (scrollTarget?.weekId) return; // ResourceView handles it
            const timer = setTimeout(() => scrollToCurrentWeek(resourceScrollRef, timelineWeeks, 220), 80);
            return () => clearTimeout(timer);
        }
        if (activeTab === 'project') {
            const timer = setTimeout(() => scrollToCurrentWeek(timelineScrollRef, timelineWeeks, TIMELINE_WEEK_W), 80);
            return () => clearTimeout(timer);
        }
    }, [activeTab]);

    // --- LOGIC ---
    const employeeById = useMemo(() => {
        const m = new Map();
        employees.forEach(e => m.set(e.id, e));
        return m;
    }, [employees]);

    const projectById = useMemo(() => {
        const m = new Map();
        projects.forEach(p => m.set(p.id, p));
        return m;
    }, [projects]);

    const assignmentsByEmpWeek = useMemo(() => {
        const m = new Map();
        assignments.forEach(a => {
            const key = a.empId + '\u0000' + a.week;
            let arr = m.get(key);
            if (!arr) { arr = []; m.set(key, arr); }
            arr.push(a);
        });
        return m;
    }, [assignments]);

    const assignmentsByProject = useMemo(() => {
        const m = new Map();
        assignments.forEach(a => {
            let arr = m.get(a.reference);
            if (!arr) { arr = []; m.set(a.reference, arr); }
            arr.push(a);
        });
        return m;
    }, [assignments]);

    const assignmentsByProjectWeek = useMemo(() => {
        const m = new Map();
        assignments.forEach(a => {
            const key = a.reference + '\u0000' + a.week;
            let arr = m.get(key);
            if (!arr) { arr = []; m.set(key, arr); }
            arr.push(a);
        });
        return m;
    }, [assignments]);

    const costItemsByProject = useMemo(() => {
        const m = new Map();
        costItems.forEach(c => {
            let arr = m.get(c.projectId);
            if (!arr) { arr = []; m.set(c.projectId, arr); }
            arr.push(c);
        });
        return m;
    }, [costItems]);

    const getEmpWeeklyHours = useCallback((empId) => {
        return employeeById.get(empId)?.weeklyHours ?? HOURS_PER_WEEK;
    }, [employeeById]);

    const projectStatusById = useMemo(() => {
        const now = getWeekString(new Date());
        const m = new Map();
        projects.forEach(p => {
            let status;
            if (p.costsSubmitted) status = 'costs_submitted';
            else if (p.projectCompleted) status = 'completed';
            else {
                const projCosts = costItemsByProject.get(p.id) || [];
                const projAss = assignmentsByProject.get(p.id) || [];
                if (compareWeekIds(p.ibnWeek, now) < 0 && projAss.length > 0 && projCosts.length === 0) status = 'missing_costs';
                else if (compareWeekIds(p.startWeek, now) <= 0) status = 'active';
                else status = 'planned';
            }
            m.set(p.id, status);
        });
        return m;
    }, [projects, assignmentsByProject, costItemsByProject]);

    const computeAutoStatus = useCallback((p) => {
        return projectStatusById.get(p.id) ?? 'planned';
    }, [projectStatusById]);

    // Derived collections – memoized so render functions don't rebuild them
    // on every keystroke / polling tick.
    const activeEmployees = useMemo(
        () => employees.filter(e => e.active !== false),
        [employees]
    );

    const activeEmpsByCategory = useMemo(() => {
        const m = new Map();
        activeEmployees.forEach(e => {
            let arr = m.get(e.category);
            if (!arr) { arr = []; m.set(e.category, arr); }
            arr.push(e);
        });
        // Sort employees alphabetically within each category
        m.forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name, 'de')));
        return m;
    }, [activeEmployees]);

    const activeEmpCategories = useMemo(
        () => Array.from(activeEmpsByCategory.keys()).sort((a, b) =>
            a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b, 'de')
        ),
        [activeEmpsByCategory]
    );

    // Employees who have ever been planned for any 'support' assignment
    // (past or future). Drives the optional Support tab.
    const supportEmpIds = useMemo(() => {
        const s = new Set();
        for (let i = 0; i < assignments.length; i++) {
            if (assignments[i].type === 'support') s.add(assignments[i].empId);
        }
        return s;
    }, [assignments]);

    const supportEmpsByCategory = useMemo(() => {
        const m = new Map();
        const seen = new Set();
        const add = (e) => {
            if (seen.has(e.id)) return;
            seen.add(e.id);
            let arr = m.get(e.category);
            if (!arr) { arr = []; m.set(e.category, arr); }
            arr.push(e);
        };
        // Active employees first (so a deactivated employee with an old
        // support stint still shows up under their team).
        activeEmployees.forEach(e => { if (supportEmpIds.has(e.id)) add(e); });
        employees.forEach(e => { if (supportEmpIds.has(e.id)) add(e); });
        m.forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name, 'de')));
        return m;
    }, [activeEmployees, employees, supportEmpIds]);

    const supportEmpCategories = useMemo(
        () => Array.from(supportEmpsByCategory.keys()).sort((a, b) =>
            a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b, 'de')
        ),
        [supportEmpsByCategory]
    );

    const hasSupportEmployees = supportEmpIds.size > 0;

    // Projects grouped by category for the planning views (Timeline tab,
    // Resource project assignments, …). Projects whose ibnWeek has passed
    // drop out of the planning lists – they remain visible only in the
    // Verwaltung → Projekte tab (which uses the raw `projects` array) until
    // an admin sets the "Abgeschlossen" flag.
    const projectsByCategory = useMemo(() => {
        const m = new Map();
        const planningStatuses = new Set(['active', 'planned']);
        projects.forEach(p => {
            if (!planningStatuses.has(projectStatusById.get(p.id))) return;
            let arr = m.get(p.category);
            if (!arr) { arr = []; m.set(p.category, arr); }
            arr.push(p);
        });
        for (const arr of m.values()) {
            arr.sort((a, b) => compareWeekIds(a.startWeek || '', b.startWeek || ''));
        }
        return m;
    }, [projects, projectStatusById]);

    const projCategoriesFromProjects = useMemo(
        () => Array.from(projectsByCategory.keys()).sort((a, b) =>
            a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b, 'de')
        ),
        [projectsByCategory]
    );

    // Cache weeks per year – generateWeeksForYear does Easter math + 54
    // iterations, expensive to redo on every render.
    const weeksByYearCacheRef = useRef(new Map());
    const getWeeksForYear = useCallback((year) => {
        const cache = weeksByYearCacheRef.current;
        if (!cache.has(year)) cache.set(year, generateWeeksForYear(year));
        return cache.get(year);
    }, []);
    const timelineWeeks = useMemo(() => getWeeksForYear(timelineYear), [timelineYear, getWeeksForYear]);

    const utilizationMap = useMemo(() => {
        const m = new Map();
        for (const [key, weekAss] of assignmentsByEmpWeek) {
            const empId = key.slice(0, key.indexOf('\u0000'));
            const weeklyHours = getEmpWeeklyHours(empId);
            let total = 0;
            let isOfftime = false;
            for (let i = 0; i < weekAss.length; i++) {
                const a = weekAss[i];
                total += ((a.hours ?? ((a.percent ?? 100) / 100 * weeklyHours)) / weeklyHours) * 100;
                if (a.type === 'offtime') isOfftime = true;
            }
            m.set(key, { total, isOfftime, assignments: weekAss });
        }
        return m;
    }, [assignmentsByEmpWeek, getEmpWeeklyHours]);

    const getUtilization = useCallback((empId, week) =>
        utilizationMap.get(empId + '\u0000' + week) ?? { total: 0, isOfftime: false, assignments: [] }
    , [utilizationMap]);

    const toggleCategory = useCallback((cat) => {
        setCollapsedCategories(prev => ({...prev, [cat]: !prev[cat]}));
    }, []);

    const toggleProjCategory = useCallback((cat) => {
        setCollapsedProjCategories(prev => ({...prev, [cat]: !prev[cat]}));
    }, []);

    const toggleEmpSetup = useCallback((cat) => {
        setCollapsedEmpSetup(prev => ({...prev, [cat]: !prev[cat]}));
    }, []);

    const handleSaveAssignment = useCallback((data) => {
        if (Array.isArray(data)) {
            setAssignments(prev => [...prev, ...data]);
            const first = data[0];
            const weeks = data.map(a => a.week).filter(Boolean).sort();
            const weekRange = weeks.length > 1 && weeks[0] !== weeks[weeks.length - 1]
                ? `${formatKW(weeks[0])} – ${formatKW(weeks[weeks.length - 1])}`
                : formatKW(weeks[0]);
            const emp = employeesRef.current.find(e => e.id === first?.empId);
            logAudit('assignment_copy',
                `${data.length}× ${describeAssignmentLocal(first)} für ${emp?.name || '?'} (${weekRange})`,
                { type: 'del_assignments', ids: data.map(a => a.id) });
        } else if (data.id) {
            const oldAss = assignmentsRef.current.find(a => a.id === data.id);
            setAssignments(prev => prev.map(a => a.id === data.id ? data : a));
            const emp = employeesRef.current.find(e => e.id === data.empId);
            const weekChanged = oldAss && oldAss.week !== data.week;
            const weekPart = weekChanged
                ? `${formatKW(oldAss.week)} → ${formatKW(data.week)}`
                : formatKW(data.week);
            logAudit('assignment_update',
                `${describeAssignmentLocal(data)} – ${emp?.name || '?'} (${weekPart})`,
                { type: 'restore_assignment', prev: oldAss });
        } else {
            const newId = makeId('ass');
            setAssignments(prev => [...prev, { ...data, id: newId }]);
            const emp = employeesRef.current.find(e => e.id === data.empId);
            logAudit('assignment_create',
                `${describeAssignmentLocal(data)} – ${emp?.name || '?'} (${formatKW(data.week)})`,
                { type: 'del_assignment', ids: [newId] });
        }
        setIsAssignModalOpen(false);
    }, [logAudit]);

    // Build the dependent-records bundle for a project or employee delete.
    // Used both for the cascade-confirm preview and the actual cascade.
    const computeDeleteDependents = useCallback((kind, id) => {
        if (kind === 'project') {
            return {
                assignments: assignmentsRef.current.filter(a => a.type === 'project' && a.reference === id),
                costItems: costItemsRef.current.filter(c => c.projectId === id),
            };
        }
        if (kind === 'employee') {
            return {
                assignments: assignmentsRef.current.filter(a => a.empId === id),
                costItems: costItemsRef.current.filter(c => c.empId === id),
            };
        }
        return { assignments: [], costItems: [] };
    }, []);

    const performProjectDelete = useCallback((projectId, dependents) => {
        const prev = projectsRef.current.find(p => p.id === projectId);
        if (!prev) return;
        const assIds = new Set(dependents.assignments.map(a => a.id));
        const ciIds = new Set(dependents.costItems.map(c => c.id));
        suppressProjectAuditRef.current = true;
        setProjects(p => p.filter(x => x.id !== projectId));
        if (assIds.size > 0) setAssignments(prevA => prevA.filter(a => !assIds.has(a.id)));
        if (ciIds.size > 0) setCostItems(prevC => prevC.filter(c => !ciIds.has(c.id)));
        const cascadeNote = (assIds.size || ciIds.size)
            ? ` (Kaskade: ${assIds.size} Einsätze, ${ciIds.size} Kosten)` : '';
        logAudit('project_delete',
            `Projekt gelöscht: ${prev.name}${cascadeNote}`,
            { type: 'restore_project_cascade', prev,
              assignments: dependents.assignments, costItems: dependents.costItems });
        showToast(`Projekt „${prev.name}" gelöscht${cascadeNote}`, {
            type: 'success', duration: 6000,
            action: { label: 'Rückgängig', onClick: () => {
                setProjects(p => p.some(q => q.id === prev.id) ? p : [...p, prev]);
                if (dependents.assignments.length > 0) {
                    setAssignments(prevA => {
                        const ids = new Set(prevA.map(a => a.id));
                        return [...prevA, ...dependents.assignments.filter(a => !ids.has(a.id))];
                    });
                }
                if (dependents.costItems.length > 0) {
                    setCostItems(prevC => {
                        const ids = new Set(prevC.map(c => c.id));
                        return [...prevC, ...dependents.costItems.filter(c => !ids.has(c.id))];
                    });
                }
            } }
        });
    }, [logAudit, showToast]);

    const performEmployeeDelete = useCallback((empId, dependents) => {
        const prev = employeesRef.current.find(e => e.id === empId);
        if (!prev) return;
        const assIds = new Set(dependents.assignments.map(a => a.id));
        const ciIds = new Set(dependents.costItems.map(c => c.id));
        suppressEmployeeAuditRef.current = true;
        setEmployees(p => p.filter(x => x.id !== empId));
        if (assIds.size > 0) setAssignments(prevA => prevA.filter(a => !assIds.has(a.id)));
        if (ciIds.size > 0) setCostItems(prevC => prevC.filter(c => !ciIds.has(c.id)));
        const cascadeNote = (assIds.size || ciIds.size)
            ? ` (Kaskade: ${assIds.size} Einsätze, ${ciIds.size} Kosten)` : '';
        logAudit('employee_delete',
            `Mitarbeiter gelöscht: ${prev.name}${cascadeNote}`,
            { type: 'restore_employee_cascade', prev,
              assignments: dependents.assignments, costItems: dependents.costItems });
        showToast(`Mitarbeiter „${prev.name}" gelöscht${cascadeNote}`, {
            type: 'success', duration: 6000,
            action: { label: 'Rückgängig', onClick: () => {
                setEmployees(p => p.some(q => q.id === prev.id) ? p : [...p, prev]);
                if (dependents.assignments.length > 0) {
                    setAssignments(prevA => {
                        const ids = new Set(prevA.map(a => a.id));
                        return [...prevA, ...dependents.assignments.filter(a => !ids.has(a.id))];
                    });
                }
                if (dependents.costItems.length > 0) {
                    setCostItems(prevC => {
                        const ids = new Set(prevC.map(c => c.id));
                        return [...prevC, ...dependents.costItems.filter(c => !ids.has(c.id))];
                    });
                }
            } }
        });
    }, [logAudit, showToast]);

    // Public delete-with-cascade entry points. If there are no dependents,
    // delete straight away; otherwise pop the confirm modal.
    const requestDeleteProject = useCallback((projectId) => {
        const proj = projectsRef.current.find(p => p.id === projectId);
        if (!proj) return;
        const dependents = computeDeleteDependents('project', projectId);
        if (dependents.assignments.length === 0 && dependents.costItems.length === 0) {
            performProjectDelete(projectId, dependents);
            return;
        }
        setCascadeConfirm({
            entityKind: 'project',
            entityName: proj.name,
            entityId: projectId,
            dependents,
        });
    }, [computeDeleteDependents, performProjectDelete]);

    const requestDeleteEmployee = useCallback((empId) => {
        const emp = employeesRef.current.find(e => e.id === empId);
        if (!emp) return;
        const dependents = computeDeleteDependents('employee', empId);
        if (dependents.assignments.length === 0 && dependents.costItems.length === 0) {
            performEmployeeDelete(empId, dependents);
            return;
        }
        setCascadeConfirm({
            entityKind: 'employee',
            entityName: emp.name,
            entityId: empId,
            dependents,
        });
    }, [computeDeleteDependents, performEmployeeDelete]);

    const confirmCascadeDelete = useCallback(() => {
        const c = cascadeConfirm;
        if (!c) return;
        setCascadeConfirm(null);
        if (c.entityKind === 'project') performProjectDelete(c.entityId, c.dependents);
        else if (c.entityKind === 'employee') performEmployeeDelete(c.entityId, c.dependents);
    }, [cascadeConfirm, performProjectDelete, performEmployeeDelete]);

    const handleDeleteAssignment = useCallback((id) => {
        const deleted = assignmentsRef.current.find(a => a.id === id);
        setAssignments(prev => prev.filter(a => a.id !== id));
        if (deleted) {
            const emp = employeesRef.current.find(e => e.id === deleted.empId);
            logAudit('assignment_delete',
                `${describeAssignmentLocal(deleted)} – ${emp?.name || '?'} (${formatKW(deleted.week)})`,
                { type: 'restore_assignment', prev: deleted });
        }
        setIsAssignModalOpen(false);
    }, [logAudit]);

    const handleDeleteAssignmentSeries = useCallback((id) => {
        const ass = assignmentsRef.current.find(a => a.id === id);
        if (!ass) { setIsAssignModalOpen(false); return; }
        const toDelete = assignmentsRef.current.filter(a => a.ruleId === ass.ruleId && a.week >= ass.week);
        setAssignments(prev => prev.filter(a => !(a.ruleId === ass.ruleId && a.week >= ass.week)));
        const emp = employeesRef.current.find(e => e.id === ass.empId);
        const weeks = toDelete.map(a => a.week).sort();
        const weekRange = weeks.length > 1 && weeks[0] !== weeks[weeks.length - 1]
            ? `${formatKW(weeks[0])} – ${formatKW(weeks[weeks.length - 1])}`
            : formatKW(weeks[0]);
        logAudit('assignment_delete_series',
            `Terminserie ${describeAssignmentLocal(ass)} – ${emp?.name || '?'} (${toDelete.length}× ${weekRange})`,
            { type: 'restore_assignments', prevItems: toDelete });
        setIsAssignModalOpen(false);
    }, [logAudit]);

    const handleDrop = useCallback((e, targetWeek, targetEmpIdOrProjId, isResourceView = false) => {
        e.preventDefault();
        if (!currentUserRef.current) return; // passive users cannot drag-drop
        const assignmentId = e.dataTransfer.getData('assignmentId');
        if (assignmentId) {
            // Move existing assignment chip. In resource view: reassign to target employee.
            // In project view: reassign to target project (only for project-type chips).
            const origAss = assignmentsRef.current.find(a => a.id === assignmentId);
            setAssignments(prev => prev.map(a => {
                if (a.id !== assignmentId) return a;
                const updated = { ...a, week: targetWeek };
                if (isResourceView) {
                    const newEmpId = targetEmpIdOrProjId;
                    if (newEmpId !== a.empId) {
                        updated.empId = newEmpId;
                        delete updated.comment;
                        // Preserve the *percentage*, not the absolute hours, when
                        // the target employee has different weeklyHours than the
                        // source – e.g. 100 % on 35h → 100 % on 40h (= 40h).
                        const sourceEmp = employeesRef.current.find(e => e.id === a.empId);
                        const targetEmp = employeesRef.current.find(e => e.id === newEmpId);
                        const sourceWH = sourceEmp?.weeklyHours ?? HOURS_PER_WEEK;
                        const targetWH = targetEmp?.weeklyHours ?? HOURS_PER_WEEK;
                        if (sourceWH > 0 && targetWH !== sourceWH) {
                            updated.hours = (getAssignmentHours(a, sourceWH) / sourceWH) * targetWH;
                            delete updated.percent;
                        }
                    }
                } else if (a.type === 'project' && targetEmpIdOrProjId !== a.reference) {
                    updated.reference = targetEmpIdOrProjId;
                }
                return updated;
            }));
            if (origAss) {
                const newEmpId = isResourceView ? targetEmpIdOrProjId : origAss.empId;
                const fromEmp = employeesRef.current.find(e => e.id === origAss.empId);
                const toEmp = employeesRef.current.find(e => e.id === newEmpId);
                const empPart = fromEmp?.id !== toEmp?.id
                    ? `${fromEmp?.name || '?'} → ${toEmp?.name || '?'}`
                    : (toEmp?.name || '?');
                const weekPart = origAss.week !== targetWeek
                    ? `${formatKW(origAss.week)} → ${formatKW(targetWeek)}`
                    : formatKW(targetWeek);
                // For project drops, also describe the new project if it changed
                const draggedTask = (!isResourceView && origAss.type === 'project' && targetEmpIdOrProjId !== origAss.reference)
                    ? `${describeAssignmentLocal(origAss)} → ${describeAssignmentLocal({ ...origAss, reference: targetEmpIdOrProjId })}`
                    : describeAssignmentLocal(origAss);
                logAudit('assignment_drop',
                    `${draggedTask} – ${empPart} (${weekPart})`,
                    { type: 'restore_assignment', prev: origAss });
            }
            return;
        }
        const empId = e.dataTransfer.getData('empId');
        if (!empId) return;
        if (!isResourceView) {
            // Default a fresh drag-create to 100 % of the dragged employee's
            // weekly hours so a 35h employee gets a 35h chip (not 40h).
            const droppedEmp = employeesRef.current.find(x => x.id === empId);
            const droppedHours = droppedEmp?.weeklyHours ?? HOURS_PER_WEEK;
            setAssignments(prev => [...prev, {
                id: makeId('ass'),
                empId,
                week: targetWeek,
                type: 'project',
                reference: targetEmpIdOrProjId,
                hours: droppedHours
            }]);
        } else {
            // In resource view: open modal to pick type/reference
            setAssignContext({ empId: targetEmpIdOrProjId, week: targetWeek });
            setIsAssignModalOpen(true);
        }
    }, [logAudit]);

    const exportData = useCallback(() => {
        // Full export: every persisted field, minus user secrets (pin/pinHash/pinSalt).
        const data = JSON.stringify({
            employees, projects, assignments, expenses, costItems,
            empCategories, projCategories,
            basicTasks, basicTasksMeta, inactiveBasicTasks,
            offtimeTasks, inactiveOfftimeTasks,
            inactiveSupportTasks, inactiveTrainingTasks, customTrainingTasks,
            invoiceRecipient,
            appUsers: stripUserSecrets(appUsers),
            auditLog,
            exportedAt: new Date().toISOString(),
            schemaVersion: SCHEMA_VERSION
        }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Einsatzplanung3.0_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }, [employees, projects, assignments, expenses, costItems, empCategories, projCategories,
        basicTasks, basicTasksMeta, inactiveBasicTasks, offtimeTasks, inactiveOfftimeTasks,
        inactiveSupportTasks, inactiveTrainingTasks, customTrainingTasks, invoiceRecipient,
        appUsers, auditLog]);

    const importData = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const rawParsed = JSON.parse(event.target.result);
                const result = validateImportedState(rawParsed);
                if (!result.ok) {
                    if (result.reason === 'futureVersion') {
                        alert(`Diese Datei wurde mit einer neueren App-Version gespeichert (Schema v${result.version}, diese App nutzt v${SCHEMA_VERSION}). Bitte die App aktualisieren, bevor du sie importierst.`);
                    } else {
                        alert('Fehler beim Importieren der Daten: Die Datei konnte nicht gelesen werden.');
                    }
                    return;
                }
                const parsed = result.data;
                if (parsed.employees) setEmployees(parsed.employees);
                if (parsed.projects) setProjects(parsed.projects);
                if (parsed.assignments) setAssignments(parsed.assignments);
                if (parsed.expenses) setExpenses(parsed.expenses);
                if (parsed.costItems) {
                    setCostItems(migrateCostItems(parsed.costItems));
                } else if (parsed.expenses && parsed.expenses.length > 0) {
                    setCostItems(migrateCostItems(migrateExpensesToCostItems(parsed.expenses)));
                }
                if (parsed.empCategories) setEmpCategories(parsed.empCategories);
                if (parsed.projCategories) setProjCategories(parsed.projCategories);
                if (parsed.projTypes !== undefined) setProjTypes(parsed.projTypes || []);
                if (parsed.basicTasks) setBasicTasks(parsed.basicTasks);
                if (parsed.basicTasksMeta) setBasicTasksMeta(parsed.basicTasksMeta);
                if (parsed.inactiveBasicTasks) setInactiveBasicTasks(parsed.inactiveBasicTasks);
                if (parsed.offtimeTasks) setOfftimeTasks(parsed.offtimeTasks);
                if (parsed.inactiveOfftimeTasks) setInactiveOfftimeTasks(parsed.inactiveOfftimeTasks);
                if (parsed.inactiveSupportTasks) setInactiveSupportTasks(parsed.inactiveSupportTasks);
                if (parsed.inactiveTrainingTasks) setInactiveTrainingTasks(parsed.inactiveTrainingTasks);
                if (parsed.customTrainingTasks) setCustomTrainingTasks(parsed.customTrainingTasks);
                if (parsed.invoiceRecipient !== undefined) setInvoiceRecipient(parsed.invoiceRecipient);
                if (parsed.auditLog) setAuditLog(parsed.auditLog);
                // appUsers is deliberately NOT imported: a backup can otherwise
                // inject attacker-controlled pinHash/pinSalt records. Local user
                // accounts remain unchanged across import.
                showToast('Backup importiert – Nutzerkonten und PINs bleiben unverändert.', { type: 'success', duration: 5000 });
            } catch (err) {
                alert('Fehler beim Importieren der Daten: Die Datei konnte nicht gelesen werden.');
            }
        };
        reader.readAsText(file);
    }, []);

    const buildInvoiceData = useCallback((proj, selection) => {
        const projAss = assignmentsByProject.get(proj.id) || [];
        const hoursByEmp = new Map();
        for (let i = 0; i < projAss.length; i++) {
            const a = projAss[i];
            const h = a.hours ?? ((a.percent ?? 100) / 100 * HOURS_PER_WEEK);
            hoursByEmp.set(a.empId, (hoursByEmp.get(a.empId) || 0) + h);
        }

        const laborLines = [];
        let total = 0;
        const rate = proj.hourlyRate ?? DEFAULT_HOURLY_RATE;
        hoursByEmp.forEach((hours, empId) => {
            if (hours <= 0 || proj.billable === false) return;
            const cost = hours * rate;
            const included = !selection || selection.emps[empId];
            if (included) total += cost;
            laborLines.push({
                empId,
                emp: employeeById.get(empId),
                hours, rate, cost,
                included,
            });
        });

        const costLines = [];
        const projCosts = costItemsByProject.get(proj.id) || [];
        projCosts.forEach(ci => {
            const included = !selection || selection.costs[ci.id];
            if (included) total += ci.amount || 0;
            costLines.push({
                ci,
                emp: employeeById.get(ci.empId),
                included,
            });
        });

        return { laborLines, costLines, total };
    }, [assignmentsByProject, employeeById, costItemsByProject]);

    const openInvoiceModal = useCallback(() => {
        const proj = projectById.get(selectedProjectDetails);
        if (!proj) return;
        const projAss = assignmentsByProject.get(proj.id) || [];
        const empIds = [...new Set(projAss.map(a => a.empId))];
        const projCosts = costItemsByProject.get(proj.id) || [];

        const initialEmps = {};
        empIds.forEach(id => initialEmps[id] = true);

        const initialCosts = {};
        projCosts.forEach(c => initialCosts[c.id] = true);

        setInvoiceSelection({ emps: initialEmps, costs: initialCosts });
        setIsInvoiceModalOpen(true);
    }, [projectById, selectedProjectDetails, assignmentsByProject, costItemsByProject]);

    const handleInvoiceExport = () => {
        const proj = projectById.get(selectedProjectDetails);
        if (!proj) return;
        const { laborLines, costLines, total } = buildInvoiceData(proj, invoiceSelection);

        const fmt2 = n => n.toFixed(2);
        const cc = resolveCountryCode(proj.country);
        const rows = [];
        // ── Project details ─────────────────────────────────────
        rows.push(["PROJEKTDETAILS"]);
        rows.push(["Projekt", proj.name]);
        rows.push(["Projektnummer", proj.projectNumber || '\u2013']);
        if (proj.address)                           rows.push(["Adresse", proj.address]);
        if (cc && cc !== '/')                       rows.push(["Land", cc]);
        if (proj.projType)                          rows.push(["Typ", proj.projType]);
        if (proj.size != null && proj.size !== '')  rows.push(["Gr\u00f6\u00dfe", proj.size]);
        if (proj.ibnWeek)                           rows.push(["IBN-Woche", proj.ibnWeek]);
        if (proj.notes)                             rows.push(["Notizen", proj.notes]);
        rows.push(["Exportdatum", new Date().toLocaleDateString('de-DE')]);
        rows.push([]);

        // ── Labor ───────────────────────────────────────────────
        const includedLabor = laborLines.filter(l => l.included);
        if (includedLabor.length > 0) {
            rows.push(["PERSONALKOSTEN"]);
            rows.push(["Mitarbeiter", "Stunden", "Stundensatz (EUR/h)", "Betrag (EUR)"]);
            let laborTotal = 0;
            includedLabor.forEach(l => {
                rows.push([l.emp?.name || 'Unbekannt', String(l.hours), String(l.rate), fmt2(l.cost)]);
                laborTotal += l.cost;
            });
            rows.push(["Summe Personalkosten", "", "", fmt2(laborTotal)]);
            rows.push([]);
        }

        // ── Additional costs ────────────────────────────────────
        const includedCosts = costLines.filter(c => c.included);
        if (includedCosts.length > 0) {
            rows.push(["ZUSATZKOSTEN"]);
            rows.push(["Mitarbeiter", "Typ", "Beschreibung", "Menge", "Einzelpreis (EUR)", "Betrag (EUR)"]);
            let costsTotal = 0;
            includedCosts.forEach(({ ci, emp }) => {
                (ci.lines || []).forEach(l => {
                    const cfg = COST_LINE_TYPES[l.type] || COST_LINE_TYPES.other;
                    const desc = [ci.description, l.comment].filter(Boolean).join(' \u2013 ');
                    if (l.type === 'hours') {
                        const hrs = l.hours || 0, rate = l.hourlyRate || 0;
                        rows.push([emp?.name || 'Unbekannt', cfg.invoiceLabel, desc || 'Arbeitszeit', `${hrs} Std.`, String(rate), fmt2(hrs * rate)]);
                        costsTotal += hrs * rate;
                    } else {
                        const amt = l.amount || 0;
                        rows.push([emp?.name || 'Unbekannt', cfg.invoiceLabel, desc || '\u2013', "1", fmt2(amt), fmt2(amt)]);
                        costsTotal += amt;
                    }
                });
            });
            rows.push(["Summe Zusatzkosten", "", "", "", "", fmt2(costsTotal)]);
            rows.push([]);
        }

        // ── Total ───────────────────────────────────────────────
        rows.push(["GESAMT NETTO (EUR)", fmt2(total)]);

        const csvContent = "\uFEFF" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Rechnung_${proj.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

                setProjects(prev => prev.map(p => p.id === selectedProjectDetails ? {...p, invoiceStatus: 'exportiert'} : p));
    };

    const handleInvoiceSendEmail = () => {
        const proj = projectById.get(selectedProjectDetails);
        if (!proj) return;
        const { laborLines, costLines, total } = buildInvoiceData(proj, invoiceSelection);
        const fmt2 = n => n.toFixed(2);
        const cc = resolveCountryCode(proj.country);
        const sep = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';

        const lines = [];
        lines.push('Guten Tag,');
        lines.push('');
        lines.push(`anbei die Kostenaufstellung fuer Projekt "${proj.name}".`);
        lines.push('');

        // Project details
        lines.push(sep);
        lines.push('PROJEKTDETAILS');
        lines.push(sep);
        lines.push(`Projekt:       ${proj.name}`);
        lines.push(`Projektnummer: ${proj.projectNumber || '-'}`);
        if (proj.address) lines.push(`Adresse:       ${proj.address}`);
        if (cc && cc !== '/') lines.push(`Land:          ${cc}`);
        if (proj.projType) lines.push(`Typ:           ${proj.projType}`);
        if (proj.size != null && proj.size !== '') lines.push(`Groesse:       ${proj.size}`);
        if (proj.ibnWeek) lines.push(`IBN-Woche:     ${proj.ibnWeek}`);
        if (proj.notes) { lines.push(''); lines.push(`Notizen: ${proj.notes}`); }
        lines.push(`Datum:         ${new Date().toLocaleDateString('de-DE')}`);
        lines.push('');

        // Labor
        const includedLabor = laborLines.filter(l => l.included);
        if (includedLabor.length > 0) {
            lines.push(sep);
            lines.push('PERSONALKOSTEN');
            lines.push(sep);
            let laborTotal = 0;
            includedLabor.forEach(l => {
                lines.push(`  ${l.emp?.name || 'Unbekannt'}: ${l.hours} Std. x ${l.rate} EUR/h = ${fmt2(l.cost)} EUR`);
                laborTotal += l.cost;
            });
            lines.push(`  Summe: ${fmt2(laborTotal)} EUR`);
            lines.push('');
        }

        // Additional costs
        const includedCosts = costLines.filter(c => c.included);
        if (includedCosts.length > 0) {
            lines.push(sep);
            lines.push('ZUSATZKOSTEN');
            lines.push(sep);
            let costsTotal = 0;
            includedCosts.forEach(({ ci, emp }) => {
                (ci.lines || []).forEach(l => {
                    const cfg = COST_LINE_TYPES[l.type] || COST_LINE_TYPES.other;
                    const desc = [ci.description, l.comment].filter(Boolean).join(' - ');
                    const detail = desc ? ` (${desc})` : '';
                    if (l.type === 'hours') {
                        const hrs = l.hours || 0, rate = l.hourlyRate || 0;
                        lines.push(`  ${emp?.name || 'Unbekannt'} - ${cfg.invoiceLabel}${detail}: ${hrs} Std. x ${rate} EUR/h = ${fmt2(hrs * rate)} EUR`);
                        costsTotal += hrs * rate;
                    } else {
                        const amt = l.amount || 0;
                        lines.push(`  ${emp?.name || 'Unbekannt'} - ${cfg.invoiceLabel}${detail}: ${fmt2(amt)} EUR`);
                        costsTotal += amt;
                    }
                });
            });
            lines.push(`  Summe: ${fmt2(costsTotal)} EUR`);
            lines.push('');
        }

        // Total
        lines.push(sep);
        lines.push(`GESAMT NETTO: ${fmt2(total)} EUR`);
        lines.push(sep);
        lines.push('');
        lines.push('Mit freundlichen Gruessen');

        const subject = encodeURIComponent(`Kostenaufstellung: ${proj.name} - ${new Date().toLocaleDateString('de-DE')}`);
        const body = encodeURIComponent(lines.join('\n'));
        window.location.href = `mailto:${encodeURIComponent(invoiceRecipient)}?subject=${subject}&body=${body}`;
    };

    // --- SUB-COMPONENTS ---

    const ProjFormModal = () => {
        if (!isProjFormOpen) return null;
        const isEditing = !!editingProjectId;
        const emptyForm = () => {
            const nextColorId = PROJECT_COLORS[projects.length % PROJECT_COLORS.length].id;
            return { name: '', category: projCategories[0] || '', projectNumber: '', address: '', country: '', startWeek: weeks[0]?.id || '', ibnWeek: weeks[10]?.id || '', color: nextColorId, projType: '', size: '', sharepointLink: '', notes: '' };
        };
        const save = () => {
            if (!projForm.name.trim()) return;
            if (projForm.startWeek && projForm.ibnWeek && compareWeekIds(projForm.ibnWeek, projForm.startWeek) < 0) {
                alert('IBN-Woche darf nicht vor der Start-Woche liegen.');
                return;
            }
            if (projForm.sharepointLink && projForm.sharepointLink.trim()) {
                const link = projForm.sharepointLink.trim();
                if (!/^https?:\/\//i.test(link)) {
                    alert('SharePoint-Link muss mit https:// oder http:// beginnen.');
                    return;
                }
            }
            if (isEditing) {
                setProjects(projects.map(p => p.id === editingProjectId ? { ...p, ...projForm } : p));
                setEditingProjectId(null);
            } else {
                setProjects([...projects, { id: makeId('p'), ...projForm, billable: true, hourlyRate: DEFAULT_HOURLY_RATE }]);
            }
            setProjForm(emptyForm());
            setIsProjFormOpen(false);
        };
        const cancel = () => {
            setEditingProjectId(null);
            setProjForm(emptyForm());
            setIsProjFormOpen(false);
        };
        return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                    <ModalHeader title={isEditing ? 'Projekt bearbeiten' : 'Neues Projekt'} onClose={cancel}/>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">Name</label>
                                <input type="text" value={projForm.name} onChange={e => setProjForm({...projForm, name: e.target.value})} className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400 focus:border-gea-500" autoFocus/>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">Adresse</label>
                                <input type="text" value={projForm.address || ''} onChange={e => setProjForm({...projForm, address: e.target.value})} placeholder="Straße, PLZ Ort, Land" className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400 focus:border-gea-500"/>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">Land</label>
                                <div className="flex gap-2 items-stretch">
                                    <input
                                        type="text"
                                        value={projForm.country || ''}
                                        onChange={e => setProjForm({...projForm, country: e.target.value})}
                                        placeholder="z.B. DE oder Deutschland"
                                        className="flex-1 p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400 focus:border-gea-500"
                                    />
                                    {(() => {
                                        const code = resolveCountryCode(projForm.country);
                                        const styled = code === '??' ? 'bg-rose-50 border-rose-300 text-rose-700'
                                                     : code === '/'  ? 'bg-slate-50 border-slate-300 text-slate-400'
                                                     :                 'bg-emerald-50 border-emerald-300 text-emerald-700';
                                        return (
                                            <span className={`px-3 py-2 rounded text-sm font-mono font-bold border min-w-[3.5rem] text-center flex items-center justify-center ${styled}`} title="Auflösung des Eingabefelds">
                                                {code}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">Land oder ISO-Kürzel eingeben — wird auf einen 2-Buchstaben-Code aufgelöst. Erscheint in Übersicht und Projekte.</p>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">Projektnr.</label>
                                <input type="text" maxLength={15} value={projForm.projectNumber} onChange={e => setProjForm({...projForm, projectNumber: e.target.value})} placeholder="GEA-2024-00001" className="w-full p-2 border border-slate-400 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gea-400 focus:border-gea-500"/>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">Kategorie</label>
                                <select value={projForm.category} onChange={e => setProjForm({...projForm, category: e.target.value})} className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400">
                                    {projCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">Typ</label>
                                <select value={projForm.projType || ''} onChange={e => setProjForm({...projForm, projType: e.target.value})} className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400">
                                    <option value="">— kein Typ —</option>
                                    {projTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">Größe (Size)</label>
                                <input type="number" min="0" step="1" value={projForm.size || ''} onChange={e => setProjForm({...projForm, size: e.target.value})} placeholder="z.B. 5" className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400 focus:border-gea-500"/>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">Start (KW)</label>
                                <input type="week" value={projForm.startWeek} onChange={e => setProjForm({...projForm, startWeek: e.target.value})} className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400"/>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">IBN (KW)</label>
                                <input type="week" value={projForm.ibnWeek} onChange={e => setProjForm({...projForm, ibnWeek: e.target.value})} className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400"/>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">SharePoint / Projektlink</label>
                                <input type="url" value={projForm.sharepointLink || ''} onChange={e => setProjForm({...projForm, sharepointLink: e.target.value})} placeholder="https://..." className="w-full p-2 border border-slate-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gea-400 focus:border-gea-500"/>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs text-slate-700 mb-1 font-semibold">Notizen</label>
                                <textarea rows={3} value={projForm.notes || ''} onChange={e => setProjForm({...projForm, notes: e.target.value})} placeholder="Interne Hinweise, Besonderheiten …" className="w-full p-2 border border-slate-400 rounded text-sm resize-y focus:outline-none focus:ring-2 focus:ring-gea-400 focus:border-gea-500"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-700 mb-2 font-semibold">Farbe</label>
                            <div className="flex flex-wrap gap-2">
                                {PROJECT_COLORS.map(c => (
                                    <button key={c.id} onClick={() => setProjForm({...projForm, color: c.id})}
                                        title={c.id}
                                        className={`w-7 h-7 rounded-full border-2 transition-all ${c.dot} ${projForm.color === c.id ? 'border-slate-800 scale-110 shadow' : 'border-transparent hover:border-slate-400'}`}>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={cancel} className="flex-1 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">Abbruch</button>
                            <button onClick={save} className="flex-1 bg-gea-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gea-700 transition-colors">{isEditing ? 'Speichern' : 'Erstellen'}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const HelpModal = () => (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden" style={{maxHeight:'85vh',overflowY:'auto'}}>
                <ModalHeader title={t('help.title')} onClose={() => setIsHelpModalOpen(false)}/>
                <div className="p-6 space-y-6 text-sm">
                    <div>
                        <h3 className="font-semibold text-gea-800 mb-3 uppercase tracking-wide text-xs border-b border-gea-100 pb-2">{t('help.cellColors')}</h3>
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-3"><div className="w-10 h-6 rounded flex-shrink-0 bg-emerald-200 border border-emerald-300"></div><span className="text-slate-700">{t('help.free')}</span></div>
                            <div className="flex items-center gap-3"><div className="w-10 h-6 rounded flex-shrink-0 bg-amber-200 border border-amber-300"></div><span className="text-slate-700">{t('help.almostFull')}</span></div>
                            <div className="flex items-center gap-3"><div className="w-10 h-6 rounded flex-shrink-0 bg-rose-200 border border-rose-300"></div><span className="text-slate-700">{t('help.overloaded')}</span></div>
                            <div className="flex items-center gap-3"><div className="w-10 h-6 rounded flex-shrink-0 diagonal-stripes border border-slate-300"></div><span className="text-slate-700">{t('help.absence')}</span></div>
                            <div className="flex items-center gap-3"><div className="w-10 h-6 rounded flex-shrink-0 bg-blue-200 border border-blue-300 bg-hatched"></div><span className="text-slate-700">{t('help.tentative')}</span></div>
                            <div className="flex items-center gap-3"><div className="w-10 h-6 rounded flex-shrink-0 bg-gea-200 border border-gea-400"></div><span className="text-slate-700">{t('help.currentWeek')}</span></div>
                            <div className="flex items-center gap-3"><div className="w-10 h-6 rounded flex-shrink-0 bg-slate-300 border border-slate-400"></div><span className="text-slate-700">{t('help.pastWeek')}</span></div>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gea-800 mb-3 uppercase tracking-wide text-xs border-b border-gea-100 pb-2">{t('help.controls')}</h3>
                        <div className="space-y-2 text-slate-700">
                            <p>{t('help.clickCell')}</p>
                            <p>{t('help.dragDrop')}</p>
                            <p>{t('help.deleteMode')}</p>
                            <p>{t('help.compactView')}</p>
                            <p>{t('help.todayBtn')}</p>
                            <p>{t('help.heatmapClick')}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gea-800 mb-3 uppercase tracking-wide text-xs border-b border-gea-100 pb-2">{t('help.projStatus')}</h3>
                        <div className="space-y-2">
                            {PROJECT_STATUSES.map(s => (
                                <div key={s.value} className="flex items-start gap-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${s.color}`}>{t('status.' + s.value)}</span>
                                    <span className="text-slate-600 text-xs">{
                                        s.value === 'planned'         ? t('help.statusPlanned') :
                                        s.value === 'active'          ? t('help.statusActive') :
                                        s.value === 'missing_costs'   ? t('help.statusMissingCosts') :
                                        s.value === 'completed'       ? t('help.statusCompleted') :
                                                                         t('help.statusCostsSubmitted')
                                    }</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const InvoiceModal = () => {
        if (!isInvoiceModalOpen || !selectedProjectDetails) return null;

        const proj = projectById.get(selectedProjectDetails);
        if (!proj) return null;
        const { laborLines, costLines, total: currentTotal } = buildInvoiceData(proj, invoiceSelection);

        return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                    <ModalHeader title={t('invoice.title')} subtitle={`${t('overview.colProject')}: ${proj.name}`} onClose={() => setIsInvoiceModalOpen(false)} />

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {proj.billable !== false && (
                            <div>
                                <h4 className="text-slate-700 text-base mb-3 border-b border-slate-300 pb-2 font-medium">{t('invoice.laborSection')}</h4>
                                <div className="space-y-2">
                                    {laborLines.filter(l => l.hours > 0).map(({ empId, emp, hours, rate, cost }) => (
                                        <label key={empId} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                            <input type="checkbox" checked={!!invoiceSelection.emps[empId]}
                                                onChange={e => setInvoiceSelection({...invoiceSelection, emps: {...invoiceSelection.emps, [empId]: e.target.checked}})}
                                                className="w-5 h-5 text-gea-600 rounded"/>
                                            <div className="flex-1 text-sm text-slate-800 font-medium">{emp?.name || t('invoice.unknown')}</div>
                                            <div className="text-sm text-slate-500">{hours} Std. × {rate} €/h</div>
                                            <div className="text-sm text-slate-900 w-24 text-right font-medium">{cost.toFixed(2)} €</div>
                                        </label>
                                    ))}
                                    {laborLines.length === 0 && <p className="text-sm text-slate-400">{t('invoice.noLabor')}</p>}
                                </div>
                            </div>
                        )}

                        <div>
                            <h4 className="text-slate-700 text-base mb-3 border-b border-slate-300 pb-2 font-medium">{t('invoice.costSection')}</h4>
                            <div className="space-y-2">
                                {costLines.map(({ ci, emp }) => {
                                    return (
                                        <label key={ci.id} className="flex flex-col gap-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                            <div className="flex items-center gap-3">
                                                <input type="checkbox" checked={!!invoiceSelection.costs[ci.id]}
                                                    onChange={e => setInvoiceSelection({...invoiceSelection, costs: {...invoiceSelection.costs, [ci.id]: e.target.checked}})}
                                                    className="w-5 h-5 text-gea-600 rounded"/>
                                                <div className="flex-1 text-sm">
                                                    <span className="text-slate-800 font-medium">{ci.description || t('invoice.costDefault')}</span>
                                                    <span className="text-slate-400 ml-2">({emp?.name || t('invoice.unknown')})</span>
                                                </div>
                                                {ci.week && <div className="text-xs text-slate-400">{ci.week}</div>}
                                                <div className="text-sm text-slate-900 w-24 text-right font-medium">{(ci.amount || 0).toFixed(2)} €</div>
                                            </div>
                                            {(ci.lines || []).length > 0 && (
                                                <div className="pl-8 flex flex-col gap-1">
                                                    {(ci.lines || []).map(l => {
                                                        const cfg = COST_LINE_TYPES[l.type] || COST_LINE_TYPES.other;
                                                        return (
                                                            <div key={l.id} className="flex items-center gap-2 text-xs">
                                                                <span className={`px-2 py-0.5 rounded-full border font-medium shrink-0 ${cfg.chip}`}>{cfg.label}</span>
                                                                {l.type === 'hours' && <span className="text-slate-500 tabular-nums">{l.hours || 0}h × {l.hourlyRate || 0}€</span>}
                                                                {l.comment && <span className="text-slate-500 truncate">{l.comment}</span>}
                                                                <span className="text-slate-600 tabular-nums ml-auto">{(l.amount || 0).toFixed(2)} €</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </label>
                                    );
                                })}
                                {costLines.length === 0 && <p className="text-sm text-slate-400">{t('invoice.noCosts')}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                        <div>
                            <p className="text-sm text-slate-500">{t('invoice.totalNet')}</p>
                            <p className="text-xl text-gea-600 font-medium">{currentTotal.toFixed(2)} €</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsInvoiceModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 font-medium">{t('btn.cancel')}</button>
                            {invoiceRecipient && (
                                <button onClick={handleInvoiceSendEmail} className="px-4 py-2 text-sm text-white bg-gea-500 rounded-md hover:bg-gea-600 flex items-center gap-2 font-medium">
                                    ✉ {t('invoice.sendEmail')}
                                </button>
                            )}
                            <button onClick={handleInvoiceExport} className="px-4 py-2 text-sm text-white bg-gea-600 rounded-md hover:bg-gea-700 flex items-center gap-2 font-medium">
                                <IconFileText size={16}/> {t('invoice.csvExport')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- FILE SYSTEM SYNC HANDLERS ---

    const applyFsData = async (handle) => {
        try {
            const { state, timestamps } = await loadSplitStateFs(handle);
            if (state && (state.employees.length || state.assignments.length || state.projects.length)) {
                fsFileTimestampsRef.current = timestamps;
                applyRemoteSnapshot(state, { notify: false });
            }
        } catch(e) { console.warn('[FS] applyFsData failed', e); }
    };

    const handleSetupFolder = async () => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await idbSaveHandle(handle);
            dirHandleRef.current = handle;
            await applyFsData(handle);
            setFsStatus('connected');
            setSyncStatus('idle');
        } catch(e) { /* Nutzer hat abgebrochen */ }
    };

    const handleActivateSync = async () => {
        const handle = dirHandleRef.current;
        if (!handle) return;
        try {
            const result = await handle.requestPermission({ mode: 'readwrite' });
            if (result === 'granted') {
                await applyFsData(handle);
                setFsStatus('connected');
                setSyncStatus('idle');
            }
        } catch(e) {}
    };


    // ─── PROP BUNDLES for view components ────────────────────────────────────
    const s = {
        activeTab, employees, projects, assignments, expenses, costItems,
        empCategories, projCategories, projTypes, basicTasks, basicTasksMeta,
        inactiveBasicTasks, basicTasksSubTab, offtimeTasks, inactiveOfftimeTasks,
        inactiveSupportTasks, inactiveTrainingTasks, customTrainingTasks, isChangelogOpen,
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
        supportEmpsByCategory, supportEmpCategories, hasSupportEmployees,
        projectsByCategory, projCategoriesFromProjects, timelineWeeks,
        currentWeekColRef, resourceScrollRef, timelineScrollRef,
        compactView, scrollTarget,
        language, t,
        currentUser, appUsers, auditLog, isLoginModalOpen,
        autoBackup, lastBackupAt, emailTemplate,
    };
    const h = useMemo(() => ({
        setActiveTab, setEmployees, setProjects, setAssignments,
        setCostItems, setEmpCategories, setProjCategories, setProjTypes, setBasicTasks,
        setBasicTasksMeta, setInactiveBasicTasks, setBasicTasksSubTab,
        setOfftimeTasks, setInactiveOfftimeTasks, setInactiveSupportTasks,
        setInactiveTrainingTasks, setCustomTrainingTasks, setIsChangelogOpen, setSelectedProject,
        setCollapsedCategories, setCollapsedProjCategories, setCollapsedEmpSetup,
        setSelectedProjectDetails, setWeeksAhead, setIsAssignModalOpen,
        setAssignContext, setIsCostItemModalOpen, setEditingCostItem,
        setIsCopyModalOpen, setCopyContext, setIsDeleteMode, setPastProjectsExpanded,
        setIsInvoiceModalOpen, setInvoiceSelection, setInvoiceRecipient,
        setIsProjFormOpen, setIsHelpModalOpen, setTimelineYear, setEmpForm,
        setEditingEmpId, setIsEmpFormOpen, setProjForm, setEditingProjectId, setNewEmpCat,
        setNewProjCat, setNewBasicTask, setNewOfftimeTask, setExpandedSetupCats,
        setSyncStatus, setFsStatus,
        setCompactView, setScrollTarget,
        setLanguage,
        setAppUsers, setAuditLog, setIsLoginModalOpen,
        setAutoBackup, runBackup, setEmailTemplate,
        showToast, dismissToast, requestConfirm,
        loginUser, logoutUser,
        getEmpWeeklyHours, computeAutoStatus, getWeeksForYear, getUtilization,
        toggleCategory, toggleProjCategory, toggleEmpSetup,
        handleSaveAssignment, handleDeleteAssignment, handleDeleteAssignmentSeries,
        handleDrop, exportData, importData, buildInvoiceData, openInvoiceModal,
        scrollToCurrentWeek, scrollToWeekById, reconnectSharePoint,
        requestDeleteProject, requestDeleteEmployee,
    }), [
        // useState setters are stable – no deps needed for those.
        // Only useCallback refs with real deps need listing:
        loginUser, logoutUser,
        getEmpWeeklyHours, computeAutoStatus, getWeeksForYear, getUtilization,
        buildInvoiceData, openInvoiceModal, exportData, reconnectSharePoint,
        scrollToWeekById, handleSaveAssignment, handleDeleteAssignment,
        handleDeleteAssignmentSeries, handleDrop, runBackup,
        requestDeleteProject, requestDeleteEmployee,
    ]);

    return (
        <div className="flex h-screen w-full font-sans text-slate-800 bg-white overflow-hidden">

            <SidebarView s={s} h={h}/>
            
            {activeTab === 'resource' && <ResourceView s={s} h={h}/>}
            {activeTab === 'project' && <TimelineView s={s} h={h}/>}
            {activeTab === 'support'  && <SupportView s={s} h={h}/>}
            {activeTab === 'offtime'  && <OfftimeView s={s} h={h}/>}
            {activeTab === 'training' && <TrainingView s={s} h={h}/>}
            {activeTab === 'utilization' && currentUser && <UtilizationView s={s} h={h}/>}
            {activeTab === 'overview' && <OverviewView s={s} h={h}/>}
            {activeTab === 'setup_emp'   && currentUser && <SetupEmpView s={s} h={h}/>}
            {activeTab === 'setup_proj'  && currentUser && <SetupProjView s={s} h={h}/>}
            {activeTab === 'setup_cats'  && currentUser && <SetupCatsView s={s} h={h}/>}
            {activeTab === 'data'        && currentUser && <DataView s={s} h={h}/>}
            {activeTab === 'audit'       && currentUser && <AuditView s={s} h={h}/>}

            {isAssignModalOpen && assignContext && currentUser && (
                <AssignmentModal
                    assignContext={assignContext}
                    assignmentsRef={assignmentsRef}
                    showToast={showToast}
                    employeeById={employeeById}
                    basicTasks={basicTasks}
                    basicTasksMeta={basicTasksMeta}
                    offtimeTasks={offtimeTasks}
                    inactiveOfftimeTasks={inactiveOfftimeTasks}
                    inactiveSupportTasks={inactiveSupportTasks}
                    inactiveTrainingTasks={inactiveTrainingTasks}
                    customTrainingTasks={customTrainingTasks}
                    projects={projects}
                    computeAutoStatus={computeAutoStatus}
                    getUtilization={getUtilization}
                    getEmpWeeklyHours={getEmpWeeklyHours}
                    setBasicTasks={setBasicTasks}
                    setBasicTasksMeta={setBasicTasksMeta}
                    emailTemplate={emailTemplate}
                    onClose={() => setIsAssignModalOpen(false)}
                    onSave={handleSaveAssignment}
                    onDelete={handleDeleteAssignment}
                    onDeleteSeries={handleDeleteAssignmentSeries}
                    requestConfirm={requestConfirm}
                    t={t}
                />
            )}
            {isCopyModalOpen && copyContext && currentUser && (
                <CopyModal
                    copyContext={copyContext}
                    assignmentsRef={assignmentsRef}
                    showToast={showToast}
                    employees={employees}
                    activeEmps={activeEmployees}
                    empsByCategory={activeEmpsByCategory}
                    empCategories={activeEmpCategories}
                    weeks={weeks}
                    projectById={projectById}
                    assignments={assignments}
                    setAssignments={setAssignments}
                    onClose={() => { setIsCopyModalOpen(false); setCopyContext(null); }}
                    t={t}
                />
            )}
            {isInvoiceModalOpen && <InvoiceModal />}
            {isProjFormOpen && ProjFormModal()}

            {/* Changelog Modal */}
            {isChangelogOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden" style={{maxHeight:'85vh'}}>
                        <ModalHeader title="Changelog" onClose={() => setIsChangelogOpen(false)}/>
                        <div className="overflow-auto p-6" style={{maxHeight:'calc(85vh - 64px)'}}>
                            <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">{CHANGELOG_CONTENT}</pre>
                        </div>
                    </div>
                </div>
            )}

            {/* OneDrive-Sync Popup */}
            {FS_MODE && (fsStatus === 'needs-setup' || fsStatus === 'needs-permission') && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
                        <div className="w-12 h-12 bg-gea-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gea-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        {fsStatus === 'needs-setup' ? (<>
                            <h2 className="text-lg font-semibold text-slate-900 mb-2">{t('fs.setupTitle')}</h2>
                            <p className="text-sm text-slate-500 mb-6">{t('fs.setupMsg')}</p>
                            <button onClick={handleSetupFolder} className="w-full bg-gea-600 hover:bg-gea-700 text-white font-medium py-3 px-4 rounded-xl transition-colors mb-2">{t('fs.selectFolder')}</button>
                        </>) : (<>
                            <h2 className="text-lg font-semibold text-slate-900 mb-2">{t('fs.activateTitle')}</h2>
                            <p className="text-sm text-slate-500 mb-6">{t('fs.activateMsg')}</p>
                            <button onClick={handleActivateSync} className="w-full bg-gea-600 hover:bg-gea-700 text-white font-medium py-3 px-4 rounded-xl transition-colors mb-2">{t('fs.activate')}</button>
                        </>)}
                        <button onClick={() => setFsStatus('off')} className="w-full text-slate-400 hover:text-slate-600 text-sm py-2 transition-colors">{t('fs.noSync')}</button>
                    </div>
                </div>
            )}
            {isHelpModalOpen && HelpModal()}

            {/* Login Modal */}
            {isLoginModalOpen && (
                <LoginModal
                    appUsers={appUsers}
                    onLogin={loginUser}
                    onClose={() => setIsLoginModalOpen(false)}
                    t={t}
                />
            )}

            {/* Cascade-Delete Confirmation */}
            {cascadeConfirm && (
                <CascadeDeleteModal
                    entityKind={cascadeConfirm.entityKind}
                    entityName={cascadeConfirm.entityName}
                    dependents={cascadeConfirm.dependents}
                    employees={employees}
                    projects={projects}
                    onConfirm={confirmCascadeDelete}
                    onCancel={() => setCascadeConfirm(null)}
                    t={t}
                />
            )}

            {/* Generic Confirm Dialog (logout, app-user delete, series delete). */}
            {confirmDialog && (
                <ConfirmModal
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    confirmLabel={confirmDialog.confirmLabel}
                    cancelLabel={t('btn.cancel')}
                    danger={confirmDialog.danger}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}

            <ToastContainer toasts={toasts} onDismiss={dismissToast}/>
        </div>
    );
}

// Top-level error boundary. Without this, a single render-time exception in
// any view blanks the whole app to React's default empty screen with no way
// back. We catch here, log to the console for diagnosis, and offer a reload
// CTA — SharePoint data is unaffected because saves go through onClick / save
// effects, not render.
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error('[FATAL] React tree crashed:', error, info?.componentStack);
    }
    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white border border-red-300 rounded-xl shadow-lg p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-red-700">Application crashed / Anwendung ist abgestürzt</h2>
                    <p className="text-sm text-slate-700">
                        An internal error stopped the render. Data in SharePoint is not affected. Reload the page to try again.
                    </p>
                    <pre className="text-xs bg-slate-100 text-slate-600 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap break-words">
                        {String(this.state.error?.message || this.state.error)}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full bg-gea-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gea-700"
                    >
                        Reload page / Seite neu laden
                    </button>
                </div>
            </div>
        );
    }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><App /></ErrorBoundary>);
