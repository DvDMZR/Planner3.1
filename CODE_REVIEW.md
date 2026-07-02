# Code Review Findings – Planner 3.1 (Stand: Commit `cd1fec8`, v0.90)

Hinweis: Im Repository existiert kein offener Pull Request; der Branch entspricht `main`
(ein einziger Upload-Commit). Dieses Review betrachtet daher den gesamten Code-Stand
(~12.100 Zeilen App-Code, React ohne Backend, Sync via SharePoint REST / File System Access API).

---

## CRITICAL (Sofort beheben)

### 1. Hardcodierte Admin-Hintertür („Recovery Credential")
**Fundstelle:** `app/utils.js:304-320` (`_R_S`, `_R_H`, `verifyAdminPin`)
**Kritikalität:** CRITICAL
**Grund:** Im Client-Quellcode liegt ein permanentes Backup-Passwort für **alle** Admin-Accounts:
Salt (`_R_S`) und PBKDF2-Hash (`_R_H`) sind öffentlich. Jeder, der die Quelldatei lesen kann
(alle Nutzer der App – es ist Client-Code), kann den Klartext offline brute-forcen. Handelt es
sich um eine 4-stellige PIN, sind das 10.000 Kandidaten – mit PBKDF2-100k in Sekunden geknackt.
Die Hintertür ist **nicht widerrufbar** (Ändern des Admin-PINs über die UI deaktiviert sie nicht)
und umgeht das gesamte Lockout-/Audit-Konzept.
**Lösung:** `_R_S`/`_R_H` und den zweiten Prüfpfad in `verifyAdminPin` ersatzlos entfernen.
Als Break-Glass-Mechanismus stattdessen den bereits existierenden First-Init-Flow nutzen
(users.json löschen → neuer Admin mit zufälligem Initial-PIN wird erzeugt und einmalig angezeigt).

---

## HIGH (Priorität)

### 2. Autorisierung existiert nur im Client
**Fundstelle:** Architektur – `app/modals.jsx:1130-1150` (Login), `app/sharepoint.js` (Datenzugriff)
**Kritikalität:** HIGH
**Grund:** PIN-Prüfung, Rollen (`admin`/`active`) und Login-Lockout laufen ausschließlich im
Browser. Die eigentlichen Daten (`planner-data/*.json` inkl. `users.json` mit PIN-Hashes) liegen
in einem SharePoint-Ordner, auf den jeder App-Nutzer per REST **lesend und schreibend** zugreifen
kann – sonst würde der Sync nicht funktionieren. Jeder Nutzer kann also PINs auslesen/knacken,
`users.json` direkt manipulieren (sich selbst zum Admin machen) oder Daten am UI vorbei ändern.
Die Login-Schicht ist faktisch nur UX, keine Sicherheit.
**Lösung:** Entweder (a) dies explizit als Design-Entscheidung dokumentieren („PIN = Komfort-
Schutz, echte Zugriffskontrolle = SharePoint-Berechtigungen") und die SharePoint-Ordnerrechte
entsprechend restriktiv setzen, oder (b) mittelfristig eine serverseitige Komponente (z. B.
Azure Function / Power Automate) vor die Schreibzugriffe setzen.

### 3. 4-stellige PINs mit öffentlich lesbaren Hashes
**Fundstelle:** `app/utils.js:253-298`, `app/config.js:45-52`, `users.json` (synchronisiert),
localStorage-Persistenz in `app/app.jsx:704-711`
**Kritikalität:** HIGH
**Grund:** PBKDF2-100k ist gut, hilft aber bei einem Keyspace von 10⁴ nicht: Wer `users.json`
(SharePoint, Backups, localStorage) lesen kann, brute-forct jeden PIN offline in Sekunden.
**Lösung:** Mindest-PIN-Länge auf 6–8 Stellen anheben oder alphanumerische Passphrase erlauben;
alternativ Finding 2(a) akzeptieren und die Einschränkung im Admin-UI/Doku klar benennen.

### 4. Keine automatisierten Tests
**Fundstelle:** gesamtes Repo – `package.json` enthält kein `test`-Script, keine Testdateien
**Kritikalität:** HIGH
**Grund:** Der Code enthält viel fehleranfällige, pure Logik mit dokumentierter Bug-Historie
(DST-Bug in `addWeeks`, 53-Wochen-Jahre in `compareWeekIds`, Idempotenz von `migrateCostItem`,
Merge-Kaskaden in `mergeSplitFiles`, Import-Sanitizer `validateImportedState`, Wipe-Guards in
`saveSplitState`). Genau diese Funktionen sind trivial unit-testbar, werden aber bei jeder
Änderung nur manuell verifiziert – Regressionen (Datenverlust!) fallen erst in Produktion auf.
**Lösung:** Vitest/Jest als devDependency aufnehmen; zuerst `utils.js` (Datums-/Wochenlogik,
`validateImportedState`, `mergeAuditLogs`) und `datalayer.js` (`migrateCostItem`,
`buildSplitFiles`/`mergeSplitFiles`-Roundtrip, `wouldWipe`) abdecken.

### 5. Committete Build-Artefakte ohne Konsistenz-Prüfung
**Fundstelle:** `app/dist/**` vs. `app/*.jsx`, `app/views/*.jsx`; Build via `npm run build:jsx`
**Kritikalität:** HIGH
**Grund:** Die App lädt zur Laufzeit ausschließlich `app/dist/*.js` (siehe `index.html`). Die
`.jsx`-Quellen müssen manuell neu gebaut und mit-committet werden. Nichts stellt sicher, dass
`dist/` zum Quellstand passt – ein vergessener Build liefert stillschweigend alten Code aus.
**Lösung:** CI-Check (GitHub Action): `npm run build:jsx` ausführen und `git diff --exit-code
app/dist` prüfen; alternativ `dist/` aus dem Repo nehmen und einen Release-/Deploy-Schritt bauen.

---

## MEDIUM (Sollte behoben werden)

### 6. Team-Namen fließen ungeprüft in Dateinamen
**Fundstelle:** `app/config.js:11-12` (`assignments-${team}.json`), `empCategories` ist über die
UI (Verwaltung → Kategorien) frei editierbar
**Kritikalität:** MEDIUM
**Grund:** Ein Team-Name wie `a/b`, `..` oder mit Sonderzeichen erzeugt ungültige bzw.
unerwartete Pfade – im FS-Modus wirft `getFileHandle` (Sync bricht ab), auf SharePoint entstehen
je nach Zeichen falsch aufgelöste Pfade. `SP_ENC` escapet zwar `' # % +`, aber keine Slashes.
**Lösung:** Team-Namen bei Eingabe validieren (Whitelist z. B. `[A-Za-z0-9 &_-]`, max. Länge)
und/oder beim Ableiten des Dateinamens einen Slug verwenden.

### 7. Toter Code
**Fundstelle:** `app/sharepoint.js` – `spSave` (Z. 262), `spGetTimestamp` (Z. 253);
`app/filesync.js` – `fsSave` (Z. 43); `app/config.js` – `injectAdmin` (Z. 82)
**Kritikalität:** MEDIUM
**Grund:** Diese Funktionen werden nirgends mehr aufgerufen (nur Definition, keine Referenz
außerhalb der eigenen Datei). Insbesondere `injectAdmin` ist als „Legacy" markiert, hält aber
das `_needsSeed`-Konzept doppelt am Leben und verwirrt beim Lesen des Auth-Flows.
**Lösung:** Entfernen. `spLoad`/`fsLoad` bleiben (werden von der Migration genutzt).

### 8. Wochenvergleich per String-Operator statt `compareWeekIds`
**Fundstelle:** `app/app.jsx:2128` (`projForm.ibnWeek < projForm.startWeek`)
**Kritikalität:** MEDIUM
**Grund:** Das Projekt hat für genau dieses Problem `compareWeekIds` eingeführt (utils.js:358),
nutzt es hier aber nicht. Der Lex-Vergleich funktioniert nur, solange alle Week-IDs zweistellig
gepaddet sind – eine stillschweigende Invariante ohne Absicherung.
**Lösung:** `compareWeekIds(projForm.ibnWeek, projForm.startWeek) < 0` verwenden; per Grep
weitere `<`/`>`-Vergleiche auf Week-IDs prüfen.

### 9. Duplizierter SharePoint-Schreib-/Ordner-Code
**Fundstelle:** `app/sharepoint.js` – `spSaveFile` (Z. 339-352) vs. `spSaveBackup` (Z. 394-406);
`spEnsureFolder` (Z. 275) vs. Inline-Folder-Create in `spSaveBackup` (Z. 382-391)
**Kritikalität:** MEDIUM
**Grund:** Der „Files/Add mit overwrite"-Block und die Best-Effort-Ordnererstellung existieren
je zweimal. Fixes (z. B. an Headern oder Fehlerbehandlung) müssen doppelt gepflegt werden.
**Lösung:** Gemeinsame Helper extrahieren (`spAddFile(ctx, folder, filename, body)` und
`spEnsureFolderAbs(ctx, absPath)`), beide Aufrufer darauf umstellen.

### 10. `app.jsx` als God-Component (2.677 Zeilen)
**Fundstelle:** `app/app.jsx`
**Kritikalität:** MEDIUM
**Grund:** Sync-Engine (SP/FS/localStorage/Polling/Konflikte), Auth/Session, Backup-Scheduler,
Projekt-Formular-Modal und App-Shell leben in einer Datei/Komponente. Die Views wurden bereits
ausgelagert – die Sync-Logik nicht. Das erschwert Reviews und ist die wahrscheinlichste Quelle
zukünftiger Race-Bugs (die Changelog-Historie zeigt bereits mehrere).
**Lösung:** Sync/Persistenz in ein eigenes Modul bzw. Custom Hooks extrahieren
(`useSyncEngine`, `useAuth`, `useBackups`); das Projekt-Modal nach `modals.jsx` verschieben.

### 11. Stilles Verschlucken von Fehlern
**Fundstelle:** u. a. `app/filesync.js:108,117,132-134`, `app/sharepoint.js:289-292`,
diverse `catch(e) {}` in `app/app.jsx`
**Kritikalität:** MEDIUM
**Grund:** Einige Catches sind bewusst (Kommentar vorhanden), viele geben aber weder Log noch
UI-Signal aus. Beispiel `fsGetFolderTimestamps`: schlägt die Iteration fehl, liefert es `{}` –
das Polling hält alle Dateien für „unverändert" und der Sync wirkt gesund, obwohl er blind ist.
**Lösung:** Pro Catch entscheiden: erwarteter Zustand (Kommentar + ggf. `console.debug`) oder
echter Fehler (mind. `console.warn` + Sync-Status `error`). Leere Catches ohne Kommentar verbieten.

### 12. `package.json`-Metadaten: lokale Proxy-URL und Lizenz-Widerspruch
**Fundstelle:** `package.json:12` (`http://local_proxy@127.0.0.1:59149/git/DvDMZR/Planner-3`),
`package.json:16` (`ISC`) vs. `index.html:1-5` („Alle Rechte vorbehalten")
**Kritikalität:** MEDIUM
**Grund:** Die Repository-URL ist ein Artefakt einer lokalen Tooling-Umgebung (zeigt zudem auf
„Planner-3", nicht „Planner3.1"). Die Open-Source-Lizenz ISC widerspricht dem proprietären
Copyright-Header – rechtlich unsauber, falls das Repo geteilt wird.
**Lösung:** Repository-URL auf `https://github.com/DvDMZR/Planner3.1` korrigieren;
`"license": "UNLICENSED"` (+ `"private": true`) setzen, sofern proprietär gewollt.

---

## LOW (Nice-to-have)

### 13. Versions-Drift: `index.html` vs. `config.js`
**Fundstelle:** `index.html:11` („v0.89") vs. `app/config.js:2` (`APP_VERSION = 'v0.90'`)
**Kritikalität:** LOW
**Grund:** Zwei manuell gepflegte Versionsangaben laufen bereits auseinander.
**Lösung:** Titel zur Laufzeit aus `APP_VERSION` setzen (`document.title = …`), die Angabe in
`index.html` entfernen.

### 14. React in devDependencies vs. eingecheckte Vendor-Kopien
**Fundstelle:** `package.json:21-22` vs. `app/vendor/react*.min.js`
**Kritikalität:** LOW
**Grund:** Zur Laufzeit zählt nur `app/vendor/`; die npm-Pakete dienen offenbar nur als
Update-Quelle. Ohne dokumentierten Prozess driftet die Vendor-Version unbemerkt von `^18.3.1` ab.
**Lösung:** Kurzes `npm run update:vendor`-Script (kopiert aus `node_modules` nach `app/vendor`)
plus README-Absatz; alternativ die devDependencies entfernen.

### 15. Keine Content-Security-Policy
**Fundstelle:** `index.html`
**Kritikalität:** LOW
**Grund:** Die App rendert ausschließlich über React (kein `dangerouslySetInnerHTML` im
App-Code – gut), eine CSP wäre dennoch ein günstiges zweites Netz, zumal die App im
SharePoint-Kontext läuft.
**Lösung:** `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' https://*.sharepoint.com; style-src 'self' 'unsafe-inline'">`
(Inline-Style-Block in `index.html` berücksichtigen bzw. auslagern).

### 16. `alert()` statt Toast-System für Formular-Validierung
**Fundstelle:** `app/app.jsx:2129,2135` (Projekt-Formular)
**Kritikalität:** LOW
**Grund:** Die App besitzt ein globales Toast-System (laut Changelog v0.84 bewusst eingeführt);
native `alert()`-Dialoge brechen die UX und blockieren den Event-Loop.
**Lösung:** Validierungsfehler über das bestehende Toast-/Inline-Fehler-Pattern ausgeben.

### 17. 640-Zeilen-Changelog als String-Literal in `config.js`
**Fundstelle:** `app/config.js:90-640` (`CHANGELOG_CONTENT`)
**Kritikalität:** LOW
**Grund:** Bläht das Config-Modul auf (wird bei jedem Seitenaufruf geparst) und vermischt
Inhalt mit Konfiguration.
**Lösung:** In `CHANGELOG.md` auslagern und per `fetch` lazy laden, wenn der Nutzer den
Changelog öffnet.

---

## Positiv hervorzuheben

- Durchdachte Sync-Härtung: ETag/If-Match-Konflikterkennung, `meta.json` als Commit-Marker,
  Wipe-Guards (`wouldWipe`), Append-Merge fürs Audit-Log, Retry mit Backoff und
  Digest-Deduplizierung.
- Sicherheitsbewusstsein im Detail: Backup-Import-Sanitizer mit Key-Whitelist,
  Session-Validierung aus `sessionStorage`, `validateSharePointUrl` gegen SSRF/Open-Redirect,
  Rejection-Sampling beim Initial-PIN, PBKDF2-Migration mit Legacy-Pfad.
- Kein `dangerouslySetInnerHTML`/`eval` im App-Code; React-Escaping deckt XSS weitgehend ab.
- Ausführliche, ehrliche Kommentare, die Invarianten und Bug-Historie dokumentieren.

## Empfohlene Reihenfolge

1. Finding 1 (Backdoor entfernen) – kleiner Diff, größter Sicherheitsgewinn.
2. Findings 2+3 gemeinsam entscheiden (Sicherheitsmodell dokumentieren oder härten).
3. Finding 5 (CI-Build-Check) + Finding 4 (erste Unit-Tests) – schützt alle weiteren Änderungen.
4. Findings 6–12 als normale Wartungs-PRs; LOW-Findings opportunistisch.
