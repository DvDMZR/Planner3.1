// ─── SHAREPOINT SYNC ──────────────────────────────────────────────────────────

// Auto-detect SharePoint Online context from the current URL
const SP_CONTEXT = (() => {
    const loc = window.location;
    if (loc.protocol === 'file:' || !loc.hostname.includes('sharepoint.com')) return null;
    const pathParts = decodeURIComponent(loc.pathname).split('/').filter(Boolean);
    let siteParts = [];
    if ((pathParts[0] === 'personal' || pathParts[0] === 'sites') && pathParts[1]) {
        siteParts = [pathParts[0], pathParts[1]];
    }
    const siteUrl = loc.origin + (siteParts.length ? '/' + siteParts.join('/') : '');
    const currentPath = decodeURIComponent(loc.pathname);
    const folderPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
    return { siteUrl, folderPath, stateFilePath: folderPath + '/planner-state.json' };
})();

// Validate that a SharePoint siteUrl belongs to a *.sharepoint.com host.
// Throws an Error if the URL is invalid or does not match the expected domain,
// preventing open-redirect / SSRF vectors when a siteUrl is passed as user
// input or restored from stored state. HTTPS is required because SharePoint
// REST API calls always use HTTPS; this is distinct from the sharepointLink
// project field which may be a general URL (validated separately in app.jsx).
const validateSharePointUrl = (url) => {
    let parsed;
    try { parsed = new URL(url); } catch (e) {
        throw new Error('Invalid SharePoint URL: ' + url);
    }
    if (!/^https:$/.test(parsed.protocol)) {
        throw new Error('SharePoint URL must use https: ' + url);
    }
    if (!/(?:^|\.)sharepoint\.com$/.test(parsed.hostname)) {
        throw new Error('SharePoint URL must be on *.sharepoint.com: ' + url);
    }
};

// Escape characters that SharePoint REST API path parameters cannot handle
// inside single-quoted URL strings. Single quotes are doubled; spaces, hashes,
// percent signs and plus signs are percent-encoded so filenames containing
// these characters are round-tripped correctly.
const SP_ENC = (path) => path
    .replace(/%/g, '%25')   // must be first to avoid double-encoding
    .replace(/'/g, "''")
    .replace(/ /g, '%20')
    .replace(/#/g, '%23')
    .replace(/\+/g, '%2B');

// Signals that SharePoint refused the request because the browser session /
// form digest has expired. Recovery layer catches this specifically.
class SpAuthError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'SpAuthError';
        this.status = status || 0;
    }
}

// Signals that a conditional write (If-Match) was rejected because the file
// was modified by another client since our last load.
class SpConflictError extends Error {
    constructor(filename) {
        super('Concurrent edit conflict: ' + filename);
        this.name = 'SpConflictError';
        this.filename = filename;
    }
}

// Cached form digest. SharePoint digests are usually valid for 1800 s; we
// refresh one minute before they expire to absorb clock skew.
// `inFlight` deduplicates concurrent refresh requests: when 4 parallel writes
// all find an expired cache simultaneously, only one POST /_api/contextinfo
// fires; the others await the same promise.
const spDigestCache = { value: null, expiresAt: 0, inFlight: null };

// Detect auth failures. We intentionally stay conservative here: SharePoint
// occasionally redirects valid REST responses (e.g. URL normalisation on
// personal sites), so reacting to `r.redirected` alone caused the recovery
// layer to kick in on successful loads and leave the app stuck in
// "reconnecting". Trust only explicit 401/403 and the opaqueredirect type
// (used when we manually opt out of following redirects).
function spIsAuthResponse(r) {
    if (r.status === 401 || r.status === 403) return true;
    if (r.type === 'opaqueredirect') return true;
    return false;
}

// Uniform fetch wrapper for all SharePoint REST calls: always includes
// credentials, converts auth failures into SpAuthError, and lets callers
// handle remaining HTTP errors as before.
// Hard timeout via AbortController: ein hängender Request (Standby,
// WLAN-Wechsel) darf Save-/Poll-Pfade nicht minutenlang festhalten – sonst
// bleibt syncStatus auf 'syncing' stehen und das Poll-Gate stoppt jede
// Aktualisierung. Der Abort wird von spFetchWithRetry wie ein Netzfehler
// behandelt (Retry, danach Fehler statt Hänger).
const SP_FETCH_TIMEOUT_MS = 30000;
async function spFetch(url, init) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SP_FETCH_TIMEOUT_MS);
    const opts = Object.assign({}, init, { credentials: 'include', signal: ctrl.signal });
    let r;
    try {
        r = await fetch(url, opts);
    } finally {
        clearTimeout(timer);
    }
    if (spIsAuthResponse(r)) {
        spDigestCache.expiresAt = 0;
        throw new SpAuthError('SharePoint auth required', r.status);
    }
    return r;
}

// Retry wrapper for transient SharePoint failures.
// Handles HTTP 429 (throttling) and 503 (transient unavailability) with
// exponential back-off, honouring the Retry-After header when present.
// Network-level errors (TypeError) are retried because they indicate the
// request never reached SharePoint, making a retry safe for all our calls
// (overwrite=true writes are idempotent; If-Match writes may get a 412 on
// the retry, which SpConflictError catches via the existing recovery flow).
// SpAuthError is never retried – it requires the dedicated re-auth flow.
async function spFetchWithRetry(url, init, { maxRetries = 3, baseDelayMs = 600 } = {}) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let r;
        try {
            r = await spFetch(url, init);
        } catch (e) {
            if (e instanceof SpAuthError) throw e;
            if (attempt === maxRetries) throw e;
            await new Promise(res => setTimeout(res, baseDelayMs * 2 ** attempt));
            continue;
        }
        if (r.status === 429 || r.status === 503) {
            if (attempt === maxRetries) throw new Error('SP throttled after retries: ' + r.status);
            const retryAfterSec = parseInt(r.headers.get('Retry-After') || '0', 10);
            const delay = retryAfterSec > 0 ? retryAfterSec * 1000 : baseDelayMs * 2 ** attempt;
            // After a potentially long wait the form digest may have expired.
            spDigestCache.expiresAt = 0;
            await new Promise(res => setTimeout(res, delay));
            continue;
        }
        return r;
    }
}

async function spGetDigest(siteUrl) {
    validateSharePointUrl(siteUrl);
    const now = Date.now();
    if (spDigestCache.value && now < spDigestCache.expiresAt - 60_000) {
        return spDigestCache.value;
    }
    // Deduplicate concurrent refresh requests. If a refresh is already in
    // flight, await it instead of firing a second POST /_api/contextinfo.
    if (spDigestCache.inFlight) return spDigestCache.inFlight;
    spDigestCache.inFlight = (async () => {
        const r = await spFetchWithRetry(`${siteUrl}/_api/contextinfo`, {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose' }
        });
        if (!r.ok) throw new Error('digest ' + r.status);
        const info = (await r.json()).d.GetContextWebInformation;
        spDigestCache.value = info.FormDigestValue;
        const timeoutSec = Number(info.FormDigestTimeoutSeconds) || 1800;
        spDigestCache.expiresAt = Date.now() + timeoutSec * 1000;
        return spDigestCache.value;
    })().finally(() => { spDigestCache.inFlight = null; });
    return spDigestCache.inFlight;
}

// Silent re-auth via a hidden iframe. If the user's Entra ID / AD session is
// still valid, navigating to a SharePoint endpoint refreshes the FedAuth /
// rtFa cookies without any visible UI. We can't read the iframe content
// cross-origin – we just wait for load or a timeout and then retry.
let spSilentAuthInFlight = null;
function spSilentReauth(ctx, timeoutMs = 8000) {
    if (spSilentAuthInFlight) return spSilentAuthInFlight;
    spSilentAuthInFlight = new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            try { iframe.remove(); } catch(e) {}
            resolve(ok);
        };
        let iframe;
        try {
            validateSharePointUrl(ctx.siteUrl);
            iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
            iframe.setAttribute('aria-hidden', 'true');
            iframe.addEventListener('load', () => finish(true));
            iframe.addEventListener('error', () => finish(false));
            setTimeout(() => finish(false), timeoutMs);
            // Hit a cheap authenticated endpoint; if cookies are stale, the
            // SP front-door runs the cookie refresh dance through Entra.
            iframe.src = `${ctx.siteUrl}/_api/contextinfo`;
            document.body.appendChild(iframe);
        } catch(e) {
            finish(false);
        }
    }).finally(() => { spSilentAuthInFlight = null; });
    return spSilentAuthInFlight;
}

// Interactive re-auth via popup. MUST be called from within a user gesture
// or the browser will block the popup.
let spInteractiveAuthInFlight = null;
function spInteractiveReauth(ctx) {
    if (spInteractiveAuthInFlight) return spInteractiveAuthInFlight;
    spInteractiveAuthInFlight = new Promise((resolve) => {
        let win;
        try {
            win = window.open(`${ctx.siteUrl}/_layouts/15/start.aspx`, 'sp-reauth',
                'width=520,height=640,menubar=no,toolbar=no,location=yes');
        } catch(e) { win = null; }
        if (!win) { resolve(false); return; }
        const pollTimer = setInterval(() => {
            if (win.closed) {
                clearInterval(pollTimer);
                clearTimeout(safety);
                resolve(true);
            }
        }, 400);
        const safety = setTimeout(() => {
            try { if (!win.closed) win.close(); } catch(e) {}
            clearInterval(pollTimer);
            resolve(true);
        }, 5 * 60 * 1000);
    }).finally(() => { spInteractiveAuthInFlight = null; });
    return spInteractiveAuthInFlight;
}

// Ensure there is a usable SharePoint session. Returns true once a fresh
// digest has been obtained, false when even interactive re-auth failed.
async function spEnsureSession(ctx, { interactive = false } = {}) {
    spDigestCache.expiresAt = 0;
    try { await spGetDigest(ctx.siteUrl); return true; }
    catch (e) { if (!(e instanceof SpAuthError)) throw e; }

    await spSilentReauth(ctx);
    spDigestCache.expiresAt = 0;
    try { await spGetDigest(ctx.siteUrl); return true; }
    catch (e) { if (!(e instanceof SpAuthError)) throw e; }

    if (!interactive) return false;

    await spInteractiveReauth(ctx);
    spDigestCache.expiresAt = 0;
    try { await spGetDigest(ctx.siteUrl); return true; }
    catch (e) { return false; }
}

async function spLoad(ctx) {
    const r = await spFetchWithRetry(`${ctx.siteUrl}/_api/web/GetFileByServerRelativeUrl('${SP_ENC(ctx.stateFilePath)}')/$value`, {
        headers: { 'Accept': 'text/plain' }
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('load ' + r.status);
    const text = await r.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error('spLoad: invalid JSON in planner-state.json – ' + e.message);
    }
}

// Ensure a subfolder exists under the planner folder. 400 = already present,
// which SharePoint returns on the second call – we swallow that. Auth errors
// still need to bubble up so the recovery layer can react.
async function spEnsureFolder(ctx, subPath) {
    try {
        const digest = await spGetDigest(ctx.siteUrl);
        await spFetchWithRetry(
            `${ctx.siteUrl}/_api/web/folders/add('${SP_ENC(ctx.folderPath + '/' + subPath)}')`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'X-RequestDigest': digest,
                    'Content-Type': 'application/json;odata=verbose'
                }
            }
        );
    } catch(e) {
        if (e instanceof SpAuthError) throw e;
        /* already exists or transient – ignore */
    }
}

async function spLoadFile(ctx, filename) {
    const path = ctx.folderPath + '/' + PLANNER_DATA_DIR + '/' + filename;
    const r = await spFetchWithRetry(
        `${ctx.siteUrl}/_api/web/GetFileByServerRelativeUrl('${SP_ENC(path)}')/$value`,
        { headers: { 'Accept': 'text/plain' } }
    );
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('spLoadFile ' + filename + ' ' + r.status);
    const text = await r.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error('spLoadFile: invalid JSON in ' + filename + ' – ' + e.message);
    }
}

// When `ifMatchEtag` is provided the file must not have changed since that
// ETag was issued – if it has, SharePoint returns 412 and we throw
// SpConflictError so the caller can reload the remote state and present
// a notification to the user.  Without an ETag the call falls back to the
// original overwrite=true behaviour (used on first save after load).
async function spSaveFile(ctx, filename, data, ifMatchEtag = null) {
    const digest = await spGetDigest(ctx.siteUrl);
    const folder = ctx.folderPath + '/' + PLANNER_DATA_DIR;
    const body = typeof data === 'string' ? data : JSON.stringify(data);

    if (ifMatchEtag) {
        // Conditional PUT on the file's $value endpoint – supports If-Match.
        const path = folder + '/' + filename;
        const r = await spFetchWithRetry(
            `${ctx.siteUrl}/_api/web/GetFileByServerRelativeUrl('${SP_ENC(path)}')/$value`,
            {
                method: 'PUT',
                headers: {
                    'X-RequestDigest': digest,
                    'Content-Type': 'application/octet-stream',
                    'If-Match': ifMatchEtag,
                },
                body,
            }
        );
        if (r.status === 412) throw new SpConflictError(filename);
        if (!r.ok) throw new Error('spSaveFile ' + filename + ' ' + r.status);
    } else {
        const r = await spFetchWithRetry(
            `${ctx.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${SP_ENC(folder)}')/Files/Add(url='${SP_ENC(filename)}',overwrite=true)`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'X-RequestDigest': digest,
                    'Content-Type': 'application/octet-stream',
                },
                body,
            }
        );
        if (!r.ok) throw new Error('spSaveFile ' + filename + ' ' + r.status);
    }
}

// List files in the planner-data/backups subfolder. Used to determine when
// the last auto-backup ran — keeps that timestamp OUT of settings.json so
// backup writes don't conflict with concurrent settings edits.
async function spListBackups(ctx) {
    const folder = ctx.folderPath + '/' + PLANNER_DATA_DIR + '/backups';
    try {
        const r = await spFetchWithRetry(
            `${ctx.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${SP_ENC(folder)}')/Files?$select=Name,TimeLastModified`,
            { headers: { 'Accept': 'application/json;odata=verbose' } }
        );
        if (r.status === 404) return [];
        if (!r.ok) return [];
        const json = await r.json();
        return (json.d?.results || []).map(f => ({ name: f.Name, ts: f.TimeLastModified }));
    } catch(e) {
        if (e instanceof SpAuthError) throw e;
        return [];
    }
}

// Save a file into the planner-data/backups subfolder. Creates the subfolder
// on demand. Backups are write-only from the app's perspective – the polling
// code ignores files outside the top-level folder list.
async function spSaveBackup(ctx, filename, data) {
    const digest = await spGetDigest(ctx.siteUrl);
    const folder = ctx.folderPath + '/' + PLANNER_DATA_DIR + '/backups';
    // Best-effort folder creation (ignore "already exists" errors).
    try {
        await spFetchWithRetry(
            `${ctx.siteUrl}/_api/web/folders/add('${SP_ENC(folder)}')`,
            { method: 'POST', headers: {
                'Accept': 'application/json;odata=verbose',
                'X-RequestDigest': digest,
                'Content-Type': 'application/json;odata=verbose'
            } }
        );
    } catch(e) { if (e instanceof SpAuthError) throw e; }

    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const r = await spFetchWithRetry(
        `${ctx.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${SP_ENC(folder)}')/Files/Add(url='${SP_ENC(filename)}',overwrite=true)`,
        {
            method: 'POST',
            headers: {
                'Accept': 'application/json;odata=verbose',
                'X-RequestDigest': digest,
                'Content-Type': 'application/octet-stream',
            },
            body,
        }
    );
    if (!r.ok) throw new Error('spSaveBackup ' + filename + ' ' + r.status);
}

// Delete a single backup file. Caller is responsible for choosing which file
// to delete (e.g. trimming the oldest entries from spListBackups).
async function spDeleteBackup(ctx, filename) {
    const digest = await spGetDigest(ctx.siteUrl);
    const path = ctx.folderPath + '/' + PLANNER_DATA_DIR + '/backups/' + filename;
    const r = await spFetchWithRetry(
        `${ctx.siteUrl}/_api/web/GetFileByServerRelativeUrl('${SP_ENC(path)}')`,
        { method: 'POST', headers: {
            'X-RequestDigest': digest,
            'X-HTTP-Method': 'DELETE',
            'IF-MATCH': '*',
        } }
    );
    if (!r.ok && r.status !== 404) throw new Error('spDeleteBackup ' + filename + ' ' + r.status);
}

// Fetch metadata (timestamp + ETag) for all files in the planner-data folder
// in a SINGLE request.  Returns { [filename]: { ts, etag } }.
// ETags are used for optimistic concurrency (If-Match on conditional writes).
async function spGetFolderMeta(ctx) {
    const folder = ctx.folderPath + '/' + PLANNER_DATA_DIR;
    const r = await spFetchWithRetry(
        `${ctx.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${SP_ENC(folder)}')/Files?$select=Name,TimeLastModified,ETag`,
        { headers: { 'Accept': 'application/json;odata=verbose' } }
    );
    if (r.status === 404) return {};
    if (!r.ok) throw new Error('spGetFolderMeta ' + r.status);
    const json = await r.json();
    const map = {};
    (json.d?.results || []).forEach(f => { map[f.Name] = { ts: f.TimeLastModified, etag: f.ETag || null }; });
    return map;
}

// Thin wrapper kept for any call-sites that only need timestamps.
async function spGetFolderTimestamps(ctx) {
    const meta = await spGetFolderMeta(ctx);
    const map = {};
    Object.entries(meta).forEach(([f, v]) => { map[f] = v.ts; });
    return map;
}
// ─────────────────────────────────────────────────────────────────────────────
