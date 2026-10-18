# Prüfprotokoll

Stand: 18. Oktober 2026. Geprüft unter Windows mit Temurin JDK 27, Maven Wrapper 3.9.16 und Spring Boot 4.1.1.

## Automatische Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `mvnw.cmd -B -ntp clean verify` | 24 Java-Tests erfolgreich; ausführbares Spring-Boot-JAR erstellt |
| `node --test scripts/*.test.mjs` | 33 JavaScript-Tests erfolgreich |
| JavaScript-Syntax | Alle drei Browsermodule ohne Syntaxfehler |
| Projektdateien | UTF-8 geprüft |
| Lokale Ressourcen | HTML, Bootstrap-WebJar, Schriften, Stadion und WAV-Dateien werden lokal ausgeliefert |

Die Java-Tests decken 6.000 erzeugte Aufgaben ab, alle Rechenarten und Zahlenräume, genau eine richtige Antwort, serverseitige Punkte und Fristen, Tempoanstieg, Boost, Pause in Aufgabe und Belohnung, Transporttoleranz, falsche Antworten, neue Durchläufe sowie Meilensteine bei 10, 20 und 30 Treffern. Eine Parallelprüfung sendet dieselbe Antwort gleichzeitig 24-mal und bestätigt genau eine Punktevergabe. HTTP-Tests prüfen die Browsersitzung, tatsächliche Antwortbestätigung, identische Wiederholungsantworten und die Ablehnung gefälschter Punktestände. Highscore-Tests prüfen Top 3, Rang außerhalb der Top 3, Namensnormalisierung einschließlich Unicode sowie die erneute Öffnung einer H2-Dateidatenbank.

Die JavaScript-Tests verwenden isolierte Canvas- und WebAudio-Doubles sowie VM-Prüfungen der tatsächlichen Tastatur- und Snapshot-Handler. Sie prüfen Belohnungskennungen, Animationen in allen Phasen und bei reduzierter Bewegung, gültige Zeichenkoordinaten auf schmalen und breiten Flächen, alle Hausfarben, das Ende des gesamten gestaffelten Jubels vor der nächsten Aufgabe, Pause und verborgene Tabs, Musik standardmäßig aus, getrennte Lautstärkeschalter, Meilensteinklang sowie Abbruch alter Audiowiedergaben beim Neustart. Zusätzlich sind WASD und Pfeiltasten, Großbuchstaben, Spurränder, geschützte Eingabefelder, Modifier und Tastenwiederholung sowie der einmalige Fehlerklang bei wiederholten Serverantworten und sein Verhalten bei Pause, Stummschaltung und Neustart geprüft. Die fünf Jubelsounds werden unabhängig von den drei visuellen Varianten zufällig gemischt: Die Tests bestätigen alle fünf Sounds pro Durchlauf, unterschiedliche Reihenfolgen und keine direkte Wiederholung an der Durchlaufgrenze. Der Java-Test mit 30 richtigen Antworten bestätigt die Folge der drei visuellen Varianten.

Die fünf neuen Jubeldateien sind bearbeitete Ausschnitte echter Stadionaufnahmen von Gregor Quendel (CC BY 4.0). Sie dauern jeweils 1,15 Sekunden und liegen als PCM16 in Stereo mit 44.100 Hz vor. Hochpass, leichte Kompression, kurze Fades und Pegelanpassung erhalten die menschlichen Rufe und passen sie an die Belohnungsphase an. Quelle, Lizenz, Ausschnitte und Bearbeitung stehen in `src/main/resources/static/assets/audio/ATTRIBUTION.txt`; `scripts/prepare_cheers.py` prüft die Originalaufnahmen anhand ihrer SHA256-Prüfsummen. Musik, Publikums-„Ohhh“ und Zauberklang bleiben synthetische Monoaufnahmen mit 22.050 Hz und maximal 72 % Pegel ohne Clipping. Das „Ohhh“ dauert 1,45 Sekunden. Der Musikloop hat 132 BPM und dauert 16 Takte beziehungsweise rund 29,091 Sekunden.

## Browserprüfung

Getestet im eingebetteten Chromium-Browser bei **1440 × 1000** und **390 × 844 CSS-Pixeln**. Die Anwendung wurde sowohl mit `spring-boot:run` als auch als ausführbares JAR auf Port 8095 gestartet. Port 8080 war auf diesem Rechner bereits belegt.

- Ein vollständiger Durchlauf erreichte 30 richtige Antworten: **3.750 Punkte, 3.000 Meter** bei normalem Starttempo. Die Meilensteine erschienen bei genau 10, 20 und 30 Treffern; dazwischen erschien die normale Belohnungsbestätigung.
- Die richtige Antwort wurde jeweils aus der sichtbaren Aufgabe berechnet, die passende der drei Spuren angeklickt und die Antwort mit dem Besenboost angeflogen. Antwortnummern auf Toren und Touchflächen stimmten überein.
- Auf Smartphonebreite gab es keinen horizontalen Seitenüberlauf. Die Aufgabe, drei Antworttore, blaue beziehungsweise rote Flugfigur und die Touchflächen blieben sichtbar. Für größere Punktestände wurden die mobilen HUD-Abstände angepasst.
- Pause und Weiterfliegen wurden während Aufgabe und Meilenstein benutzt. Pfeil rechts, **P** und **Escape** funktionierten; Vollbild ließ sich ein- und ausschalten.
- Die Schalter für Effekte und Musik wurden getrennt umgeschaltet. Mit ausgeschalteten Effekten blieb die sichtbare Belohnung aktiv.
- Nach einem Fehler erschien die richtige Lösung. Der Flug wurde unter **Testflug** gespeichert und mit eigenem Rang 1 sowie in der Bestenliste angezeigt. Der Name war nach dem Neuladen vorausgefüllt.
- Ein neuer Durchlauf begann wieder bei Aufgabe 1 mit null Punkten und null Metern.
- Nach einem echten Serverneustart blieb der gespeicherte Flug in H2 erhalten. Das Fortsetzen eines alten Durchlaufs führte mit verständlichem Hinweis zurück zum Startbildschirm.
- Während der regulären Spielprüfung meldete die Browserkonsole keine JavaScript-Fehler.

Screenshots der geprüften Desktop- und Smartphoneansicht liegen lokal unter `artifacts/desktop.jpg` und `artifacts/mobile.jpg`. Der Ordner wird nicht versioniert.

Die ergänzende Browserprüfung der WASD-Version bestätigte A/D für relative Spurwechsel, S für die Mitte und W für den Boost auf 0,9 Sekunden sowie Pause und Fortsetzen. Eine absichtlich falsche Antwort zeigte anschließend die korrekte Lösung. Die Tastaturhinweise passten im Desktoplayout. Die lokale Instanz auf Port 8095 verwendet eine Laufzeitkopie unter `artifacts/runtime/`, um die Build-Datei unter `target/` freizuhalten.

Nach dem Austausch des Jubels wurden alle acht WAV-Dateien im neu gebauten JAR und über HTTP mit ihren Quelldateien per SHA256 verglichen. Die entfernte sechste Jubeldatei liefert HTTP 404; die Audioquellen und die neue Zufallsauswahl werden korrekt ausgeliefert. Die fünf Stereo-Jubel erreichen jeweils −12,04 dBFS RMS und höchstens −1,36 dBFS Spitzenpegel ohne Clipping. Eine Prüfung auf überlappende Aufnahmen fand zunächst einen doppelten Jubelmoment, der ersetzt wurde; die abschließende höchste paarweise Korrelation beträgt 0,233. Eine gemeinsame Hörprobe aller fünf Sounds liegt unter `artifacts/jubel-preview.wav`. Die aktualisierte Version läuft auf Port 8095.

## Grenzen der Prüfung

- Die Smartphonegröße wurde im Desktop-Browser geprüft. Es fand kein Leistungstest auf einem physischen Smartphone statt; konkrete Bildraten sind deshalb nicht bestätigt.
- Das eingebettete Browserwerkzeug löste beim programmatischen Wechsel zwischen seinen Tabs kein verlässliches `visibilitychange` aus. Das Verhalten bei verborgenem Dokument wurde deshalb in den isolierten Animations- und Audiotests geprüft; zusätzlich sind die Serverpausen getestet. Ein echter Tabwechsel in Safari oder Chrome auf einem Mobilgerät steht als Geräteprüfung aus.
- WebAudio wurde funktional mit Doubles und über die Browser-Schalter geprüft. Eine subjektive Hörprüfung auf unterschiedlichen Lautsprechern fand nicht statt.
- Docker ist auf diesem Rechner nicht installiert. Dockerfile, Datenpfade und README-Befehle sind vorbereitet; die Basis-Tags `eclipse-temurin:27-jdk` und `27-jre` wurden in der offiziellen Registry bestätigt. Ein tatsächlicher Container-Build wurde nicht ausgeführt.
- Im Ausgangsrepository war kein Code der früheren „Mathe-Rally“ vorhanden. Zeit- und Punktewerte sind daher die in der README dokumentierten neu festgelegten Regeln.
