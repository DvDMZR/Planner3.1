# Sicherheits-Findings – Planner 3.1

**Status: In der Testphase bewusst zurückgestellt** (Entscheidung vom 2026-07-02).
Diese Punkte sind dokumentiert und müssen **vor einem produktiven Einsatz mit echten
Personaldaten** erneut bewertet und adressiert werden. Details und Fundstellen siehe
auch `CODE_REVIEW.md`.

---

## S1 – Hardcodierte Admin-Hintertür (CRITICAL)

**Fundstelle:** `app/utils.js` (`_R_S`, `_R_H`, `verifyAdminPin`)

Im Client-Quellcode liegt ein permanentes Backup-Passwort, das für jeden Admin-Account
zusätzlich zum selbst gesetzten PIN akzeptiert wird. Salt und PBKDF2-Hash sind öffentlich
(Client-Code); der Klartext ist offline brute-forcebar. Die Hintertür ist nicht
widerrufbar – ein PIN-Wechsel über die UI deaktiviert sie nicht – und umgeht
Login-Lockout und Audit-Log.

**Vor Produktivbetrieb:** `_R_S`/`_R_H` und den zweiten Prüfpfad in `verifyAdminPin`
entfernen. Break-Glass-Alternative: `users.json` löschen → der First-Init-Flow erzeugt
einen neuen Admin mit zufälligem Initial-PIN, der einmalig angezeigt wird.

## S2 – Autorisierung existiert nur im Client (HIGH)

**Fundstelle:** Architektur (Login in `app/modals.jsx`, Datenzugriff in `app/sharepoint.js`)

PIN-Prüfung, Rollen (`admin`/`active`) und Lockout laufen ausschließlich im Browser.
Alle Datendateien (`planner-data/*.json`, inkl. `users.json` mit PIN-Hashes) liegen in
einem SharePoint-Ordner, auf den jeder App-Nutzer lesend **und schreibend** zugreifen
kann – sonst würde der Sync nicht funktionieren. Jeder Nutzer kann daher PIN-Hashes
auslesen, `users.json` direkt editieren (Selbst-Eskalation zum Admin) oder Daten am UI
vorbei ändern. Die Login-Schicht ist Komfort/UX, keine Sicherheitsgrenze.

**Vor Produktivbetrieb:** Entweder (a) explizit als Design festhalten
("echte Zugriffskontrolle = SharePoint-Ordnerberechtigungen") und die Ordnerrechte auf
den tatsächlichen Nutzerkreis einschränken, oder (b) Schreibzugriffe über eine
serverseitige Komponente (z. B. Azure Function / Power Automate) kapseln.

## S3 – 4-stellige PINs mit lesbaren Hashes (HIGH)

**Fundstelle:** `app/utils.js` (PIN-Hashing), `users.json` (SharePoint + Backups)

PBKDF2-SHA256 mit 100k Iterationen ist solide, hilft aber bei einem Keyspace von nur
10.000 Kombinationen nicht: Wer `users.json` lesen kann (siehe S2), brute-forct jeden
PIN offline in Sekunden.

**Vor Produktivbetrieb:** Mindest-PIN-Länge auf 6–8 Stellen anheben oder alphanumerische
Passphrase erlauben; alternativ zusammen mit S2(a) als bewusste Einschränkung dokumentieren.

## S4 – PIN-Hashes in Remote-Stores und Backups (MEDIUM)

`users.json` (mit `pinHash`/`pinSalt`) wird nach SharePoint/FS synchronisiert und liegt
in den zeitgestempelten Backups unter `planner-data/backups/`. Der Export über
"System & Export" strippt die Hashes bereits (`stripUserSecrets`), die Backups nicht.

**Vor Produktivbetrieb:** Entscheiden, ob Backups `appUsers` überhaupt enthalten müssen;
falls ja, Zugriff auf den Backup-Ordner wie in S2(a) einschränken.

## S5 – Keine Content-Security-Policy (LOW)

**Fundstelle:** `index.html`

Der App-Code verwendet kein `dangerouslySetInnerHTML`/`eval` (React-Escaping greift),
eine CSP wäre dennoch ein günstiges zweites Netz.

**Vor Produktivbetrieb:** `<meta http-equiv="Content-Security-Policy" …>` ergänzen
(mindestens `default-src 'self'; connect-src 'self' https://*.sharepoint.com`;
Inline-Style-Block in `index.html` dabei berücksichtigen).

## S6 – Lizenz-Metadaten (Hinweis, kein Sicherheitsthema)

`package.json` deklariert `ISC` (Open Source), der Header in `index.html` "Alle Rechte
vorbehalten". Vor einer Weitergabe des Repos klären; `"private": true` ist inzwischen
gesetzt, die Lizenzangabe selbst wurde bewusst nicht angefasst (Entscheidung des Urhebers).

---

## Bereits umgesetzte Schutzmaßnahmen (Bestand)

Zur Einordnung – diese Punkte sind vorhanden und getestet:

- PIN-Hashing mit PBKDF2-SHA256 + per-User-Salt, transparente Migration von
  Legacy-Hashes und Plaintext-PINs.
- Login-Lockout (5 Fehlversuche → 60 s Sperre).
- Backup-Import-Sanitizer: Key-Whitelist, `appUsers` wird verworfen, Zeilen-Guards,
  Größen-Caps, Ablehnung neuerer Schema-Versionen (`validateImportedState`, getestet).
- Session-Restore-Validierung gegen manipulierte `sessionStorage`-Einträge
  (`validateRestoredSession`, getestet).
- `validateSharePointUrl` erzwingt HTTPS + `*.sharepoint.com` (SSRF-/Redirect-Schutz).
- Initial-Admin-PIN via CSPRNG mit Rejection-Sampling.
- localStorage-Kopie des States wird ohne PIN-Hashes geschrieben (`stripUserSecrets`).
