// ─── TEAM-SPLIT FILE LAYOUT ───────────────────────────────────────────────────
const APP_VERSION = 'v0.90';
const DEFAULT_TEAMS = ['AS', 'CMS', 'CSS', 'HM', 'I&C', 'Other'];
const PLANNER_DATA_DIR = 'planner-data';
const SCHEMA_VERSION = 4;
// Names of the global (non-team) data files. Used by buildSplitFiles,
// the SharePoint/FS loaders, and the polling code's full-reload check.
const GLOBAL_DATA_FILES = ['employees.json', 'projects.json', 'settings.json',
                            'categories.json', 'users.json', 'audit.json',
                            'category-defs.json', 'tasks.json', 'inactive.json'];
const teamAssignmentsFile = (team) => `assignments-${team}.json`;
const teamCostItemsFile   = (team) => `cost-items-${team}.json`;

const getEmpTeam = (empId, employees) => {
    const emp = (employees || []).find(e => e.id === empId);
    return (emp && emp.category) ? emp.category : 'Other';
};

const groupByTeam = (items, employees, teams) => {
    const groups = {};
    (teams || []).forEach(t => { groups[t] = []; });
    const empTeamMap = new Map((employees || []).map(e => [e.id, e.category || 'Other']));
    (items || []).forEach(item => {
        const t = empTeamMap.get(item.empId) || 'Other';
        if (!groups[t]) groups[t] = [];
        groups[t].push(item);
    });
    return groups;
};
// ─────────────────────────────────────────────────────────────────────────────

// Monotonic ID helper – avoids collisions from Date.now() when multiple
// items are created within the same millisecond.
let _idCounter = 0;
const makeId = (prefix = 'id') =>
    `${prefix}-${Date.now().toString(36)}-${(_idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// Admin seed: used only once when no users.json exists yet. The admin then
// lives in users.json like any other user, with a hashed PIN. Change via UI.
const ADMIN_SEED = { id: 'admin', name: 'Admin', role: 'admin' };

// Generate a cryptographically random 4-digit numeric PIN (1000–9999).
// Rejection sampling avoids modulo bias: values that would skew the
// distribution are discarded and a new random number is drawn.
const generateInitialPin = () => {
    const range = 9000; // 1000–9999
    const limit = Math.floor(0x100000000 / range) * range; // 4294965000
    const arr = new Uint32Array(1);
    let val;
    do { crypto.getRandomValues(arr); val = arr[0]; } while (val >= limit);
    return String(1000 + (val % range));
};

// Build an admin user with a freshly generated random PIN. Returns both the
// user record (with hashed PIN) and the plain PIN so the caller can show it
// once in the UI. Used at first-init only.
const buildAdminSeed = async () => {
    const plainPin = generateInitialPin();
    const salt = generatePinSalt();
    const pinHash = await hashPin(plainPin, salt);
    return { admin: { ...ADMIN_SEED, pinHash, pinSalt: salt, pinAlgo: PIN_PBKDF2_ALGO }, generatedPin: plainPin };
};

// Ensure an admin exists in the user list. If missing, prepend a seeded one
// with a randomly generated PIN. Returns { users, initialPin } where
// initialPin is non-null only on first-time creation so the caller can
// display it once and prompt the user to change it immediately.
// Note: _needsSeed admins are not considered "real" admins, so they'll be
// replaced with a properly seeded admin+initialPin.
const ensureAdmin = async (users) => {
    const list = users || [];
    if (list.some(u => u.role === 'admin' && !u._needsSeed)) return { users: list, initialPin: null };
    const { admin, generatedPin } = await buildAdminSeed();
    const filtered = list.filter(u => !u._needsSeed);
    return { users: [admin, ...filtered], initialPin: generatedPin };
};

// --- CHANGELOG ---
const CHANGELOG_CONTENT = `# Changelog

## v0.90 (2026-06-29)

### Planung: Projektlabel & Tooltip
- Projektlabel zeigt jetzt strukturiert: **[Anlagentyp] [Größe] [Anlagenname] [Land]**
  (Beispiel: "MW 8 Turbine DE" statt nur "Turbine").
- **Tooltip auf Hover**: Projekt-Notizen erscheinen beim Überfahren des Projektnamens
  mit vorgesehenem längeren Text. Wrap-Support für mehrzeilige Notizen.

### Dropdown & Sortierung
- Projekt-Dropdown im Planungs-Dialog zeigt dieselbe formatierte Label
  ([Anlagentyp] [Größe] [Name] [Land]).
- **Sortierung**: Optionen sortiert alphabetisch (primär: Anlagentyp A–Z,
  sekundär: Anlagenname A–Z).

### Admin & PIN-Anzeige (Bugfix)
- Admin-Initialisierung repariert: beim Erststart wird jetzt ein echter
  Admin mit zufällig generiertem PIN erzeugt (nicht Placeholder).
- **Initial-PIN wird einmalig angezeigt**: erscheint nach Login als
  Warnungs-Toast mit Hinweis, sofort unter "System & Export" zu ändern.
- Placeholder-Admins (\_needsSeed-Flag) werden korrekt durch echte
  Admin-Records ersetzt.

### Layout-Anpassung
- **Spaltenbreite für englische Sprache**: Project-Spalte in Timeline erhöht
  (72rem → 85rem), damit Sortierbutton und Text bei English UI nicht in
  Status-Spalte überlaufen.

## v0.89 (2026-06-25)

### UI / Allgemein
- Versionsnummer jetzt im Sidebar-Header sichtbar (Changelog-Badge).
- "Heute"-Button zeigt die aktuelle KW ganz links, eine Woche davor ist sichtbar.

### Projekte
- Neues Feld **Notizen** im Projekt-Formular (interner Freitext).
- Notizen erscheinen im Kostenexport (CSV und E-Mail).

### Kostenexport
- CSV strukturiert in Abschnitte: Projektdetails, Personalkosten (pro MA), Zusatzkosten (pro MA + Typ), Gesamtsumme.
- E-Mail-Text analog strukturiert mit Trennlinien und Summen je Abschnitt.

## v0.88 (2026-06-24)

### Neue Felder & Planung
- Projektfelder: **Typ** (aus verwaltbarer Liste), **Größe** (Zahl) und **SharePoint-Link** (URL) hinzugefügt.
- Projekt-Typ-Liste ist unter Verwaltung → Kategorien pflegbar.
- SharePoint-Link erscheint als Icon in Planung/Projekte und im Projekt-Header.
- Planung/Projekte zeigt jetzt Name, Typ, Größe und Land pro Zeile.

### Verwaltung/Projekte
- Suchfeld zum Filtern nach Name, Nummer, Land, Typ und Kategorie.
- Sortierung nach Name, Typ, Größe, Land, Status und Zeitraum (auf- und absteigend).
- Titelzeile und "Neues Projekt"-Button bleiben beim Scrollen sichtbar (sticky).

### Navigation
- "Heute"-Button scrollt die aktuelle Kalenderwoche exakt an den linken Rand (Index-basiert, kein langsames Annähern mehr).

## v0.87 (2026-05-20)

### Datensicherheit & Privilege-Escalation
- Backup-Import validiert das Schema, verwirft unbekannte Felder und
  ignoriert \`appUsers\` komplett – ein präpariertes Backup kann keinen
  Angreifer-PIN-Hash mehr einschleusen.
- \`sessionStorage\`-Session wird beim Restore gegen das erwartete Schema
  geprüft; manipulierte Rollen führen zu \`null\` (Login erforderlich).
- Orphan-Check: ist der eingeloggte User nach einem Sync nicht mehr in
  \`appUsers\`, wird er ausgeloggt mit Hinweis.

### Konsistenz beim Löschen
- Projekt- und Mitarbeiter-Delete zeigen ein eigenes Modal mit allen
  abhängigen Zuweisungen und Kostenpunkten; Bestätigung löscht alles
  in einem Schritt, Undo stellt komplett wieder her.
- Modal-vs-Polling-Race: AssignmentModal/CopyModal/CostItemModal prüfen
  vor dem Speichern, ob der bearbeitete Eintrag noch existiert – kein
  Resurrect gelöschter Daten mehr.

### Wochen-Logik & Sync-Hygiene
- Neuer ISO-Wochen-Comparator \`compareWeekIds\` – Reihen über
  53-Wochen-Jahre erzeugen jetzt die korrekte Instanz-Zahl, IBN-Filter
  und Projekt-Status nutzen denselben Vergleich.
- \`weeks\`-Array refresht stündlich, wenn der heutige Montag nicht mehr
  am Anfang steht – kein Drift mehr über den Jahreswechsel.
- Cross-Tab-Sync: \`storage\`-Event übernimmt Änderungen aus anderen
  Tabs derselben Origin ohne Clobber.
- SpConflictError-Cap: nach 3 Konflikten in Folge stoppt der Auto-Reload
  und der Status flippt auf \`conflict-loop\` mit Reload-Hinweis.

### Login & Eingabe-Hygiene
- PIN-Lockout: 5 Fehlversuche → 60 Sekunden gesperrt, Countdown wird
  angezeigt.
- CostItem-Lines normalisieren NaN/leere Eingaben zu 0 – kein
  \`amount: NaN\` mehr im persistenten State.
- \`migrateCostItem\` ist idempotent: erneute Migrationen verdoppeln
  keine Lines mehr.
- \`fsSaveFile\`-\`SecurityError\` flippt \`fsStatus\` auf
  \`needs-permission\` statt stillem Fail.

## v0.86 (2026-05-19)

### Synchronisations- und Datensicherheits-Audit
- \`projects.json\` jetzt im Wipe-Schutz; ein non-empty→empty Write wird
  abgebrochen.
- \`basicTasksMeta\`-Guard korrigiert: leere Map ist legitim (nur
  hardcoded Basic-Tasks) und propagiert wieder.
- PIN-Migrations-Mutex: parallele \`applyRemoteSnapshot\`-Aufrufe können
  Hash-Migration nicht mehr in sich selbst verschachteln.
- Login-Backup wartet auf Abschluss des initialen Loads, kein halb-leerer
  Snapshot mehr im Backup-Ordner.

## v0.85 (2026-05-19)

### Audit-Log (Verlauf)
- Append-Merge: bei paralleler Bearbeitung gehen Audit-Einträge nicht
  mehr verloren – lokales und Remote-Log werden per Eintrags-ID vereinigt,
  nach Timestamp sortiert und auf 500 gekürzt.
- Wipe-Schutz für \`audit.json\`: Schrumpfen auf 0 Einträge wird als
  Korruption blockiert.

## v0.84 (2026-05-19)

### Auslastung
- Doppelbuchungs-Warnsymbol: 💢 (orange ≥150 %, rot ≥200 %) erscheint
  in der Monats-Zelle, wenn mindestens eine Woche im Monat überlastet
  ist – fällt auch dann auf, wenn der Monatsdurchschnitt < 100 % bleibt.

### Planung
- Abgelaufene Projekte (IBN-Woche vergangen) fliegen aus den
  Planungs-Reitern raus. In Verwaltung → Projekte bleiben sie bis zum
  „Abgeschlossen"-Haken.

### System & Export
- Backup-Feedback nutzt jetzt das globale Toast-System: sichtbar
  unabhängig vom Scroll-Stand, 6 Sekunden Anzeigedauer.

## v0.83 (2026-05-19)

### Datenverlust verhindern
- \`categories.json\` weiter aufgeteilt in drei Dateien nach Edit-Frequenz:
  \`category-defs.json\`, \`tasks.json\`, \`inactive.json\`. Parallele
  Admin-Edits blockieren sich nicht mehr gegenseitig.
- Sanity-Guard erweitert: jeder Write, der eine zuvor nicht-leere Liste auf
  leer setzen würde, wird abgebrochen.
- \`applyRemoteSnapshot\` gehärtet: alle Listen-Properties guarden gegen
  empty remote; \`inactiveSupportTasks\`/\`inactiveTrainingTasks\` werden
  jetzt auch synchronisiert.

### Backup
- „Jetzt sichern" repariert; echter Fehlertext landet im Toast.
  Funktioniert jetzt auch im FS-Mode (lokaler Ordner).
- Login-Backup: jeder Login löst ein Recovery-Backup aus (rate-limited
  auf max. eines pro 30 Minuten).

### Kategorien
- „Hinzufügen"-Button für Basic Tasks in Verwaltung → Kategorien.

### System & Export
- Hinweis „Inhalte ohne PIN-Hashes" entfernt.

## v0.82 (2026-05-19)

### Kategorien
- Neue Sektion **Other Tasks** in Verwaltung → Kategorien. Trennt user-
  erstellte Tasks (mit Meta, in Planung als „Other" sichtbar) sauber von
  den hardcoded **Basic Tasks** (z. B. Office).

### Sicherheit
- **PIN-Hashing** (SHA-256 + per-User-Salt). Bestehende Plaintext-PINs
  werden beim nächsten Login transparent migriert.
- **Admin nicht mehr hardcoded**: lebt in \`users.json\` mit gehashtem PIN.
  Default-PIN 1397 wird einmalig gesetzt und kann via UI geändert werden.

### Synchronisation
- \`settings.json\` aufgeteilt in vier Dateien: \`settings.json\`,
  \`categories.json\`, \`users.json\`, \`audit.json\`. Drastisch weniger
  ETag-Konflikte, da Audit-Writes Kategorien-Edits nicht mehr blockieren.
- Sanity-Guard: ein Save, der zuvor nicht-leere Listen auf leer setzen
  würde, wird abgebrochen.

### Backup
- Auto-Backup nach \`planner-data/backups/\` mit zeitgestempelten JSONs
  (Intervall in Verwaltung → Benutzer einstellbar, Default 60 Min,
  manueller „Jetzt sichern"-Button). Letzter Backup-Zeitstempel wird aus
  dem Folder-Listing gelesen, nicht in \`settings.json\` geschrieben.

### Export
- Backup-Export enthält jetzt alle persistierten Felder; PIN-Hashes werden
  gestrippt.

### Personalisierung
- Per-User-Einstellungen: Kompaktansicht wird pro Nutzer gespeichert und
  beim Login wiederhergestellt.

### Planungs-Chips
- Kommentar-Symbol jetzt auch im Kompaktmodus und in der Projekte-Ansicht
  (Timeline) sichtbar; Icon-Größe/Opazität angehoben.

### Email-Vorlage
- Email-Text für Planungs-Benachrichtigungen in Verwaltung → Benutzer
  (Admin) editierbar. Platzhalter: \`{firstName}\`, \`{refLabel}\`,
  \`{typeLabel}\`, \`{weekRange}\`, \`{comment}\`, \`{attachmentNote}\`;
  optionale Blöcke via \`{{#comment}}…{{/comment}}\`.

## v0.81 (2026-05-07)

### Sidebar: neuer Bereich "Details"
- Der bisherige Support-Reiter ist jetzt Teil einer aufklappbaren Gruppe
  **Details**, die direkt unter Ressourcen platziert ist.
- Drei Subreiter:
  - **Support** – wie gehabt (sichtbar nur wenn Support-Mitarbeiter vorhanden).
  - **Abwesenheiten** – Urlaub, Krankheit, Gleitzeit usw.
  - **Trainings** – alle Trainings-Aufgaben.
- Abwesenheiten und Trainings zeigen alle aktiven Mitarbeiter, sodass
  Planung möglich ist, bevor erste Zuweisungen existieren.

### Planungsdialog
- Beim Öffnen aus den Tabs Abwesenheiten oder Trainings ist die Typauswahl
  ausgeblendet und der passende Typ (offtime / training) automatisch gesetzt
  – so können dort nur fachgerechte Zuweisungen erfasst werden.

### Übersicht & Projekte
- Projektkategorien werden in den Reitern Projekte und Übersicht jetzt
  alphabetisch sortiert (Locale de), wobei "Other" konsequent ans Ende
  gestellt wird – analog zu Mitarbeiterkategorien.

## v0.8 (2026-05-04)

### Synchronisation & Datenintegrität
- **ETag-basierte Konflikterkennung** bei SharePoint-Saves: bearbeiten zwei
  Kollegen dieselbe Datei gleichzeitig, erhält der spätere Save eine 412-Antwort,
  lädt den Remote-Stand und zeigt im Sidebar-Status "Änderung eines Kollegen
  übernommen" für 3 Sekunden — keine stillen Überschreibungen mehr.
- **\`meta.json\` als atomarer Commit-Marker**: wird beim Speichern immer als
  letzte Datei geschrieben. Polling-Clients warten auf \`meta.json\`, bevor sie
  auf Änderungen reagieren — keine Reaktionen auf halb-geschriebene Stände.
- **Polling-Race-Guards**: kein selektiver Reload, wenn lokal noch ein Save
  gequeued ist; bei unbekanntem Team in einer Datei → Full-Reload-Fallback.

### Planungsdialog
- **Smootherer Auslastungs-Schieber**: Step jetzt 5 % statt 10 %, exakte
  25 / 50 / 75 % unabhängig von der Wochenarbeitszeit erreichbar (z. B.
  50 % von 35 h → 17,5 h gespeichert).
- Tick-Marker bei jedem 25 %-Schritt unter dem Schieber, längere Striche bei
  0 / 50 / 100 / 150 / 200 %.
- Beschriftungen mit absoluter Positionierung exakt über ihrem Wert
  zentriert — kein Versatz mehr zwischen Text und Position.

### Tasks kopieren
- Beim Kopieren zwischen Mitarbeitern mit unterschiedlicher Wochenarbeitszeit
  bleibt die **prozentuale Auslastung** erhalten, nicht die absoluten Stunden:
  100 % von einer 35-h-Person zu einer 40-h-Person ergibt jetzt 40 h, nicht 35 h.

### Anmeldung
- Nutzerauswahl beim Login erfolgt jetzt über **Pill-Buttons** statt Dropdown.
  Klick auf eine Pille blendet das PIN-Feld ein und fokussiert es.

## v0.7.5 (2026-04-29)

### Mitarbeiter-Verwaltung
- Popup zur Mitarbeiterbearbeitung schmäler (max-w-md statt max-w-xl).

### Planungsdialog
- Email-Anrede verwendet jetzt den Vornamen aus dem Email-Präfix statt
  dem Planner-Namen (z.B. hans.mueller@firma.de → "Hans").
- Erläuterungstext unter der Email-Benachrichtigungs-Checkbox wurde in
  einen **Tooltip** hinter einem ?-Icon verschoben.

### Übersicht
- Projekte werden nach Kategorie gruppiert (wie im Reiter Projektverwaltung),
  mit Kategorietrennern zwischen den Gruppen.

### Ressourcenplanung
- Mitarbeiter-Suchfeld unterstützt jetzt **mehrere kommagetrennte Suchbegriffe**
  (z.B. "Müller, Schmidt") — nur Mitarbeiter, die einen der Begriffe
  enthalten, werden angezeigt.

## v0.7.4 (2026-04-28)

### Heatmap (Auslastung)
- Monats-Kopfzeile bleibt jetzt zuverlässig sticky beim Scrollen — kein
  durchscheinender Spalt mehr zwischen Tabellenkopf und Inhalt.
- Klick auf einen Mitarbeiter oder eine Monatszelle öffnet die
  Ressourcenplanung mit dem Mitarbeiter im Suchfeld vorausgewählt
  (springt zusätzlich zur passenden Woche, wenn ein Monat angeklickt
  wurde — passt das Jahr automatisch an).
- NaN-Fix in der Auslastungsberechnung für ältere Einträge ohne
  explizite hours/percent-Werte.

### Planungsdialog
- "Wochenbereich (bis KW)" wurde durch ein einfaches Zahlenfeld
  **Planen für X Wochen** (Standard 1) ersetzt — schneller und
  intuitiver. Die End-KW wird zur Kontrolle direkt eingeblendet.
- Neue Checkbox **Per Email + Outlook-Termin benachrichtigen**
  (nur aktiv, wenn beim Mitarbeiter eine Email hinterlegt ist):
  öffnet einen vorgefertigten englischen Email-Entwurf mit den
  Planungsdetails UND lädt eine .ics-Datei als Outlook-Termin
  (METHOD:REQUEST, Mitarbeiter als Teilnehmer) herunter. Die
  .ics kann an die Email angehängt oder per Doppelklick in
  Outlook als Termineinladung versendet werden.

### Mitarbeiter-Verwaltung
- Bearbeiten/Hinzufügen läuft jetzt in einem **Popup** statt als
  Inline-Formular oben in der Liste.
- Neue Felder: **Email** (mit Validierung, Pflicht für Outlook-/Email-
  Benachrichtigungen), **Rolle/Funktion**, **Notizen**.
- Email wird in der Mitarbeiterliste als anklickbarer Mailto-Link
  angezeigt.

### Kategorien
- **Trainings** lassen sich jetzt benutzerdefiniert erweitern
  (Hinzufügen/Löschen). Die hartkodierten Standard-Trainings bleiben
  als "Permanent" bestehen.

### Kopier-Dialog
- Klare Fehlermeldung im Footer, wenn Mitarbeiter und/oder Wochen
  fehlen — verschwindet automatisch beim ersten Klick.

### Help & Legende
- Neue Legenden-Einträge: **Schraffierter Chip** (Einsatz zu 0% =
  "Unter Vorbehalt"), **Kompaktansicht** und **Klick in der Heatmap**.

## v0.7.3.1 (2026-04-28) – PR #91 / #92

### Ressourcen / Support
- Kopier-Button bleibt auch im Kompaktmodus per Hover erreichbar
  (vorher nur im Vollmodus sichtbar).
- Einsätze, die zu 0% geblockt sind, werden mit einer **Schraffur**
  gekennzeichnet ("Unter Vorbehalt") — der Chip bleibt farbig.
- Sehr feine Trennlinie an der ersten Spalte (1 px slate-300), die in
  allen Browsern (Chrome/Edge/Brave/Firefox) gleich gerendert wird —
  Workaround für Chromium-Bug mit border-r auf sticky cells in
  border-collapse-Tabellen via ::after-Pseudo-Element.

### Bug Fixes
- DST-Bug in addWeeks behoben: an der Sommer-/Winterzeit-Umstellung
  (Oktober) drifteten wiederkehrende Wochenintervalle um −1 Stunde,
  sodass mal 4, mal 5 Wochen entstanden. Jetzt durchgängig UTC-Math.
- Mitarbeiterspalte verschwand bei aktiviertem .sticky-col-divider —
  position:relative überschrieb position:sticky. CSS bereinigt.

## v0.7.3 (2026-04-27)

### Land als eigene Spalte
- In **Übersicht** und **Verwaltung → Projekte** ist das Land nun
  eine eigene Spalte direkt nach dem Projektnamen (statt eines Badges
  am Namen).

### Verwaltung → Projekte
- Land wird in der Liste angezeigt – inkl. Farb-Kennzeichnung für
  unklare (??) und leere (/) Einträge.

### Status umbenannt
- "Hat angefangen" → "Angefangen" (kürzer, präziser).

### Projekte (Planung)
- Klick auf den Projektnamen öffnet jetzt die Projekt-Einstellungen
  (springt zu Verwaltung → Projekte mit der Detailansicht).
- Projekt-Spalte um weitere 50 % verbreitert (jetzt 36 rem statt 24 rem),
  damit lange Namen samt Land-Badge sauber Platz haben.

## v0.7.2 (2026-04-27)

### Kompaktansicht
- Standardmäßig aktiv in Ressourcen und Support; bleibt jetzt erhalten,
  wenn man zwischen den Reitern wechselt (zentral im App-State statt
  pro View).

### Land pro Projekt
- Neues Feld in der Projekt-Maske mit smarter Auflösung: ISO-Kürzel
  ("DE") oder Klartext ("Deutschland", "Germany"), inkl. Schreibweise
  ohne Umlaute. Unsinnige Eingaben werden als ?? markiert, leere als /.
- Das aufgelöste Kürzel erscheint als Badge in den Reitern Übersicht
  und Projekte direkt am Projektnamen.

### Auslastung
- Vorschau startet jetzt bei 52 Wochen statt 12.
- Klick auf eine Monatszelle springt direkt zur entsprechenden Woche
  in der Ressourcenplanung (passt das Jahr automatisch an, falls die
  Woche im Folgejahr liegt).

### Layout-Politur
- Projekte: Mitarbeiter-Sidebar passt ihre Breite an den längsten
  Namen an (10–20 rem). Projekt-Spalte ist jetzt 50 % breiter (w-96).
- Erste Spalte hat in Projekte, Ressourcen und Support eine
  deutlichere Trennlinie inkl. Soft-Shadow zum Tabellenkörper.
- Projekte: oberste Zeile ist jetzt zuverlässig sticky (sticky liegt
  pro \`<th>\` statt nur am \`<thead>\`, das in border-collapse-Tabellen
  manchmal nicht greift).

## v0.7.1 (2026-04-27)

### Support-Reiter
- Neuer Reiter **Support** unter Planung, direkt nach Projekte. Erscheint
  automatisch, sobald mindestens ein Mitarbeiter eine Support-Planung hat
  (auch in der Vergangenheit) — und verschwindet, wenn die letzte
  Support-Zuweisung gelöscht wurde.
- Listet ausschließlich Mitarbeiter mit Support-Bezug, nach Team gruppiert
  wie im Ressourcenplaner. In den Zellen tauchen nur Support-Chips auf,
  damit man fokussiert disponieren kann.
- Klick auf eine leere Zelle öffnet die Zuweisungs-Maske mit vorausgewähltem
  Typ "Support". Drag-and-Drop, Löschmodus mit Undo-Stack und Kopier-Button
  funktionieren wie im Ressourcen-Reiter.

## v0.7 (2026-04-26)

### Projekte-Tab: Drag-Drop, Löschmodus, Kopieren
- Mitarbeiter-Chips lassen sich jetzt direkt im Projekte-Tab per Drag-and-Drop
  zwischen Wochen verschieben (innerhalb eines Projekts oder auf ein anderes
  Projekt). Änderungen erscheinen automatisch in der Ressourcenplanung.
- Übernommen aus dem Ressourcen-Tab: **Löschmodus** mit Undo-Stack (rote Pille
  im Header) und **Kopieren-Button** auf jedem Chip beim Hover, der die
  bekannte Kopier-Maske öffnet.
- Projekte sind in allen Listen nach Startdatum sortiert (Projekte-, Auslastungs-,
  Übersichts- und Verwaltungs-Tab).

### Kostenpunkt-Erfassung neu gedacht
- Eine Erfassung besteht jetzt aus typisierten **Posten-Zeilen**: Travel,
  Accommodation, Other, Hours. Quick-Add-Pills oben (Tooltips: z.B. Flug/Auto,
  Hotel, Werkzeug) fügen Zeilen hinzu, jede Zeile ist inline editierbar mit
  Typ-Pille · Betrag · Kommentar · Zeilensumme.
- Top-Level-Felder reduziert: nur noch Mitarbeiter, optionaler **Anlass**,
  Zeitraum. Der frühere Stunden/Rate/Betrag-Toggle ist entfernt — Stunden
  sind jetzt einfach eine eigene Zeile.
- Projekt-Detail-Tabelle zeigt eine kompakte **Posten-Spalte** statt der
  alten Art/Std/€/Std/Extras-Spalten. Rechnungs-Modal listet die Zeilen je
  Erfassung; CSV- und E-Mail-Export geben pro Posten-Zeile eine eigene
  Rechnungsposition aus (Travel und Accommodation also getrennt).
- Bestehende Daten werden beim Laden transparent migriert (mainAmount +
  hours/rate + extraCosts → lines).

### UI-Politur
- Changelog-Button in der Sidebar leuchtet jetzt sanft pulsierend.

## v0.6.7 (2026-04-25)

### Performance
- Ressourcenplaner: horizontale Wochen-Virtualisierung mit 8-Wochen-Buffer.
  Es werden nur noch ~25–30 Zellen pro Zeile gerendert statt 54 (~50 % weniger
  DOM); off-screen Bereiche kollabieren in \`<td colSpan>\`-Spacer.
- Projektplanung: gleiche Spalten-Virtualisierung wie im Ressourcenplaner;
  \`pColor\` einmal pro Projektzeile statt pro Wochenzelle.
- Auslastungs-Heatmap: komplette Auslastungsmatrix einmal pro Render
  vorberechnet (\`utilByEmp\`) — vorher wurde \`getUtilization\` pro Mitarbeiter
  doppelt durchlaufen (Ø Zeitraum + pro Monat).
- Übersicht: Projekttabelle (Filter/Map/Sort) in \`useMemo\`, Sort-Reihenfolge
  als Modul-Konstante.
- Mitarbeitersuche im Ressourcenplaner mit 250 ms Debounce.
- \`empWH\` einmal pro Mitarbeiterzeile statt pro Zuweisungs-Chip.
- \`beforeunload\`-Listener wird nicht mehr bei jeder Statusänderung neu
  registriert.

## v0.6.6 (2026-04-18)

### Performance & UX
- React auf Production-Build umgestellt (~40 % kleiner, keine Dev-Warnungen)
- Tailwind CSS vorkompiliert (kein CDN-JIT mehr, stabilerer Seitenaufbau)
- Lade-Spinner während Babel JSX kompiliert (GEA-Farben, CSS-only)
- SidebarView mit React.memo – kein Re-Render bei Hintergrund-Sync
- Scroll-Navigation in Ressourcen- und Projektplanung:
  - ← / → Buttons (4 Wochen pro Klick) mit sichtbarem KW-Bereich
  - Dünner Fortschrittsbalken unter dem Header
  - Pfeiltasten (1 Woche) und Bild-auf/-ab (4 Wochen) per Tastatur

### Code-Struktur
- App-Code weiter aufgeteilt: JSX-Komponenten, Modals, 10 View-Dateien
- \`app/components.jsx\` – Icons, ModalHeader, StatusBadge, WeekCalendarPicker
- \`app/modals.jsx\` – AssignmentModal, CopyModal, CostItemModal, DepsSection
- \`app/views/\` – je eine Datei pro Tab-Ansicht
- \`index.html\` schrumpfte von 4.549 auf ~1.350 Zeilen

## v0.6.5 (2026-04-18)

### Code-Struktur
- App-Code in separate Dateien aufgeteilt (kein funktionaler Unterschied)
- \`app/config.js\` – Konstanten, Teams, Farben, Changelog
- \`app/utils.js\` – Datums- und Wochen-Hilfsfunktionen
- \`app/sharepoint.js\` – SharePoint-Kontext, Auth, REST-API-Wrapper
- \`app/filesync.js\` – File System Access API, IndexedDB
- \`app/datalayer.js\` – Split-Dateien aufbauen/mergen, Migration
- \`app/style.css\` – CSS-Basisstile
- \`index.html\` enthält jetzt nur noch JSX (Icons, Komponenten, App)

## v0.6.2 (2026-04-17)

### Wiederkehrende Planungen (Regeln)
- Planungen können jetzt als wiederkehrend markiert werden ("Wiederkehrend (Regel)")
- Beim Anlegen: Intervall in Wochen ("Alle X Wochen") und Endwoche ("Bis Woche") wählbar
- Speichern erzeugt automatisch alle Instanzen der Serie auf einen Schlag
- Alle Instanzen einer Serie sind intern über eine gemeinsame Regel-ID verknüpft
- Löschen einer Serienplanung bietet die Wahl: nur diese Instanz oder die gesamte Serie entfernen
- Wiederkehrende Planungen zeigen ein kleines ↻-Symbol im Chip (Ressourcenansicht)

## v0.6 (2026-04-14)

### Bug Fixes
- Fixed sticky employee name column being covered by task chips when scrolling right in resource planning (z-index fix)

### Teams
- Renamed team "ME" to "CSS"
- Added new team "I&C"
- Teams are now displayed in alphabetical order (with "Other" always last)
- Employees within each team are now displayed in alphabetical order

### Planning Types (new in assignment modal)
- Added type "Trainings" with 8 sub-options: R95 Training: I&C, R95 Training: S&T, F45 Training: I&C, F45 Training: S&T, HM Training, T89 Training, T86 Training, DNB Training
- Added type "Support": 24/7 Support, CRM Support, 24/7 Replacement, CRM Replacement
- Added type "Other" for user-created tasks (previously stored under "Basic")
- Tasks created via "+ Neu" now appear under "Other" instead of "Basic"
- Removed "24/7" and "Ticketing" from Basic — they are now Support tasks

### Categories (Kategorien)
- "Set Inactive" is now available for all category types: Basic, Other, Support, Training, Offtime
- Added "Permanent" tag per task: tasks with this tag are never auto-inactivated after 12 weeks
  - Hardcoded tasks (Basic, Support, Training) are permanently active by default
  - User-created Other tasks can be toggled between Permanent and Temporary
  - New user-created tasks default to Temporary (auto-expire after 12 weeks)
- Support and Training tasks now shown in their own sections in Kategorien

### Task Comments
- Click any planned task chip to open the edit modal and add a comment
- Tasks with a comment display a small message icon (indicator)
- Hovering over a task with a comment shows the comment text as a native tooltip
- Copying a task via the copy button also copies the comment
- Drag-dropping a task to a different employee clears the comment (reassignment = new context)

### Colors
- Projects now display their color as the full chip background in resource planning
- 9-color palette available for projects (blue, violet, emerald, teal, rose, lime, cyan, pink, gea)
- New projects are auto-assigned the next available color from the palette
- Project color picker now shows swatches in the project edit dialog
- 24/7 Support: unique amber color not shared with any project
- CRM Support: unique indigo color not shared with any project
- 24/7 Replacement: unique orange color
- CRM Replacement: unique purple color
- Training tasks use a unique sky-blue color
- User-created Other/Basic tasks can optionally have a custom color assigned in Kategorien settings
  (Default is no color — neutral gray chip)

### Projects
- Added address field to projects (shown in project details and included in CSV export)

### Copy Function
- Fixed: source week was not selectable when copying a task (highlighted in amber, now selectable for other employees)
- Employees in copy dialog are now grouped by team in collapsible sections; each team can be expanded/collapsed and all members selected at once

### Version & UI
- Version bumped to v0.6
- Changelog button in sidebar is now a visible badge (more prominent)
- System & Export tab now lists all external libraries with loaded versions and an "Check for updates" button that queries the npm registry
`;

// Default text for the assignment-notification email. Variables in {curly}
// braces are substituted at send time. Conditional blocks
// {{#comment}}…{{/comment}} render only when the variable is non-empty.
const DEFAULT_EMAIL_TEMPLATE = {
    subject: 'Neue Planung: {refLabel} ({weekRange})',
    body: [
        'Hallo {firstName},',
        '',
        'du wurdest für folgenden Einsatz eingeplant:',
        '',
        '  {typeLabel}: {refLabel}',
        '  Kalenderwoche: {weekRange}',
        '{{#comment}}  Hinweis: {comment}{{/comment}}',
        '{{#attachmentNote}}Ein Outlook-Kalendereintrag ({attachmentNote}) wurde erstellt – bitte hänge ihn an diese E-Mail an oder öffne ihn direkt in Outlook, um die Einladung zu versenden.{{/attachmentNote}}',
        '',
        'Bitte prüfe den Eintrag im Planner und melde dich bei Fragen oder Terminkonflikten.',
        '',
        'Viele Grüße',
    ].join('\n'),
};

// --- KONFIGURATION ---
const COST_TYPES = ['Dienstleistung', 'Reisekosten', 'Sonstiges'];
const DEFAULT_HOURLY_RATE = 80;
const HOURS_PER_WEEK = 40;
const WEEKS_IN_YEAR = 52;
const BASIC_TASK_EXPIRY_WEEKS = 12;
const DEFAULT_WEEKS_AHEAD = 52;

// Login lockout: lock the login form after this many failed attempts.
const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_DURATION_MS = 60 * 1000;

// Auto-backup retention. Only auto-backups are pruned; manual snapshots are
// kept as-is so user-triggered safety copies don't silently disappear.
const BACKUP_KEEP_COUNT = 50;

// Timeline view column geometry
const TIMELINE_WEEK_W = 120;    // matches min-w-[120px]
const TIMELINE_STICKY_W = 1152; // matches w-[72rem] (project name column)
// Rows / weeks rendered outside the viewport before virtualisation kicks in.
// Same value in resource and timeline scroll handlers.
const VIRT_BUFFER = 8;

// Project status sort order used by Overview
const STATUS_ORDER = { active: 0, missing_costs: 1, planned: 2, completed: 3, costs_submitted: 4 };

const COST_LINE_TYPES = {
    travel:        { label: 'Travel',        invoiceLabel: 'Reisekosten',    example: 'Flug/Auto', chip: 'bg-amber-100 text-amber-700 border-amber-200',         dot: 'bg-amber-500'   },
    accommodation: { label: 'Accommodation', invoiceLabel: 'Unterkunft',     example: 'Hotel',     chip: 'bg-indigo-100 text-indigo-700 border-indigo-200',      dot: 'bg-indigo-500'  },
    meals:         { label: 'Meals',         invoiceLabel: 'Verpflegung',    example: 'Tagespauschale', chip: 'bg-rose-100 text-rose-700 border-rose-200',      dot: 'bg-rose-500'    },
    other:         { label: 'Other',         invoiceLabel: 'Sonstiges',      example: 'Werkzeug',  chip: 'bg-slate-100 text-slate-700 border-slate-200',         dot: 'bg-slate-400'   },
    hours:         { label: 'Hours',         invoiceLabel: 'Dienstleistung', example: '',          chip: 'bg-emerald-100 text-emerald-700 border-emerald-200',   dot: 'bg-emerald-500' },
};
const COST_LINE_TYPE_ORDER = ['travel', 'accommodation', 'meals', 'other', 'hours'];

const TRAINING_TASKS = [
    'R95 Training: I&C', 'R95 Training: S&T',
    'F45 Training: I&C', 'F45 Training: S&T',
    'HM Training', 'T89 Training', 'T86 Training', 'DNB Training'
];
const SUPPORT_TASKS = ['24/7 Support', 'CRM Support', '24/7 Replacement', 'CRM Replacement'];

const SUPPORT_CHIP_COLORS = {
    '24/7 Support':     { chip: 'bg-amber-100 border-amber-400 text-amber-900',    dot: 'bg-amber-500' },
    'CRM Support':      { chip: 'bg-indigo-100 border-indigo-300 text-indigo-900', dot: 'bg-indigo-500' },
    '24/7 Replacement': { chip: 'bg-orange-100 border-orange-300 text-orange-900', dot: 'bg-orange-500' },
    'CRM Replacement':  { chip: 'bg-purple-100 border-purple-300 text-purple-900', dot: 'bg-purple-500' },
};
const TRAINING_CHIP_COLOR = { chip: 'bg-sky-50 border-sky-200 text-sky-800', dot: 'bg-sky-500' };

const PROJECT_COLORS = [
    { id: 'blue',    dot: 'bg-blue-500',    chip: 'bg-blue-50 border-blue-200 text-blue-800' },
    { id: 'violet',  dot: 'bg-violet-500',  chip: 'bg-violet-50 border-violet-200 text-violet-800' },
    { id: 'emerald', dot: 'bg-emerald-500', chip: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    { id: 'teal',    dot: 'bg-teal-500',    chip: 'bg-teal-50 border-teal-200 text-teal-800' },
    { id: 'rose',    dot: 'bg-rose-500',    chip: 'bg-rose-50 border-rose-200 text-rose-800' },
    { id: 'lime',    dot: 'bg-lime-500',    chip: 'bg-lime-50 border-lime-200 text-lime-800' },
    { id: 'cyan',    dot: 'bg-cyan-500',    chip: 'bg-cyan-50 border-cyan-200 text-cyan-800' },
    { id: 'pink',    dot: 'bg-pink-500',    chip: 'bg-pink-50 border-pink-200 text-pink-800' },
    { id: 'gea',     dot: 'bg-gea-500',     chip: 'bg-gea-50 border-gea-200 text-gea-800' },
];
const OLD_COLOR_MAP = {
    'bg-gea-500': 'gea', 'bg-blue-500': 'blue', 'bg-violet-500': 'violet',
    'bg-emerald-500': 'emerald', 'bg-teal-500': 'teal', 'bg-rose-500': 'rose',
    'bg-lime-500': 'lime', 'bg-cyan-500': 'cyan', 'bg-pink-500': 'pink',
};
const resolveProjectColor = (colorVal) => {
    const raw = colorVal || 'gea';
    const id = OLD_COLOR_MAP[raw] || raw;
    return PROJECT_COLORS.find(c => c.id === id) || PROJECT_COLORS[0];
};

const PROJECT_STATUSES = [
    { value: 'planned',         label: 'Fängt noch an',       color: 'bg-blue-100 text-blue-700' },
    { value: 'active',          label: 'Angefangen',          color: 'bg-emerald-100 text-emerald-700' },
    { value: 'completed',       label: 'Abgeschlossen',       color: 'bg-slate-200 text-slate-600' },
    { value: 'missing_costs',   label: 'Fehlende Kosten',     color: 'bg-amber-100 text-amber-700' },
    { value: 'costs_submitted', label: 'Kosten übermittelt',  color: 'bg-gea-100 text-gea-700' },
];

// Month names – used by utils.js and React components
const MONTH_NAMES    = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
