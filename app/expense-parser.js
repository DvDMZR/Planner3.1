// ─── EXPENSE-IMPORT: PARSER & KATEGORISIERUNG ─────────────────────────────────
// Parst rohen Text aus der ERP-Kostenabrechnung (Copy & Paste), kategorisiert
// die Einzelposten auf die 4 Hauptkategorien und rechnet Beträge nach EUR um.
// Reine Logik ohne DOM/React – wird von tests/expense-parser.test.js abgedeckt.
// Benötigt getWeekString aus utils.js (Ladereihenfolge: utils vor diesem Modul).

// Spesen-Kategorien: konfigurierbar unter Verwaltung → Kategorien.
// Jede Kategorie hat:
//   id       – stabiler Schlüssel (bei Custom-Kategorien 'exp-…')
//   label    – Anzeigename, frei umbenennbar (auch bei den eingebauten)
//   lineType – Export-Kostenart (COST_LINE_TYPES-Schlüssel), bestimmt wie
//              Posten im Kostenpunkt/CSV/E-Mail einsortiert werden
//   keywords – Schlagwörter, case-insensitiv als Substring gematcht
//              ("Mautgebühren" matcht "maut")
//   builtin  – eingebaute Kategorien sind nicht löschbar; 'other' ist der
//              Fallback ohne Keywords und steht immer am Ende
// Die Reihenfolge ist die Match-Priorität: die spezifischere
// "Tagespauschale (Unterkunft)" (→ Unterkunft) steht deshalb vor der
// generischen "Tagespauschale" (→ Verpflegung).
const DEFAULT_EXPENSE_CATEGORIES = [
    { id: 'accommodation', label: 'Unterkunft',  lineType: 'accommodation', builtin: true,
      keywords: ['tagespauschale (unterkunft)', 'hotel', 'übernachtung', 'uebernachtung'] },
    { id: 'meals',         label: 'Verpflegung', lineType: 'meals', builtin: true,
      keywords: ['frühstück', 'fruehstueck', 'abendessen', 'mittagessen', 'tagespauschale', 'verpflegung'] },
    { id: 'travel',        label: 'Reisekosten', lineType: 'travel', builtin: true,
      keywords: ['flug', 'auto', 'benzin', 'zug', 'bahn', 'parkplatz', 'parken', 'maut', 'mietwagen', 'taxi', 'kraftstoff', 'tanken'] },
    { id: 'other',         label: 'Sonstiges',   lineType: 'other', builtin: true, keywords: [] },
];

// Persistierte Konfiguration (aus category-defs.json) gegen die Defaults
// normalisieren: fehlende eingebaute Kategorien ergänzen, kaputte Einträge
// verwerfen, lineType/builtin der Built-ins fixieren, Fallback 'other' ans
// Ende. Liefert bei null/ungültig die Defaults (Kopie).
const normalizeExpenseCategories = (raw) => {
    const defaults = DEFAULT_EXPENSE_CATEGORIES.map(c => ({ ...c, keywords: [...c.keywords] }));
    if (!Array.isArray(raw) || raw.length === 0) return defaults;
    const byId = new Map(defaults.map(c => [c.id, c]));
    const out = [];
    const seen = new Set();
    for (const entry of raw) {
        if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || seen.has(entry.id)) continue;
        const base = byId.get(entry.id);
        const keywords = (Array.isArray(entry.keywords) ? entry.keywords : [])
            .filter(k => typeof k === 'string' && k.trim())
            .map(k => k.trim());
        if (base) {
            // Built-in: Label + Keywords übernehmbar, Rest fixiert
            out.push({ ...base,
                label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : base.label,
                keywords: entry.keywords !== undefined ? keywords : [...base.keywords] });
        } else {
            const lineType = COST_LINE_TYPES[entry.lineType] && entry.lineType !== 'hours' ? entry.lineType : 'other';
            const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : entry.id;
            out.push({ id: entry.id, label, lineType, keywords, builtin: false });
        }
        seen.add(entry.id);
    }
    // Fehlende Built-ins ergänzen (z. B. nach Update auf neue App-Version)
    for (const d of defaults) { if (!seen.has(d.id)) out.push(d); }
    // Fallback 'other' immer ans Ende (matcht sonst per Keyword nichts weg)
    out.sort((a, b) => (a.id === 'other') - (b.id === 'other'));
    return out;
};

const categorizeExpenseType = (typeStr, categories) => {
    const s = String(typeStr || '').toLowerCase();
    const cats = normalizeExpenseCategories(categories);
    for (const cat of cats) {
        if (cat.id === 'other') continue;
        if (cat.keywords.some(k => s.includes(k.toLowerCase()))) return cat.id;
    }
    return 'other'; // Fallback: Sonstiges
};

// Deutsche Betragsschreibweise → Number. "1.234,56" → 1234.56, "136,62" → 136.62
const parseGermanAmount = (str) => {
    if (typeof str !== 'string') return NaN;
    const cleaned = str.trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : NaN;
};

// "136,62 PLN" → { amount: 136.62, currency: 'PLN' }
// "276,00€" / "276,00 €" → { amount: 276, currency: 'EUR' }
// Euro-Abrechnungen aus dem ERP nutzen das €-Symbol OHNE Leerzeichen statt
// eines ISO-Codes – beide Schreibweisen müssen matchen.
const CURRENCY_SYMBOLS = { '€': 'EUR', '$': 'USD', '£': 'GBP', 'zł': 'PLN', 'CHF': 'CHF' };
const AMOUNT_RE = /^(-?[\d.]+,\d{2}|-?\d+(?:\.\d{2})?)\s*([A-Z]{3}|€|\$|£|zł)$/;
const parseAmountWithCurrency = (str) => {
    const m = AMOUNT_RE.exec(String(str || '').trim());
    if (!m) return null;
    const amount = parseGermanAmount(m[1]);
    if (!Number.isFinite(amount)) return null;
    return { amount, currency: CURRENCY_SYMBOLS[m[2]] || m[2] };
};

// Währungsname aus dem Kopf ("Polen, Zloty") → ISO-Code. Der verlässlichere
// Weg ist der Code an den Einzelbeträgen ("… PLN"); dieser Lookup dient als
// Fallback, wenn keine Posten vorhanden sind.
const CURRENCY_NAME_LOOKUP = {
    'zloty': 'PLN', 'złoty': 'PLN',
    'euro': 'EUR',
    'franken': 'CHF', 'franc': 'CHF',
    'krone': 'DKK', 'kronen': 'DKK',
    'dollar': 'USD',
    'pfund': 'GBP', 'pound': 'GBP',
    'forint': 'HUF',
    'koruna': 'CZK', 'krona': 'SEK',
    'leu': 'RON', 'lei': 'RON',
};
const resolveCurrencyName = (str) => {
    const s = String(str || '').toLowerCase();
    const iso = /\b([A-Z]{3})\b/.exec(String(str || ''));
    if (iso && iso[1] !== 'ERP') return iso[1];
    for (const [name, code] of Object.entries(CURRENCY_NAME_LOOKUP)) {
        if (s.includes(name)) return code;
    }
    return null;
};

// Default-Umrechnungskurse → EUR (1 Einheit Fremdwährung = X EUR). Bewusst
// statisch: Die App läuft ohne Backend im SharePoint-/Offline-Kontext, ein
// Live-Kurs-API-Call wäre unzuverlässig. Die Kurse sind im Import-Dialog
// editierbar; der zuletzt verwendete Kurs wird pro Währung in den
// Einstellungen (fxRates) persistiert und beim nächsten Import vorbelegt.
const DEFAULT_FX_RATES = {
    EUR: 1,
    PLN: 0.23,
    CHF: 1.06,
    USD: 0.92,
    GBP: 1.17,
    DKK: 0.134,
    SEK: 0.088,
    NOK: 0.087,
    CZK: 0.040,
    HUF: 0.0025,
    RON: 0.20,
};

const convertToEur = (amount, currency, fxRates) => {
    if (!Number.isFinite(amount)) return NaN;
    const cur = currency || 'EUR';
    const rate = (fxRates && Number.isFinite(fxRates[cur])) ? fxRates[cur]
               : DEFAULT_FX_RATES[cur];
    if (!Number.isFinite(rate)) return NaN; // unbekannte Währung → Kurs muss manuell gesetzt werden
    return Math.round(amount * rate * 100) / 100;
};

// "30.10.2025" → { iso: '2025-10-30', week: '2025-W44', date: Date }
const EXPENSE_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const parseExpenseDate = (str) => {
    const m = EXPENSE_DATE_RE.exec(String(str || '').trim());
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    const date = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    if (date.getDate() !== parseInt(dd)) return null; // 31.02. etc.
    return {
        iso: `${yyyy}-${mm}-${dd}`,
        week: getWeekString(date),
        date,
    };
};

// Kopfzeilen-Labels → Feldnamen. Struktur im ERP-Export: "Label :" auf einer
// Zeile, Wert auf der nächsten nicht-leeren Zeile.
const EXPENSE_HEADER_LABELS = {
    'abrechnungsname': 'reportName',
    'abrechnungs-id': 'reportId',
    'abrechnungsschlüssel': 'reportKey',
    'mitarbeitername': 'employeeName',
    'mitarbeiter-id': 'employeeId',
    'genehmigungsstatus': 'approvalStatus',
    'zahlungsstatus': 'paymentStatus',
    'währung': 'currencyName',
    'erp system': 'erpSystem',
    'gea firmen nummer': 'company',
    'kostenart': 'costType',
    'kostenart nummer': 'costTypeNumber',
    'geschäftszweck': 'businessPurpose',
};

// Spaltenüberschriften der Postenliste – werden beim Parsen übersprungen.
const EXPENSE_COLUMN_HEADERS = new Set([
    'transaktionsdatum', 'ausgabentyp', 'geschäftszweck', 'lieferant',
    'ort', 'zahlungsart', 'betrag',
]);

// Haupt-Parser. Liefert { ok, header, items, warnings } bzw.
// { ok: false, error } wenn die Struktur nicht erkannt wird.
//
// Posten-Erkennung: Eine Zeile im Format DD.MM.YYYY startet einen Posten,
// der nächste Datums-Token (oder das Textende) beendet ihn. Innerhalb eines
// Postens ist die Zuordnung anker-basiert statt positional, weil Felder
// fehlen können (z. B. Tagespauschale ohne Lieferant):
//   erster Token  = Ausgabentyp
//   letzter Token = Betrag (Format "136,62 PLN")
//   davor         = Zahlungsart, davor = Ort
//   zweiter Token = Geschäftszweck (falls noch Tokens übrig)
//   Rest          = Lieferant (optional)
const parseExpenseReport = (rawText, expenseCategories) => {
    const allLines = String(rawText || '').split(/\r?\n/).map(l => l.trim());
    const lines = allLines.filter(l => l.length > 0);
    if (lines.length === 0) return { ok: false, error: 'empty' };

    const warnings = [];
    const header = {};

    // Abschnittsgrenzen finden
    const itemsStart = lines.findIndex(l => l.toLowerCase().startsWith('ausgaben, für die belege'));
    const headerEnd = itemsStart === -1 ? lines.length : itemsStart;

    // ── Kopf: "Label :" / Wert-Paare ────────────────────────────────────────
    for (let i = 0; i < headerEnd; i++) {
        const line = lines[i];
        if (!line.endsWith(':')) continue;
        const label = line.slice(0, -1).trim().toLowerCase();
        const field = EXPENSE_HEADER_LABELS[label];
        if (!field) continue;
        const value = lines[i + 1];
        // Wert fehlt oder ist selbst das nächste Label → leer lassen
        if (value === undefined || value.endsWith(':')) continue;
        header[field] = value;
        i++;
    }

    if (!header.employeeName && !header.reportName) {
        return { ok: false, error: 'noHeader' };
    }

    header.currency = resolveCurrencyName(header.currencyName) || null;

    // ── Einzelposten ────────────────────────────────────────────────────────
    const items = [];
    if (itemsStart !== -1) {
        const tokens = lines.slice(itemsStart + 1)
            .filter(l => !EXPENSE_COLUMN_HEADERS.has(l.toLowerCase()));
        // Zeilen zu Posten gruppieren: Ein Datums-Token startet einen Posten,
        // der Betrags-Token beendet ihn (der Betrag ist immer das letzte Feld
        // einer Zeile). Dadurch verschmutzt Text NACH dem letzten Posten
        // (Trennlinien, Legenden, Fußzeilen) die letzte Zeile nicht.
        const rows = [];
        let current = null;
        for (const tok of tokens) {
            if (EXPENSE_DATE_RE.test(tok)) {
                if (current) rows.push(current); // unvollständige Zeile (ohne Betrag) trotzdem melden
                current = [tok];
            } else if (current) {
                current.push(tok);
                if (AMOUNT_RE.test(tok)) {
                    rows.push(current);
                    current = null;
                }
            }
            // Tokens vor dem ersten Datum / nach einem Betrag werden ignoriert
        }
        if (current) rows.push(current);

        rows.forEach((row, idx) => {
            const dateInfo = parseExpenseDate(row[0]);
            const amountInfo = parseAmountWithCurrency(row[row.length - 1]);
            if (!dateInfo || !amountInfo || row.length < 3) {
                warnings.push({ type: 'unparsedRow', row: row.join(' | '), index: idx });
                return;
            }
            const mids = row.slice(1, -1);
            const type = mids.shift() || '';
            const paymentMethod = mids.length > 0 ? mids.pop() : '';
            const location = mids.length > 0 ? mids.pop() : '';
            const purpose = mids.length > 0 ? mids.shift() : '';
            const vendor = mids.join(' '); // Rest (kann leer sein, z. B. Tagespauschale)
            items.push({
                id: makeId('exp'),
                date: dateInfo.iso,
                week: dateInfo.week,
                type,
                category: categorizeExpenseType(type, expenseCategories),
                purpose,
                vendor,
                location,
                paymentMethod,
                amount: amountInfo.amount,
                currency: amountInfo.currency,
            });
        });
    }
    if (itemsStart === -1) warnings.push({ type: 'noItemsSection' });

    // Währung des Kopfes ggf. aus den Posten ableiten (verlässlicher)
    if (items.length > 0) {
        const itemCurrencies = [...new Set(items.map(i => i.currency))];
        if (itemCurrencies.length === 1) header.currency = itemCurrencies[0];
        else if (itemCurrencies.length > 1) warnings.push({ type: 'mixedCurrencies', currencies: itemCurrencies });
    }

    return { ok: true, header, items, warnings };
};

// ─── MITARBEITER-MATCHING & ALIAS-SYSTEM ─────────────────────────────────────
// Namen normalisieren: Kleinschreibung, Diakritika entfernen ("Mechliński" →
// "mechlinski"), Mehrfach-Leerzeichen kollabieren. So matcht der ERP-Name
// auch bei abweichender Akzent-/Groß-Schreibweise.
const normalizeEmpName = (name) => String(name || '')
    .toLowerCase()
    .normalize('NFD')
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();

// Match-Reihenfolge: 1. gespeichertes Alias, 2. exakter (normalisierter)
// Name, 3. Name in umgekehrter Reihenfolge ("Nachname Vorname").
// empAliases: { [normalisierterAliasName]: empId } – wird in settings.json
// persistiert und beim nächsten Import automatisch angewendet.
const findEmployeeForExpense = (parsedName, employees, empAliases) => {
    const norm = normalizeEmpName(parsedName);
    if (!norm) return null;
    const aliasId = (empAliases || {})[norm];
    if (aliasId) {
        const emp = (employees || []).find(e => e.id === aliasId);
        if (emp) return emp;
    }
    const byName = (employees || []).find(e => normalizeEmpName(e.name) === norm);
    if (byName) return byName;
    const reversed = norm.split(' ').reverse().join(' ');
    return (employees || []).find(e => normalizeEmpName(e.name) === reversed) || null;
};

// Vorschlag für die manuelle Zuordnung, wenn kein exakter Match existiert:
// Teilt der ERP-Name genau EINEN Namensbestandteil (>2 Zeichen, z. B. den
// Nachnamen) mit genau EINEM Mitarbeiter, wird dieser vorgeschlagen – im UI
// vorausgewählt, aber weiterhin vom Nutzer zu bestätigen.
const suggestEmployeeForExpense = (parsedName, employees) => {
    const tokens = normalizeEmpName(parsedName).split(' ').filter(tk => tk.length > 2);
    if (tokens.length === 0) return null;
    const matches = (employees || []).filter(e => {
        const empTokens = new Set(normalizeEmpName(e.name).split(' '));
        return tokens.some(tk => empTokens.has(tk));
    });
    return matches.length === 1 ? matches[0] : null;
};
// ─────────────────────────────────────────────────────────────────────────────
