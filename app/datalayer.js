// ─── TEAM-SPLIT MIGRATION / LOAD / SAVE ───────────────────────────────────────

// Migrate legacy `expenses` entries to the new `costItems` shape.
const migrateExpensesToCostItems = (expenses) =>
    (expenses || []).map(e => ({
        id: e.id,
        projectId: e.projectId,
        empId: e.empId,
        type: (e.type === 'Travelcosts' || e.type === 'Hotel') ? 'Reisekosten'
              : (e.type === 'Other' ? 'Sonstiges' : 'Reisekosten'),
        description: e.type === 'Hotel' ? 'Hotel' : (e.type === 'Travelcosts' ? 'Reise' : e.type),
        week: null, hours: null, hourlyRate: null,
        amount: e.amount,
        travelAmount: e.type === 'Travelcosts' ? e.amount : null,
        hotelAmount: e.type === 'Hotel' ? e.amount : null,
    }));

// Migrate a costItem from the legacy single-amount/extras shape to the
// line-items shape used by the redesigned modal.
const migrateCostItem = (ci) => {
    if (!ci) return ci;
    // Already in line-items shape: leave untouched. Without this guard, a
    // second migration pass would re-emit lines from the legacy fields that
    // are no longer present, but ANY object that already has a `lines` array
    // is by definition post-migration.
    if (Array.isArray(ci.lines)) return ci;

    const oldTypeMap = {
        'Reisekosten':    'travel',
        'Dienstleistung': 'hours',
        'Sonstiges':      'other',
    };
    const lines = [];

    if (ci.hours != null && ci.hourlyRate != null) {
        const hrs = ci.hours || 0;
        const rate = ci.hourlyRate || 0;
        lines.push({
            id: makeId('cl'), type: 'hours',
            hours: hrs, hourlyRate: rate, amount: hrs * rate,
            comment: ''
        });
    }
    const mainAmount = ci.mainAmount != null ? ci.mainAmount
                     : (ci.hours == null && ci.amount != null ? ci.amount : 0);
    if (mainAmount && (ci.hours == null || ci.hourlyRate == null)) {
        lines.push({
            id: makeId('cl'),
            type: oldTypeMap[ci.type] || 'other',
            amount: mainAmount,
            comment: ''
        });
    }
    (ci.extraCosts || []).forEach(ec => {
        lines.push({
            id: ec.id || makeId('cl'),
            type: 'other',
            amount: parseFloat(ec.amount) || 0,
            comment: ec.type || ''
        });
    });

    const total = lines.reduce((s, l) => s + (l.amount || 0), 0);
    const { type, hours, hourlyRate, mainAmount: _ma, extraCosts,
            travelAmount, hotelAmount, ...rest } = ci;
    return { ...rest, lines, amount: total };
};

const migrateCostItems = (items) => (items || []).map(migrateCostItem);

// Split a monolithic state into the new file layout.
// Returns an object { filename: content } ready to be persisted.
function buildSplitFiles(state) {
    const employees       = state.employees       || [];
    const projects        = state.projects        || [];
    const assignments     = state.assignments     || [];
    const costItems       = state.costItems && state.costItems.length
        ? state.costItems
        : migrateExpensesToCostItems(state.expenses);
    const empCategories         = state.empCategories         || DEFAULT_TEAMS;
    const projCategories        = state.projCategories        || [];
    const projTypes             = state.projTypes             || [];
    const basicTasks            = state.basicTasks            || [];
    const basicTasksMeta        = state.basicTasksMeta        || {};
    const inactiveBasicTasks    = state.inactiveBasicTasks    || [];
    const offtimeTasks          = state.offtimeTasks          || [];
    const inactiveOfftimeTasks  = state.inactiveOfftimeTasks  || [];
    const inactiveSupportTasks  = state.inactiveSupportTasks  || [];
    const inactiveTrainingTasks = state.inactiveTrainingTasks || [];
    const customTrainingTasks   = state.customTrainingTasks   || [];
    const invoiceRecipient      = state.invoiceRecipient      || '';
    // Persist all users (admin included, with hashed PIN). Skip placeholders
    // that signal "admin needs re-seeding" – the next save cycle will replace
    // them with a hashed entry.
    const appUsers              = (state.appUsers || []).filter(u => !u._needsSeed);
    const auditLog              = state.auditLog              || [];

    const teams = [...new Set([...DEFAULT_TEAMS, ...empCategories])];
    const assGroups = groupByTeam(assignments, employees, teams);
    const ciGroups  = groupByTeam(costItems,   employees, teams);

    // Split global files by access pattern so that high-frequency writes
    // (audit log, inactive-toggle) don't force unrelated config files to be
    // re-written. categories.json is now further split into three files:
    //   - category-defs.json: empCategories, projCategories (rarely edited)
    //   - tasks.json:         task definitions (basic/other/offtime/training)
    //   - inactive.json:      all inactive-* lists (most-edited)
    const autoBackup = state.autoBackup || {};
    const emailTemplate = state.emailTemplate || null;
    const empAliases = state.empAliases || {};
    const fxRates = state.fxRates || null;
    const expenseCategories = state.expenseCategories || null;
    const teamKst = state.teamKst || {};
    const accountingRecipient = state.accountingRecipient || '';
    const files = {
        'employees.json':     { employees },
        'projects.json':      { projects },
        'settings.json':      { invoiceRecipient, autoBackup, emailTemplate, empAliases, fxRates, accountingRecipient },
        'category-defs.json': { empCategories, projCategories, projTypes, expenseCategories, teamKst },
        'tasks.json':         { basicTasks, basicTasksMeta, offtimeTasks, customTrainingTasks },
        'inactive.json':      { inactiveBasicTasks, inactiveOfftimeTasks,
                                inactiveSupportTasks, inactiveTrainingTasks },
        'users.json':         { appUsers },
        'audit.json':         { auditLog },
    };
    for (const team of teams) {
        files[teamAssignmentsFile(team)] = { assignments: assGroups[team] || [] };
        files[teamCostItemsFile(team)]   = { costItems:   ciGroups[team]  || [] };
    }
    return files;
}

// Merge split files back into a flat state object.
// `settings` is the slim settings.json (invoiceRecipient + autoBackup + emailTemplate).
// `categoryDefs`, `tasks`, `inactive` are the three new category sub-files;
// `categories` is the legacy single categories.json (still read as fallback);
// `users`/`audit` are sibling files. Fallback cascade for each field:
//   newest file → legacy categories.json → legacy monolithic settings.json
function mergeSplitFiles({ employees, projects, settings,
                          categoryDefs, tasks, inactive,
                          categories, users, audit,
                          assignmentsByTeam, costItemsByTeam }) {
    const allAssignments = [];
    const allCostItems = [];
    Object.values(assignmentsByTeam || {}).forEach(arr => { if (arr) allAssignments.push(...arr); });
    Object.values(costItemsByTeam   || {}).forEach(arr => { if (arr) allCostItems.push(...arr); });
    // Field-level fallback so a partial migration (some new files exist, some
    // not yet) still produces a complete state.
    const pick = (key, ...sources) => {
        for (const s of sources) {
            if (s && s[key] !== undefined) return s[key];
        }
        return undefined;
    };
    const cat = categories || settings || {};
    const usr = users      || settings || {};
    const aud = audit      || settings || {};
    return {
        employees:        employees || [],
        projects:         projects  || [],
        assignments:      allAssignments,
        costItems:        allCostItems,
        expenses:         [],
        empCategories:      pick('empCategories',  categoryDefs, cat) || DEFAULT_TEAMS,
        projCategories:     pick('projCategories', categoryDefs, cat) || [],
        projTypes:          pick('projTypes',      categoryDefs, cat) || [],
        expenseCategories:  pick('expenseCategories', categoryDefs, cat) || null,
        teamKst:            pick('teamKst',           categoryDefs, cat) || {},
        basicTasks:         pick('basicTasks',         tasks, cat) || [],
        basicTasksMeta:     pick('basicTasksMeta',     tasks, cat) || {},
        offtimeTasks:       pick('offtimeTasks',       tasks, cat) || [],
        customTrainingTasks:pick('customTrainingTasks',tasks, cat) || [],
        inactiveBasicTasks:    pick('inactiveBasicTasks',    inactive, cat) || [],
        inactiveOfftimeTasks:  pick('inactiveOfftimeTasks',  inactive, cat) || [],
        inactiveSupportTasks:  pick('inactiveSupportTasks',  inactive, cat) || [],
        inactiveTrainingTasks: pick('inactiveTrainingTasks', inactive, cat) || [],
        invoiceRecipient:     settings?.invoiceRecipient     || '',
        autoBackup:           settings?.autoBackup           || null,
        emailTemplate:        settings?.emailTemplate        || null,
        empAliases:           settings?.empAliases           || {},
        fxRates:              settings?.fxRates              || null,
        accountingRecipient:  settings?.accountingRecipient  || '',
        appUsers:             usr.appUsers             || [],
        auditLog:             aud.auditLog             || []
    };
}

// Migrate the old monolithic planner-state.json on SharePoint to split files.
// Idempotent: skips if meta.json already shows schemaVersion >= 3.
async function migrateSpToTeamSplit(ctx) {
    const meta = await spLoadFile(ctx, 'meta.json').catch(() => null);
    if (meta?.schemaVersion >= SCHEMA_VERSION) return;
    await spEnsureFolder(ctx, PLANNER_DATA_DIR);
    // If split files already exist, this install is already on >=v3; the
    // categories/users/audit split (v4) is handled lazily by buildSplitFiles
    // on the next save. Do NOT re-import the legacy monolith – it would
    // overwrite live split data with stale backup contents.
    const existingSettings = await spLoadFile(ctx, 'settings.json').catch(() => null);
    if (existingSettings) {
        await spSaveFile(ctx, 'meta.json', { schemaVersion: SCHEMA_VERSION, migratedAt: new Date().toISOString() });
        return;
    }
    const old = await spLoad(ctx).catch(() => null);
    if (!old) {
        await spSaveFile(ctx, 'meta.json', { schemaVersion: SCHEMA_VERSION, migratedAt: new Date().toISOString() });
        return;
    }
    const files = buildSplitFiles(old);
    for (const [filename, payload] of Object.entries(files)) {
        await spSaveFile(ctx, filename, payload);
    }
    await spSaveFile(ctx, 'meta.json', { schemaVersion: SCHEMA_VERSION, migratedAt: new Date().toISOString() });
    // planner-state.json is left in place as a backup.
}

// FS equivalent of the SharePoint migration.
async function migrateFsToTeamSplit(dirHandle) {
    const metaResult = await fsLoadFile(dirHandle, 'meta.json').catch(() => null);
    if (metaResult?.data?.schemaVersion >= SCHEMA_VERSION) return;
    // Same logic as the SP migration: if split files already exist, just
    // bump the schema marker. The categories/users/audit split is created
    // lazily on the next save.
    const existingSettings = await fsLoadFile(dirHandle, 'settings.json').catch(() => null);
    if (existingSettings) {
        await fsSaveFile(dirHandle, 'meta.json', { schemaVersion: SCHEMA_VERSION, migratedAt: new Date().toISOString() });
        return;
    }
    const oldResult = await fsLoad(dirHandle).catch(() => null);
    const old = oldResult?.data;
    if (!old) {
        await fsSaveFile(dirHandle, 'meta.json', { schemaVersion: SCHEMA_VERSION, migratedAt: new Date().toISOString() });
        return;
    }
    const files = buildSplitFiles(old);
    for (const [filename, payload] of Object.entries(files)) {
        await fsSaveFile(dirHandle, filename, payload);
    }
    await fsSaveFile(dirHandle, 'meta.json', { schemaVersion: SCHEMA_VERSION, migratedAt: new Date().toISOString() });
}

// Load all split files from SharePoint in parallel and merge into a flat
// parsedData-shaped object. Also returns the folder timestamps for polling.
async function loadSplitStateSp(ctx) {
    // Load meta.json once up-front – it is reused for the migration guard AND
    // for the schema-version check at the end, avoiding a redundant round-trip.
    const preloadedMeta = await spLoadFile(ctx, 'meta.json').catch(() => null);
    if (!(preloadedMeta?.schemaVersion >= SCHEMA_VERSION)) {
        await migrateSpToTeamSplit(ctx);
    }
    // Load all global files in parallel. categoryDefs/tasks/inactive replace
    // categories.json; we still read the legacy categories.json as a fallback
    // for installs that haven't migrated yet.
    const [settingsData, categoryDefsData, tasksData, inactiveData,
           categoriesData, usersData, auditData] = await Promise.all([
        spLoadFile(ctx, 'settings.json').catch(() => null),
        spLoadFile(ctx, 'category-defs.json').catch(() => null),
        spLoadFile(ctx, 'tasks.json').catch(() => null),
        spLoadFile(ctx, 'inactive.json').catch(() => null),
        spLoadFile(ctx, 'categories.json').catch(() => null),
        spLoadFile(ctx, 'users.json').catch(() => null),
        spLoadFile(ctx, 'audit.json').catch(() => null),
        // meta.json already loaded above – no second fetch needed
    ]);
    const teams = (categoryDefsData?.empCategories)
               || (categoriesData?.empCategories)
               || (settingsData?.empCategories)
               || DEFAULT_TEAMS;

    const [empFile, projFile, ...teamFiles] = await Promise.all([
        spLoadFile(ctx, 'employees.json').catch(() => null),
        spLoadFile(ctx, 'projects.json').catch(() => null),
        ...teams.flatMap(t => [
            spLoadFile(ctx, teamAssignmentsFile(t)).catch(() => null),
            spLoadFile(ctx, teamCostItemsFile(t)).catch(() => null)
        ])
    ]);

    const assignmentsByTeam = {};
    const costItemsByTeam = {};
    teams.forEach((t, i) => {
        assignmentsByTeam[t] = teamFiles[i * 2]?.assignments || [];
        costItemsByTeam[t]   = teamFiles[i * 2 + 1]?.costItems || [];
    });
    const state = mergeSplitFiles({
        employees:    empFile?.employees,
        projects:     projFile?.projects,
        settings:     settingsData      || {},
        categoryDefs: categoryDefsData  || null,
        tasks:        tasksData         || null,
        inactive:     inactiveData      || null,
        categories:   categoriesData    || null,
        users:        usersData         || null,
        audit:        auditData         || null,
        assignmentsByTeam,
        costItemsByTeam
    });
    const fileMeta = await spGetFolderMeta(ctx).catch(() => ({}));
    const timestamps = {};
    const etags = {};
    Object.entries(fileMeta).forEach(([f, v]) => { timestamps[f] = v.ts; etags[f] = v.etag; });
    const loadedSchemaVersion = Number.isFinite(preloadedMeta?.schemaVersion) ? preloadedMeta.schemaVersion : null;
    return { state, timestamps, etags, loadedSchemaVersion };
}

async function loadSplitStateFs(dirHandle) {
    await migrateFsToTeamSplit(dirHandle);
    const [settingsResult, categoryDefsResult, tasksResult, inactiveResult,
           categoriesResult, usersResult, auditResult, metaResult] = await Promise.all([
        fsLoadFile(dirHandle, 'settings.json').catch(() => null),
        fsLoadFile(dirHandle, 'category-defs.json').catch(() => null),
        fsLoadFile(dirHandle, 'tasks.json').catch(() => null),
        fsLoadFile(dirHandle, 'inactive.json').catch(() => null),
        fsLoadFile(dirHandle, 'categories.json').catch(() => null),
        fsLoadFile(dirHandle, 'users.json').catch(() => null),
        fsLoadFile(dirHandle, 'audit.json').catch(() => null),
        fsLoadFile(dirHandle, 'meta.json').catch(() => null),
    ]);
    const settings     = settingsResult?.data     || {};
    const categoryDefs = categoryDefsResult?.data || null;
    const tasks        = tasksResult?.data        || null;
    const inactive     = inactiveResult?.data     || null;
    const categories   = categoriesResult?.data   || null;
    const users        = usersResult?.data        || null;
    const audit        = auditResult?.data        || null;
    const teams = (categoryDefs?.empCategories)
               || (categories?.empCategories)
               || settings.empCategories
               || DEFAULT_TEAMS;

    const [empResult, projResult, ...teamResults] = await Promise.all([
        fsLoadFile(dirHandle, 'employees.json').catch(() => null),
        fsLoadFile(dirHandle, 'projects.json').catch(() => null),
        ...teams.flatMap(t => [
            fsLoadFile(dirHandle, teamAssignmentsFile(t)).catch(() => null),
            fsLoadFile(dirHandle, teamCostItemsFile(t)).catch(() => null)
        ])
    ]);

    const assignmentsByTeam = {};
    const costItemsByTeam = {};
    teams.forEach((t, i) => {
        assignmentsByTeam[t] = teamResults[i * 2]?.data?.assignments || [];
        costItemsByTeam[t]   = teamResults[i * 2 + 1]?.data?.costItems || [];
    });
    const state = mergeSplitFiles({
        employees: empResult?.data?.employees,
        projects:  projResult?.data?.projects,
        settings, categoryDefs, tasks, inactive, categories, users, audit,
        assignmentsByTeam,
        costItemsByTeam
    });
    const timestamps = await fsGetFolderTimestamps(dirHandle).catch(() => ({}));
    const loadedSchemaVersion = Number.isFinite(metaResult?.data?.schemaVersion) ? metaResult.data.schemaVersion : null;
    return { state, timestamps, loadedSchemaVersion };
}

// Save split files, writing ONLY those whose serialised payload differs from
// the entry in `lastSaved`. `lastSaved` is mutated to reflect the new state.
// `writeFile(filename, payload)` is the actual write callback (SP or FS).
// meta.json is always written LAST as an atomic commit marker so that polling
// clients can wait for meta.json before reacting to mid-write states.

// Bounded-concurrency runner. Executes `tasks` (zero-argument async functions)
// with at most `limit` running simultaneously. SharePoint Online throttles
// aggressive parallel callers; 4 is a safe ceiling that stays well below the
// per-user request limit while still delivering meaningful parallelism.
async function pLimit(tasks, limit = 4) {
    const queue = tasks.slice();
    const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
        while (queue.length) await queue.shift()();
    });
    await Promise.all(workers);
}

async function saveSplitState(state, lastSaved, writeFile) {
    const files = buildSplitFiles(state);

    // Include any "historical" team files we may have written previously so
    // that removing a team from empCategories still produces an (empty)
    // write – otherwise stale data would linger in its file.
    Object.keys(lastSaved).forEach(fn => {
        if (!(fn in files) && (fn.startsWith('assignments-') || fn.startsWith('cost-items-'))) {
            files[fn] = fn.startsWith('assignments-') ? { assignments: [] } : { costItems: [] };
        }
    });

    // Sanity guards: skip writes that would wipe critical data. A previous
    // non-empty payload becoming empty is almost always a transient state-load
    // race, not a deliberate "delete everything". Protects against the
    // "settings.json plötzlich leer" failure mode.
    // A field "shrinks to empty" when it was a non-empty array/map before and
    // the new payload makes it empty/missing. We treat every wipe as a likely
    // transient state-load race and skip the write – the next save with real
    // data goes through. Add new fields here as new files appear.
    const GUARDED = {
        'users.json':         ['appUsers'],
        'employees.json':     ['employees'],
        'projects.json':      ['projects'],
        'category-defs.json': ['empCategories', 'projCategories'],
        'tasks.json':         ['basicTasks', 'basicTasksMeta', 'offtimeTasks', 'customTrainingTasks'],
        'inactive.json':      ['inactiveBasicTasks', 'inactiveOfftimeTasks',
                               'inactiveSupportTasks', 'inactiveTrainingTasks'],
        // Audit log is append-only; a shrink to empty indicates corruption.
        'audit.json':         ['auditLog'],
        // legacy categories.json still possible during migration window
        'categories.json':    ['empCategories', 'basicTasks', 'offtimeTasks'],
    };
    const sizeOf = (v) => Array.isArray(v) ? v.length
                       : (v && typeof v === 'object') ? Object.keys(v).length
                       : 0;
    // Team-Dateien tragen genau ein Array; ein Schrumpfen auf leer ist – wie
    // bei den GUARDED-Dateien – fast immer eine State-Load-Race (z. B. ein
    // fehlgeschlagener Team-Datei-Read, der als [] durchgereicht wurde) und
    // kein bewusstes "alles löschen". Preis der Absicherung: Das Löschen des
    // ALLERLETZTEN Eintrags eines Teams wird nicht in die Datei geschrieben
    // (Warnung im Log); beim nächsten Eintrag heilt sich der Stand.
    const teamFileKey = (filename) =>
        filename.startsWith('assignments-') ? 'assignments'
        : filename.startsWith('cost-items-') ? 'costItems'
        : null;
    const wouldWipe = (filename, payload) => {
        const prev = lastSaved[filename];
        if (!prev) return false; // never saved before – fine
        const keys = GUARDED[filename] || (teamFileKey(filename) ? [teamFileKey(filename)] : null);
        if (!keys) return false;
        try {
            const prevObj = JSON.parse(prev);
            return keys.some(k => sizeOf(prevObj[k]) > 0 && sizeOf(payload[k]) === 0);
        } catch(e) { return false; }
    };

    // Collect tasks for all changed files. meta.json is always written last
    // as the commit marker, so it is excluded from parallel dispatch.
    const writeTasks = [];
    for (const [filename, payload] of Object.entries(files)) {
        const serialised = JSON.stringify(payload);
        if (lastSaved[filename] === serialised) continue;
        if (wouldWipe(filename, payload)) {
            console.warn(`[saveSplitState] aborted potentially destructive write to ${filename} (would wipe data)`);
            continue;
        }
        // Capture loop variables in a stable closure.
        const fn = filename;
        const ser = serialised;
        writeTasks.push(async () => {
            await writeFile(fn, ser);
            lastSaved[fn] = ser;
        });
    }

    // Write all changed data files in parallel (max 4 concurrent) to reduce
    // round-trip latency on SharePoint. meta.json follows only after all data
    // files have been committed successfully so polling clients never observe
    // a partially-written state.
    if (writeTasks.length > 0) {
        await pLimit(writeTasks, 4);
        await writeFile('meta.json', JSON.stringify({ schemaVersion: SCHEMA_VERSION, lastSaveAt: new Date().toISOString() }));
    }
    // Anzahl tatsächlich geschriebener Dateien (ohne meta.json). Callern
    // erlaubt das, Folgearbeit (ETag-/Timestamp-Refresh) bei No-Op-Saves
    // komplett zu überspringen.
    return writeTasks.length;
}

// Load only specific team assignment/cost-item files from SharePoint.
// Used by the polling loop when global files (employees, projects, settings)
// are unchanged – avoids reloading all teams when only one changed.
// WICHTIG: Ein fehlgeschlagener Lesevorgang darf NICHT als "Datei ist leer"
// interpretiert werden – sonst ersetzt der Poll-Merge die Team-Daten lokal
// durch [] und der nächste Diff-Save überschreibt die Remote-Datei mit dem
// Rumpf-Zustand (realer Datenverlust-Vorfall: alle Reisekosten eines Teams
// verschwunden). Fehlgeschlagene Dateien werden deshalb separat gemeldet und
// vom Aufrufer übersprungen; der nächste Poll versucht es erneut.
async function loadChangedTeamFilesSp(ctx, changedFiles) {
    const results = await Promise.all(
        changedFiles.map(f => spLoadFile(ctx, f).then(d => [f, d, true]).catch(() => [f, null, false]))
    );
    const assignmentsByTeam = {};
    const costItemsByTeam = {};
    const failedFiles = [];
    results.forEach(([f, data, ok]) => {
        if (!ok) {
            // changedFiles stammen aus dem Ordner-Meta – die Datei existiert,
            // der Fehler ist transient (Throttling/Netz). Nicht anfassen.
            failedFiles.push(f);
            return;
        }
        if (f.startsWith('assignments-')) {
            const team = f.slice('assignments-'.length, -'.json'.length);
            assignmentsByTeam[team] = data?.assignments || [];
        } else if (f.startsWith('cost-items-')) {
            const team = f.slice('cost-items-'.length, -'.json'.length);
            costItemsByTeam[team] = data?.costItems || [];
        }
    });
    return { assignmentsByTeam, costItemsByTeam, failedFiles };
}

// Pre-populate `lastSaved` from a state object so the next save round
// doesn't re-write files that are already in sync.
function seedLastSaved(state, lastSaved) {
    const files = buildSplitFiles(state);
    for (const [filename, payload] of Object.entries(files)) {
        lastSaved[filename] = JSON.stringify(payload);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
