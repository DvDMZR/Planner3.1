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
    'findEmployeeForExpense',
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
