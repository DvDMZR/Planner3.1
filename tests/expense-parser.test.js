'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// expense-parser.js zusätzlich zu den Standard-Modulen laden
const APP_DIR = path.join(__dirname, '..', 'app');
const read = (f) => fs.readFileSync(path.join(APP_DIR, f), 'utf8');
const EXPORTS = [
    'parseExpenseReport', 'categorizeExpenseType', 'parseGermanAmount',
    'parseAmountWithCurrency', 'parseExpenseDate', 'resolveCurrencyName',
    'convertToEur', 'DEFAULT_FX_RATES', 'normalizeEmpName',
    'findEmployeeForExpense', 'suggestEmployeeForExpense',
    'normalizeExpenseCategories', 'DEFAULT_EXPENSE_CATEGORIES',
];
const source = [read('config.js'), read('utils.js'), read('expense-parser.js')].join('\n;\n');
// eslint-disable-next-line no-new-func
const app = new Function(`${source}\n;return { ${EXPORTS.join(', ')} };`)();

// Exaktes Beispiel aus der Anforderung (inkl. der Leer-/Whitespace-Zeilen
// zwischen den Feldern der Postenliste).
const SAMPLE = `Kostenabrechnung
Abrechnungsname :
JM/43_44/2025_FR_DE
Abrechnungs-ID :
1F7BEC1319A747F1A951
Abrechnungsschlüssel :
943829
Mitarbeitername :
Jakub Mechliński
Mitarbeiter-ID :
23685
Genehmigungsstatus :
Genehmigt
Zahlungsstatus :
Zur Zahlung übermittelt
Währung :
Polen, Zloty
ERP System :
Produktivmandant PL1/
GEA Firmen Nummer :
GEA FT Sp. z o.o.
Kostenart :
Cost Center
Kostenart Nummer :
Jakub Mechliński
Geschäftszweck :
AFS Haut Cornet (FR) SteadyBite1 / TSS Workshop
Contains Cash Advance? :
Nein
Mitarbeiterausgaben
Betrag fällig an Unternehmenskarte von Mitarbeiter :
0,00 PLN

Ausgaben, für die Belege erforderlich sind
Transaktionsdatum

Ausgabentyp

Geschäftszweck

Lieferant

Ort

Zahlungsart

Betrag

30.10.2025

Benzin

AFS Haut Cornet (FR) SteadyBite1 / TSS Workshop

Orlen S.A.

Gdynia

Bar

136,62 PLN

29.10.2025

Hotel

AFS Haut Cornet (FR) SteadyBite1 / TSS Workshop

Selbachpark

Hamm

Bar

762,21 PLN

29.10.2025

Tagespauschale

AFS Haut Cornet (FR) SteadyBite1 / TSS Workshop


Szczecin

Bar

11,25 PLN`;

test('parseExpenseReport: Kopfdaten des Beispiels vollständig', () => {
    const r = app.parseExpenseReport(SAMPLE);
    assert.equal(r.ok, true);
    assert.equal(r.header.reportName, 'JM/43_44/2025_FR_DE');
    assert.equal(r.header.reportId, '1F7BEC1319A747F1A951');
    assert.equal(r.header.reportKey, '943829');
    assert.equal(r.header.employeeName, 'Jakub Mechliński');
    assert.equal(r.header.employeeId, '23685');
    assert.equal(r.header.approvalStatus, 'Genehmigt');
    assert.equal(r.header.paymentStatus, 'Zur Zahlung übermittelt');
    assert.equal(r.header.businessPurpose, 'AFS Haut Cornet (FR) SteadyBite1 / TSS Workshop');
    assert.equal(r.header.currency, 'PLN');
});

test('parseExpenseReport: alle 3 Einzelposten des Beispiels korrekt', () => {
    const r = app.parseExpenseReport(SAMPLE);
    assert.equal(r.items.length, 3);

    const [benzin, hotel, pauschale] = r.items;
    assert.equal(benzin.date, '2025-10-30');
    assert.equal(benzin.week, '2025-W44');
    assert.equal(benzin.type, 'Benzin');
    assert.equal(benzin.category, 'travel');
    assert.equal(benzin.vendor, 'Orlen S.A.');
    assert.equal(benzin.location, 'Gdynia');
    assert.equal(benzin.paymentMethod, 'Bar');
    assert.equal(benzin.amount, 136.62);
    assert.equal(benzin.currency, 'PLN');

    assert.equal(hotel.date, '2025-10-29');
    assert.equal(hotel.week, '2025-W44');
    assert.equal(hotel.category, 'accommodation');
    assert.equal(hotel.vendor, 'Selbachpark');
    assert.equal(hotel.amount, 762.21);

    // Tagespauschale hat KEINEN Lieferanten – anker-basierte Zuordnung
    // darf die Felder nicht verschieben.
    assert.equal(pauschale.type, 'Tagespauschale');
    assert.equal(pauschale.category, 'meals');
    assert.equal(pauschale.vendor, '');
    assert.equal(pauschale.location, 'Szczecin');
    assert.equal(pauschale.paymentMethod, 'Bar');
    assert.equal(pauschale.amount, 11.25);
    assert.equal(r.warnings.length, 0);
});

// Zweites Real-Beispiel: Euro-Abrechnung. Beträge mit €-Symbol OHNE
// Leerzeichen ("276,00€") statt ISO-Code, plus Text-Block nach dem letzten
// Posten (Trennlinie + Legende), der die letzte Zeile nicht verschmutzen darf.
const SAMPLE_EUR = `Kostenabrechnung
Abrechnungsname :
Bauknecht
Abrechnungs-ID :
6BCEC54609754B89B519
Abrechnungsschlüssel :
908101
Mitarbeitername :
Salih Cetinkilic
Mitarbeiter-ID :
115881
Genehmigungsstatus :
Genehmigt
Zahlungsstatus :
Zur Zahlung übermittelt
Währung :
Euro
ERP System :
Produktivmandant PL1/
GEA Firmen Nummer :
GEA FT Admin
Kostenart :
Cost Center
Kostenart Nummer :
AFS enhanced
Geschäftszweck :
Steady Bite Welle 1
Contains Cash Advance? :
Nein
Mitarbeiterausgaben
Betrag fällig an Unternehmenskarte von Mitarbeiter :
0,00€

Ausgaben, für die Belege erforderlich sind
Transaktionsdatum

Ausgabentyp

Geschäftszweck

Lieferant

Ort

Zahlungsart

Betrag

04.10.2025

Hotel

Steady Bite Welle 1

HOTEL HIRT

Deisslingen

Bar

276,00€

01.10.2025

Hotel

Steady Bite Welle 1

SONNENHOF SONNHALDE

Ühlingen-Birkendorf

Bar

258,00€

04.10.2025

Tagespauschale

Steady Bite Welle 1


Deisslingen

Bar

8,40€

_________
Datum
Kostenart
Name (Unnötige Info)
Ort (Unnötige Info)
Zahlungsart (unnötige Info)
Summe`;

test('parseExpenseReport: Euro-Abrechnung mit €-Symbol und Fußzeilen-Block', () => {
    const r = app.parseExpenseReport(SAMPLE_EUR);
    assert.equal(r.ok, true);
    assert.equal(r.header.employeeName, 'Salih Cetinkilic');
    assert.equal(r.header.currency, 'EUR');
    assert.equal(r.items.length, 3);

    const [hotel1, hotel2, pauschale] = r.items;
    assert.equal(hotel1.date, '2025-10-04');
    assert.equal(hotel1.type, 'Hotel');
    assert.equal(hotel1.category, 'accommodation');
    assert.equal(hotel1.vendor, 'HOTEL HIRT');
    assert.equal(hotel1.location, 'Deisslingen');
    assert.equal(hotel1.amount, 276);
    assert.equal(hotel1.currency, 'EUR');

    assert.equal(hotel2.vendor, 'SONNENHOF SONNHALDE');
    assert.equal(hotel2.location, 'Ühlingen-Birkendorf');
    assert.equal(hotel2.amount, 258);

    // Letzter Posten: kein Lieferant UND Fußzeilen-Block danach –
    // die Legende (Datum/Kostenart/…/Summe) darf nicht in die Felder rutschen.
    assert.equal(pauschale.type, 'Tagespauschale');
    assert.equal(pauschale.category, 'meals');
    assert.equal(pauschale.vendor, '');
    assert.equal(pauschale.location, 'Deisslingen');
    assert.equal(pauschale.paymentMethod, 'Bar');
    assert.equal(pauschale.amount, 8.4);
    assert.equal(r.warnings.length, 0);
});

test('parseAmountWithCurrency: Symbol-Schreibweisen', () => {
    assert.deepEqual(app.parseAmountWithCurrency('276,00€'), { amount: 276, currency: 'EUR' });
    assert.deepEqual(app.parseAmountWithCurrency('276,00 €'), { amount: 276, currency: 'EUR' });
    assert.deepEqual(app.parseAmountWithCurrency('1.234,56€'), { amount: 1234.56, currency: 'EUR' });
    assert.deepEqual(app.parseAmountWithCurrency('12,50 zł'), { amount: 12.5, currency: 'PLN' });
});

test('parseExpenseReport: unbrauchbarer Text wird abgelehnt', () => {
    assert.equal(app.parseExpenseReport('').ok, false);
    assert.equal(app.parseExpenseReport('Hallo Welt\nnur Text').ok, false);
});

test('categorizeExpenseType: Keyword-Mapping auf die 4 Hauptkategorien', () => {
    for (const t of ['Flug', 'Auto', 'Benzin', 'Zug', 'Parkplatz', 'Mautgebühren', 'Mietwagen', 'Taxi']) {
        assert.equal(app.categorizeExpenseType(t), 'travel', t);
    }
    for (const t of ['Hotel', 'Übernachtung', 'Tagespauschale (Unterkunft)']) {
        assert.equal(app.categorizeExpenseType(t), 'accommodation', t);
    }
    for (const t of ['Frühstück', 'Abendessen', 'Mittagessen', 'Tagespauschale']) {
        assert.equal(app.categorizeExpenseType(t), 'meals', t);
    }
    for (const t of ['Werkzeug', 'Porto', '', null]) {
        assert.equal(app.categorizeExpenseType(t), 'other', String(t));
    }
});

test('parseGermanAmount / parseAmountWithCurrency', () => {
    assert.equal(app.parseGermanAmount('1.234,56'), 1234.56);
    assert.equal(app.parseGermanAmount('0,00'), 0);
    assert.ok(Number.isNaN(app.parseGermanAmount('abc')));
    assert.deepEqual(app.parseAmountWithCurrency('136,62 PLN'), { amount: 136.62, currency: 'PLN' });
    assert.equal(app.parseAmountWithCurrency('136,62'), null);
    assert.equal(app.parseAmountWithCurrency('Bar'), null);
});

test('parseExpenseDate: gültig, ungültig, KW-Ableitung', () => {
    const d = app.parseExpenseDate('30.10.2025');
    assert.equal(d.iso, '2025-10-30');
    assert.equal(d.week, '2025-W44');
    assert.equal(app.parseExpenseDate('31.02.2025'), null);
    assert.equal(app.parseExpenseDate('2025-10-30'), null);
});

test('resolveCurrencyName / convertToEur', () => {
    assert.equal(app.resolveCurrencyName('Polen, Zloty'), 'PLN');
    assert.equal(app.resolveCurrencyName('Euro'), 'EUR');
    assert.equal(app.resolveCurrencyName('Unbekanntia'), null);
    assert.equal(app.convertToEur(100, 'PLN', { PLN: 0.25 }), 25);
    assert.equal(app.convertToEur(100, 'EUR', null), 100);
    assert.equal(app.convertToEur(100, 'PLN', null), 100 * app.DEFAULT_FX_RATES.PLN);
    assert.ok(Number.isNaN(app.convertToEur(100, 'XXX', null)));
});

test('normalizeEmpName: Diakritika, Casing, Whitespace', () => {
    assert.equal(app.normalizeEmpName('Jakub Mechliński'), 'jakub mechlinski');
    assert.equal(app.normalizeEmpName('  MÜLLER,  Hans '), 'muller, hans');
    assert.equal(app.normalizeEmpName('Großer'), 'grosser');
});

test('normalizeExpenseCategories: Defaults, Overrides, Customs, Fallback-Position', () => {
    // null → Defaults (4 Built-ins, 'other' zuletzt)
    const defs = app.normalizeExpenseCategories(null);
    assert.equal(defs.length, 4);
    assert.equal(defs[defs.length - 1].id, 'other');

    const custom = app.normalizeExpenseCategories([
        { id: 'travel', label: 'Fahrtkosten', keywords: ['shuttle'] },       // Built-in umbenannt + eigene Keywords
        { id: 'exp-1', label: 'Schulung', lineType: 'other', keywords: ['seminar'] }, // Custom
        { id: 'exp-2', label: 'Kaputt', lineType: 'hours', keywords: [] },   // ungültiger lineType → other
        { id: 'other', label: 'Rest' },
        'müll', { keywords: [] },                                            // kaputte Einträge → verworfen
    ]);
    const travel = custom.find(c => c.id === 'travel');
    assert.equal(travel.label, 'Fahrtkosten');
    assert.deepEqual(travel.keywords, ['shuttle']);
    assert.equal(travel.lineType, 'travel'); // Built-in-Bucket nicht überschreibbar
    assert.equal(custom.find(c => c.id === 'exp-1').lineType, 'other');
    assert.equal(custom.find(c => c.id === 'exp-2').lineType, 'other');
    assert.equal(custom.find(c => c.id === 'other').label, 'Rest');
    // Fehlende Built-ins (accommodation, meals) wurden ergänzt
    assert.ok(custom.some(c => c.id === 'accommodation'));
    assert.ok(custom.some(c => c.id === 'meals'));
    // Fallback bleibt am Ende
    assert.equal(custom[custom.length - 1].id, 'other');
});

test('categorizeExpenseType: konfigurierte Keywords und Custom-Kategorien greifen', () => {
    const config = [
        { id: 'travel', label: 'Fahrtkosten', keywords: ['shuttle'] },
        { id: 'exp-1', label: 'Schulung', lineType: 'other', keywords: ['seminar', 'training'] },
    ];
    assert.equal(app.categorizeExpenseType('Shuttle Flughafen', config), 'travel');
    assert.equal(app.categorizeExpenseType('Seminar XY', config), 'exp-1');
    // Default-Keywords der übrigen Built-ins bleiben aktiv
    assert.equal(app.categorizeExpenseType('Hotel', config), 'accommodation');
    // travel-Keywords wurden ERSETZT: 'Benzin' matcht nicht mehr → Fallback
    assert.equal(app.categorizeExpenseType('Benzin', config), 'other');
});

test('suggestEmployeeForExpense: eindeutiger Namensbestandteil → Vorschlag', () => {
    const employees = [
        { id: 'e1', name: 'Cetinkilic' },        // im Tool nur Nachname
        { id: 'e2', name: 'Anna Weber' },
        { id: 'e3', name: 'Tom Weber' },
    ];
    // ERP liefert vollen Namen, Tool kennt nur den Nachnamen → Vorschlag
    assert.equal(app.suggestEmployeeForExpense('Salih Cetinkilic', employees).id, 'e1');
    // "Weber" matcht zwei Mitarbeiter → kein Vorschlag
    assert.equal(app.suggestEmployeeForExpense('Lisa Weber', employees), null);
    assert.equal(app.suggestEmployeeForExpense('Unbekannt Person', employees), null);
});

test('findEmployeeForExpense: Alias > Name > umgekehrte Reihenfolge', () => {
    const employees = [
        { id: 'e1', name: 'Jakub Mechlinski' },
        { id: 'e2', name: 'Weber Anna' },
    ];
    // Name-Match trotz Diakritika-Differenz
    assert.equal(app.findEmployeeForExpense('Jakub Mechliński', employees, {}).id, 'e1');
    // Umgekehrte Reihenfolge ("Anna Weber" ↔ "Weber Anna")
    assert.equal(app.findEmployeeForExpense('Anna Weber', employees, {}).id, 'e2');
    // Alias hat Vorrang und matcht, was sonst niemand matcht
    const aliases = { [app.normalizeEmpName('J. Mechl. (extern)')]: 'e1' };
    assert.equal(app.findEmployeeForExpense('J. Mechl. (extern)', employees, aliases).id, 'e1');
    // Kein Match
    assert.equal(app.findEmployeeForExpense('Unbekannt Person', employees, {}), null);
});
