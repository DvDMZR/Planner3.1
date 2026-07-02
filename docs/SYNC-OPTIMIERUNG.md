# SharePoint-Synchronisation bei ~4 gleichzeitigen Nutzern

Analyse vom 2026-07-02 (v0.90). Bewertet die bestehende Sync-Architektur unter der
Annahme von ca. 4 gleichzeitig aktiven Editoren, dokumentiert die jetzt umgesetzten
Optimierungen und die noch offenen Optionen.

## 1. Ausgangslage: Request-Profil

**Polling (Lesen):** Jeder sichtbare Tab stellt eine Folder-Meta-Anfrage
(`GetFolderByServerRelativeUrl(...)/Files?$select=Name,TimeLastModified,ETag`, eine
einzige Anfrage für alle Dateien). Grundtakt 5 s, adaptiver Back-off auf ~15 s nach
1 Minute Ruhe, Pause bei verstecktem Tab.
→ 4 Nutzer ≈ **16–48 Requests/min** gesamt. Das ist weit unterhalb der
SharePoint-Online-Throttling-Grenzen und unkritisch.

**Speichern (Schreiben):** Debounce 1,5 s; `saveSplitState` schreibt nur Dateien,
deren Inhalt sich geändert hat (Diff gegen letzten Save); max. 4 parallele Writes;
`meta.json` als letzter Commit-Marker; ETag/If-Match gegen stille Überschreibungen;
Konflikt (412) → Remote-Reload + Toast, Abbruch nach 3 Konflikten in Folge.

**Der eigentliche Engpass war nicht das Request-Volumen, sondern die
Reaktion der anderen Clients auf einen Save** – siehe 2.1.

## 2. Umgesetzte Optimierungen (dieser Stand)

### 2.1 Selektiver Audit-Merge statt Voll-Reload (größter Hebel)

Jede Planungsänderung schreibt über `logAudit` auch `audit.json`. Da `audit.json` zu
den globalen Dateien (`GLOBAL_DATA_FILES`) zählte, löste **jeder Edit eines Kollegen
bei allen anderen Clients einen Voll-Reload aus**: `loadSplitStateSp` lädt dann
meta + 7 globale Dateien + 2 Dateien pro Team – bei 6 Teams ~20 Requests pro Client
pro Fremd-Edit. Bei 4 aktiven Editoren multipliziert sich das schnell zu hunderten
Requests/min und erhöht das Fenster für ETag-Konflikte.

**Neu:** Ist `audit.json` die einzige geänderte globale Datei, wird sie selektiv
geladen und per `mergeAuditLogs` (Union per Eintrags-ID, deterministisch sortiert
und gekappt) in den lokalen State gemergt – zusammen mit dem bereits bestehenden
selektiven Reload der Team-Dateien. Ein typischer Fremd-Edit kostet die anderen
Clients jetzt **2–3 Requests statt ~20**. Die Diff-Basis (`lastSaved`) wird auf das
Merge-Ergebnis gesetzt, damit kein Echo-Write entsteht.

### 2.2 Kein Meta-Refresh bei No-Op-Saves

`saveSplitState` meldet jetzt, ob überhaupt Dateien geschrieben wurden. Remote
angestoßene State-Änderungen (Polling-Updates) triggern den Save-Effekt, dessen Diff
dann leer ist – bisher folgte trotzdem ein `spGetFolderMeta`-Refresh. Der entfällt
jetzt: **1 Request weniger pro empfangenem Fremd-Edit und Client.**

### 2.3 Polling-Jitter (5 s ± 1 s)

Vorher tickten alle Clients in einem starren `setInterval(5000)`-Raster – Clients, die
zur ähnlichen Zeit geladen wurden, feuerten ihre Requests dauerhaft synchron
(Thundering Herd; SharePoint bewertet Bursts fürs Throttling ungünstiger als
gleichmäßige Last). Jetzt plant sich jeder Poll selbst mit 4–6 s Zufallsabstand neu –
die Clients laufen automatisch auseinander. Gilt für SharePoint- und FS-Polling.

### 2.4 Sofort-Poll bei Tab-Rückkehr

Ein versteckter Tab pausiert das Polling (Bestand). Neu: Beim Zurückwechseln in den
Tab wird sofort gepollt und der Idle-Back-off zurückgesetzt, statt bis zu 15 s auf
den nächsten Tick zu warten – Änderungen der Kollegen sind ohne spürbare Verzögerung da.

## 3. Geprüft, bewusst NICHT umgesetzt (mit Begründung / Trigger)

| Option | Nutzen bei 4 Usern | Warum (noch) nicht |
|---|---|---|
| **Pre-Save-Freshness-Check** (vor dem Schreiben einmal Folder-Meta prüfen, bei Remote-Änderung erst reloaden, dann speichern) | Reduziert 412-Runden: Konflikt wird erkannt, bevor Payloads hochgeladen werden | Der ETag-Weg löst Konflikte bereits korrekt; der Check kostet 1 Request pro Save auch im Normalfall. Lohnt erst, wenn Konflikt-Toasts im Alltag häufig werden |
| **REST-`$batch`** für den Voll-Reload (alle `spLoadFile`-GETs in einer Anfrage) | Voll-Reload ~20 → 2 Requests | Voll-Reloads sind nach 2.1 selten (nur noch bei Änderungen an employees/projects/settings/users/Kategorien). `$batch`-Parsing (multipart) ist fehleranfällig; Aufwand/Nutzen derzeit ungünstig |
| **Cross-Tab-Leader-Election** (nur ein Tab pro Browser pollt, Verteilung über den bestehenden `storage`-Event) | Halbiert Requests bei Nutzern mit mehreren offenen Tabs | Mehrere Tabs derselben App sind im Team-Alltag die Ausnahme; Leader-Failover (Tab-Crash) braucht sorgfältige Heartbeat-Logik |
| **Längerer Idle-Back-off** (z. B. 60 s nach 5 min Ruhe) | Weniger Idle-Last | Idle-Last ist schon gering (~4 Req/min/Tab); längerer Back-off verschlechtert die gefühlte Aktualität nach der Rückkehr. Der Sofort-Poll bei Tab-Rückkehr (2.4) entschärft nur den Visibility-Fall, nicht den „Tab sichtbar, aber inaktiv"-Fall |
| **WebSocket/Push statt Polling** | Latenz + Request-Reduktion | Ohne eigenes Backend auf SharePoint Online nicht verfügbar (Webhooks brauchen einen erreichbaren Endpoint) |

## 4. Skalierungs-Einschätzung

- **4 Nutzer:** Nach den Maßnahmen unter 2. unkritisch. Erwartete Last:
  Polling 16–48 Req/min gesamt, pro Edit ~3–6 zusätzliche Requests systemweit.
- **~10 Nutzer:** Weiterhin unkritisch; als Erstes „Pre-Save-Freshness-Check"
  nachrüsten, wenn Konflikt-Toasts häufiger auftreten.
- **>20 Nutzer / hohe Edit-Frequenz:** Polling-Architektur stößt an gefühlte
  Grenzen (Konfliktfenster von bis zu ~5–6 s). Dann `$batch` und Leader-Election
  umsetzen oder auf eine echte Backend-Lösung (SharePoint-Webhooks + Service) wechseln.

## 5. Betriebs-Hinweise

- Der Sidebar-Sync-Status zeigt Konflikte an („Änderung eines Kollegen übernommen").
  Häufen sich diese Meldungen, zuerst prüfen, ob mehrere Personen im selben Team
  planen – die Team-Datei-Aufteilung (`assignments-<Team>.json`) entfaltet ihren
  Nutzen nur, wenn Editoren überwiegend in „ihren" Teams arbeiten.
- `conflict-loop` (3 Konflikte in Folge) ist ein bewusster Stopp: Seite neu laden.
- Throttling (HTTP 429/503) wird mit Retry-After-Backoff behandelt
  (`spFetchWithRetry`); tritt es trotzdem sichtbar auf, zuerst die Anzahl offener
  Planner-Tabs pro Nutzer reduzieren.
