// Test-Loader: Die App-Module (config.js, utils.js, datalayer.js) sind
// klassische Browser-Skripte ohne Module-Syntax – alle Definitionen leben im
// globalen Scope. Für Tests werden sie hier konkateniert, in eine Funktion
// gewickelt und die benötigten Symbole explizit zurückgegeben.
// Browser-Globals, die die reinen Logik-Pfade brauchen (crypto, TextEncoder),
// existieren in Node >= 18 nativ.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const APP_DIR = path.join(__dirname, '..', 'app');

const read = (f) => fs.readFileSync(path.join(APP_DIR, f), 'utf8');

const EXPORTS = [
    // config.js
    'APP_VERSION', 'DEFAULT_TEAMS', 'SCHEMA_VERSION', 'GLOBAL_DATA_FILES',
    'teamAssignmentsFile', 'teamCostItemsFile', 'getEmpTeam', 'groupByTeam',
    'makeId', 'generateInitialPin', 'resolveProjectColor',
    // utils.js
    'getWeekString', 'addWeeks', 'weekIdToMonday', 'getEasterDate',
    'getGermanHolidays', 'generateWeeksForYear', 'resolveCountryCode',
    'getAssignmentHours', 'formatKW', 'describeAssignment',
    'compareWeekIds', 'validateRestoredSession', 'validateImportedState',
    'mergeAuditLogs', 'isValidTeamName',
    'hashPin', 'verifyPin', 'generatePinSalt',
    // datalayer.js
    'migrateCostItem', 'migrateCostItems', 'migrateExpensesToCostItems',
    'buildSplitFiles', 'mergeSplitFiles', 'saveSplitState', 'seedLastSaved',
    'pLimit', 'loadChangedTeamFilesSp',
    // settlement.js
    'SETTLEMENT_STATUSES', 'SETTLEMENT_STATUS_ORDER', 'getSettlementStatus',
    'settlementAmount', 'aggregateSettlement', 'findDuplicateExpenseReport',
    'buildAccountingEmail', 'findTripSibling', 'moveCostLine',
];

function loadApp() {
    const source = [read('config.js'), read('utils.js'), read('datalayer.js'), read('settlement.js')].join('\n;\n');
    const body = `${source}\n;return { ${EXPORTS.join(', ')} };`;
    // eslint-disable-next-line no-new-func
    return new Function(body)();
}

module.exports = { loadApp };
