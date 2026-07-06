# Status & offene Punkte – Planner 3.1

Ein Dokument als zentrale Quelle für: was wurde geprüft, was ist erledigt, was ist
bewusst zurückgestellt und warum. Ersetzt die vormals getrennten Dateien
`CODE_REVIEW.md`, `docs/SECURITY.md` und `docs/SYNC-OPTIMIERUNG.md` (deren Inhalt
ist hier eingearbeitet und aktualisiert).

Stand: 2026-07-06, App-Version v0.91.

---

## 1. Sicherheit — offen, bewusst vor Produktivbetrieb zurückgestellt

**Entscheidung vom 2026-07-02:** Sicherheit wird in der Testphase bewusst
vernachlässigt. Die folgenden Punkte müssen vor einem Einsatz mit echten
Personaldaten erneut bewertet und behoben werden.

### S1 – Hardcodierte Admin-Hintertür (CRITICAL, weiterhin offen)
**Fundstelle:** `app/utils.js:315-329` (`_R_S`, `_R_H`, `verifyAdminPin`), aufgerufen
aus `app/modals.jsx:1145` beim Login.
Im Client-Quellcode liegt ein permanentes Backup-Passwort, das für jeden
Admin-Account zusätzlich zum selbst gesetzten PIN akzeptiert wird. Salt und
PBKDF2-Hash sind öffentlich (Client-Code) und offline brute-forcebar. Die
Hintertür ist nicht widerrufbar — ein PIN-Wechsel über die UI deaktiviert sie
nicht — und umgeht Login-Lockout und Audit-Log.
**Vor Produktivbetrieb:** `_R_S`/`_R_H` und den zweiten Prüfpfad in
`verifyAdminPin` entfernen. Break-Glass-Alternative: `users.json` löschen → der
First-Init-Flow erzeugt einen neuen Admin mit zufälligem Initial-PIN.

### S2 – Autorisierung existiert nur im Client (HIGH, weiterhin offen)
**Fundstelle:** Architektur — Login in `app/modals.jsx`, Datenzugriff in
`app/sharepoint.js`.
PIN-Prüfung, Rollen und Lockout laufen ausschließlich im Browser. Alle
Datendateien (inkl. `users.json` mit PIN-Hashes) liegen in einem
SharePoint-Ordner, auf den jeder App-Nutzer lesend **und schreibend**
zugreifen kann — sonst würde der Sync nicht funktionieren. Jeder Nutzer kann
daher PIN-Hashes auslesen, `users.json` direkt editieren (Selbst-Eskalation
zum Admin) oder Daten am UI vorbei ändern. Die Login-Schicht ist Komfort/UX,
keine Sicherheitsgrenze.
**Vor Produktivbetrieb:** Entweder (a) explizit als Design festhalten
("echte Zugriffskontrolle = SharePoint-Ordnerberechtigungen") und die
Ordnerrechte entsprechend einschränken, oder (b) Schreibzugriffe über eine
serverseitige Komponente kapseln.

### S3 – 4-stellige PINs mit lesbaren Hashes (HIGH, weiterhin offen)
**Fundstelle:** `app/utils.js` (PIN-Hashing), `users.json` (SharePoint + Backups).
PBKDF2-SHA256 mit 100k Iterationen ist solide, hilft aber bei einem Keyspace
von nur 10.000 Kombinationen nicht: Wer `users.json` lesen kann (siehe S2),
brute-forct jeden PIN offline in Sekunden.
**Vor Produktivbetrieb:** Mindest-PIN-Länge auf 6–8 Stellen anheben oder
alphanumerische Passphrase erlauben; alternativ zusammen mit S2(a) als
bewusste Einschränkung dokumentieren.

### S4 – PIN-Hashes in Remote-Stores und Backups (MEDIUM, weiterhin offen)
`users.json` wird nach SharePoint/FS synchronisiert und liegt in den
zeitgestempelten Backups unter `planner-data/backups/`. Der Export über
"System & Export" strippt die Hashes bereits (`stripUserSecrets`), die
Backups nicht.
**Vor Produktivbetrieb:** Entscheiden, ob Backups `appUsers` überhaupt
enthalten müssen; falls ja, Zugriff auf den Backup-Ordner einschränken.

### S5 – Keine Content-Security-Policy (LOW, weiterhin offen)
**Fundstelle:** `index.html`. Kein `dangerouslySetInnerHTML`/`eval` im
App-Code (React-Escaping greift), eine CSP wäre dennoch ein günstiges
zweites Netz.
**Vor Produktivbetrieb:** `<meta http-equiv="Content-Security-Policy" …>`
ergänzen (mindestens `default-src 'self'; connect-src 'self'
https://*.sharepoint.com`).

### S6 – Lizenz-Metadaten (Hinweis, weiterhin offen)
`package.json:18` deklariert `"license": "ISC"` (Open Source), `index.html`
enthält den Header "Alle Rechte vorbehalten". `"private": true` ist gesetzt;
die Lizenzangabe selbst wurde bisher bewusst nicht angefasst. Vor einer
Weitergabe/Veröffentlichung des Repos klären.

### Bereits vorhandene Schutzmaßnahmen (zur Einordnung)
- PIN-Hashing mit PBKDF2-SHA256 + per-User-Salt, transparente Migration von
  Legacy-Hashes/Plaintext-PINs.
- Login-Lockout (5 Fehlversuche → 60 s Sperre).
- Backup-Import-Sanitizer: Key-Whitelist, `appUsers` wird verworfen,
  Zeilen-Guards, Größen-Caps, Ablehnung neuerer Schema-Versionen
  (`validateImportedState`, per Unit-Test abgedeckt).
- Session-Restore-Validierung gegen manipulierte `sessionStorage`-Einträge
  (`validateRestoredSession`, getestet).
- `validateSharePointUrl` erzwingt HTTPS + `*.sharepoint.com`
  (SSRF-/Redirect-Schutz).
- Initial-Admin-PIN via CSPRNG mit Rejection-Sampling.

---

## 2. Code-Qualität — erledigt vs. offen

Ursprünglich als Review des Codestands vor v0.90 entstanden; Status jetzt
gegen den aktuellen Code (v0.91) geprüft.

### Erledigt seit dem ursprünglichen Review
| # | Punkt | Status |
|---|---|---|
| 4 | Keine automatisierten Tests | ✅ 43 Unit-Tests (`tests/*.test.js`), `npm test` |
| 5 | `app/dist` ohne Konsistenz-Prüfung | ✅ CI-Check in `.github/workflows/ci.yml` vergleicht Build gegen committeten Stand |
| 6 | Team-Namen ungeprüft in Dateinamen | ✅ `isValidTeamName` (`app/utils.js`) validiert Eingabe in `setup-cats.jsx` |
| 7 | Toter Code (`spSave`, `spGetTimestamp`, `fsSave`, `injectAdmin`) | ✅ entfernt |
| 8 | Wochenvergleich per String statt `compareWeekIds` | ✅ behoben in `app/app.jsx:2242` |
| 13 | Versions-Drift `index.html` vs. `config.js` | ✅ Titel wird zur Laufzeit aus `APP_VERSION` gesetzt (`app/app.jsx:622`) |
| 16 | `alert()` statt Toast/Inline-Validierung | ✅ vollständig ersetzt (keine `alert()`-Aufrufe mehr im Code) |
| 11 | Stilles Verschlucken von Fehlern | ✅ größtenteils behoben (Logging in `filesync.js` ergänzt); verbleibende leere `catch(e){}` in `sharepoint.js:168,211` sind unkritisches Cleanup (iframe entfernen / Popup schließen) |
| 12 | `package.json`: lokale Proxy-URL, fehlendes `private` | ✅ Repository-URL korrigiert, `"private": true` gesetzt (Lizenzangabe selbst siehe S6 oben) |

### Weiterhin offen
| # | Punkt | Fundstelle | Warum offen |
|---|---|---|---|
| 9 | Duplizierter SharePoint-Schreib-/Ordner-Code | `app/sharepoint.js:256` (`spEnsureFolder`), `:297` (`spSaveFile`), `:359` (`spSaveBackup`) — "Files/Add mit overwrite" und Best-Effort-Ordnererstellung existieren je zweimal | Nicht angefasst; reines Refactoring ohne Verhaltensänderung, niedrige Priorität |
| 10 | `app.jsx` als God-Component | `app/app.jsx`, inzwischen **2.858 Zeilen** (bei Review-Erstellung 2.677 — durch Spesen-Import/UX-Arbeit weiter gewachsen) | Sync-Engine, Auth, Backup-Scheduler und Projekt-Formular leben weiter in einer Datei. Empfehlung unverändert: Sync/Persistenz in `useSyncEngine`/`useAuth`/`useBackups`-Hooks extrahieren |
| 14 | React in devDependencies vs. eingecheckte Vendor-Kopien | `package.json` (`react: ^18.3.1`) vs. `app/vendor/react*.min.js` | Kein Update-Prozess dokumentiert; Vendor-Version kann unbemerkt abdriften |
| 15 | Keine Content-Security-Policy | `index.html` | Siehe S5 oben (Sicherheits-Fundstelle mit gleichem Inhalt) |
| 17 | 680-Zeilen-Changelog als String-Literal in `config.js` | `app/config.js:79-680` (`CHANGELOG_CONTENT`) — durch den v0.91-Eintrag weiter gewachsen | Bläht das Config-Modul auf; Auslagerung in `CHANGELOG.md` + Lazy-Load beim Öffnen des Changelog-Dialogs wäre sauberer, aber nicht dringend |

---

## 3. Synchronisation bei mehreren gleichzeitigen Nutzern

Analyse vom 2026-07-02, weiterhin gültig für v0.91 (an der Sync-Architektur
hat sich seither nichts geändert).

### Umgesetzt
- **Selektiver Audit-Merge statt Voll-Reload**: Ändert sich nur `audit.json`
  bei einem anderen Client, wird sie selektiv geladen und per
  `mergeAuditLogs` gemergt statt einen kompletten Reload aller Dateien
  auszulösen (vorher ~20 Requests pro Fremd-Edit, jetzt 2–3).
- **Kein Meta-Refresh bei No-Op-Saves**: Ein leerer Diff nach einem
  Remote-Update spart den `spGetFolderMeta`-Folgeaufruf.
- **Polling-Jitter (5 s ± 1 s)** statt starrem `setInterval`-Raster,
  verhindert synchrone Request-Bursts mehrerer Clients.
- **Sofort-Poll bei Tab-Rückkehr** statt bis zu 15 s Wartezeit im
  Idle-Back-off.

### Geprüft, bewusst NICHT umgesetzt
| Option | Nutzen bei 4 Nutzern | Warum (noch) nicht |
|---|---|---|
| Pre-Save-Freshness-Check | Reduziert 412-Konfliktrunden | ETag-Weg löst Konflikte bereits korrekt; kostet 1 Request pro Save auch im Normalfall — lohnt erst bei häufigen Konflikt-Toasts |
| REST-`$batch` für Voll-Reload | ~20 → 2 Requests | Voll-Reloads sind seit dem Audit-Fix selten; `$batch`-Parsing ist fehleranfällig, Aufwand/Nutzen ungünstig |
| Cross-Tab-Leader-Election | Halbiert Requests bei mehreren offenen Tabs pro Nutzer | Mehrere Tabs sind die Ausnahme im Team-Alltag; Heartbeat-Logik wäre aufwendig |
| Längerer Idle-Back-off | Weniger Idle-Last | Idle-Last ist schon gering; würde die gefühlte Aktualität verschlechtern |
| WebSocket/Push statt Polling | Latenz + Request-Reduktion | Ohne eigenes Backend auf SharePoint Online nicht verfügbar |

**Skalierungs-Einschätzung:** Bis ~10 Nutzer unkritisch. Ab >20 Nutzern oder
sehr hoher Edit-Frequenz zuerst Pre-Save-Freshness-Check nachrüsten, danach
`$batch`/Leader-Election oder eine echte Backend-Lösung erwägen.

---

## 4. UX/UI — bewusst zurückgestellt

Aus dem UX-Audit (2026-07-05/06) explizit nicht umgesetzt bzw. nur als Idee
genannt, ohne Entscheidung des Nutzers:

- **Mobile-/Tablet-Optimierung der Planungs-Tabellen** (Ressourcen/Projekte/
  Timeline). Diese Ansichten sind auf Desktop-Breite ausgelegt; unter
  ~1000px wird es eng. Eigenes, größeres Thema.
- **Eigener Datums-Picker** für die `type="date"`-Felder im Kostenpunkt-
  Dialog und im Spesen-Import. Bewusst nativ belassen (echte
  Tagesauswahl, kein Kalenderwochen-Fall wie beim neuen `WeekPickerInput`).
- **Timeline-Projektsuche**: Die Timeline hat bereits Virtualisierung und
  eigene Navigation; ein zusätzliches Suchfeld war nicht Teil des Audits.
- **Card-Grid statt Tabelle** in der Projektverwaltung (Kachel-Ansicht mit
  Farbe/Status statt Zeilen) — nur als Idee genannt.
- **Dashboard-Charts** in der Übersicht (z. B. Auslastungsverlauf als
  Mini-Chart neben den Stat-Karten) — nur als Idee genannt.
- **Dark Mode** — die App ist komplett hell gehalten, kein Toggle vorhanden.
- **Command-Palette (⌘K)** zum schnellen Springen zwischen Ansichten — nur
  als Idee genannt, keine Sidebar-Suche vorhanden.

Keiner dieser Punkte wurde umgesetzt; sie liegen als Vorschlagsliste vor und
warten auf eine Priorisierungsentscheidung.

---

## Empfohlene Reihenfolge, falls weitergearbeitet wird

1. **Vor jedem Produktiveinsatz mit echten Daten:** Abschnitt 1 (Sicherheit)
   komplett durchgehen, mindestens S1 (Backdoor entfernen).
2. **Nächste sinnvolle Code-Aufräumarbeit:** #10 (`app.jsx` aufteilen) —
   größter Hebel für Wartbarkeit, da die Datei stetig weiterwächst.
3. **Bei Bedarf:** UX-Ideen aus Abschnitt 4 einzeln mit dem Nutzer
   priorisieren, bevor sie umgesetzt werden.
