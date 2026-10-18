# Mathe-Quidditch – Flug zum Hauspokal

**Dein Besen. Dein Köpfchen. Dein Hauspokal.** Ein deutschsprachiges Mathe-Flugspiel für Kinder ab etwa zehn Jahren: Drei Flugbahnen führen durch ein magisches Stadion. Fliege durch das Tor mit der richtigen Antwort und sammle Punkte für den Hauspokal.

## Spielen

1. Wähle dein Haus, eine oder mehrere Rechenarten, den Zahlenraum und das Starttempo.
2. Klicke auf **Flug starten**. Löse die eingeblendete Aufgabe und wechsle zur passenden Antwortspur.
3. Beim Erreichen der Tore wird die gewählte Antwort auf dem Server geprüft. **Besenboost** verkürzt den Anflug ohne Punkteabzug.
4. Bei jeder richtigen Antwort erscheinen der goldene Schnatz und jubelnde Zuschauer auf beiden Seiten. Bei 10, 20, 30 und allen weiteren zehn richtigen Antworten wirkt deine Figur zusätzlich einen Zauber.
5. Nach einer falschen Antwort reagiert das Publikum mit einem enttäuschten „Ohhh“, während der Besen sanft landet. Die richtige Lösung erscheint zusammen mit deinem Ergebnis. Trage einen Namen ein und speichere deinen Flug in der dauerhaften Bestenliste.

Es ist keine Anmeldung nötig. Der zuletzt gespeicherte Name wird im Browser für den nächsten Eintrag gemerkt. Die Bestenliste zeigt die besten drei Flüge und nach dem Speichern deinen eigenen Rang. Gespeicherte Namen sind für alle sichtbar, die diese Spielinstanz verwenden; ein Spitzname genügt.

## Steuerung

| Aktion | Tastatur | Smartphone / Tablet |
| --- | --- | --- |
| Spur nach links / rechts | Pfeil links / rechts oder **A / D** | Große Spurflächen unter dem Spielfeld |
| Mittlere Spur | Pfeil nach unten oder **S** | Mittlere Spurfläche |
| Besenboost | Pfeil nach oben oder **W** | **Besenboost** |
| Pause / fortsetzen | **P** oder **Escape** | Pausenknopf |
| Vollbild | Vollbildknopf | Vollbildknopf, sofern vom Browser unterstützt |

Spieleffekte und Hintergrundmusik sind getrennt schaltbar. Musik ist beim ersten Start ausgeschaltet. Fünf echte Stadionaufnahmen mit kräftigen Jubelrufen, Applaus und Pfiffen sorgen für euphorische Belohnungen. Die Auswahl erfolgt zufällig: Jeder der fünf Sounds kommt einmal pro gemischtem Durchlauf vor, ohne direkte Wiederholung zwischen den Durchläufen. Die leise, eigenständig erzeugte Fantasy-Musik mit flotten **132 BPM**, das enttäuschte Publikums-„Ohhh“ und der Zauberklang liegen ebenfalls lokal im Projekt. Pause und der Wechsel zu einem anderen Browser-Tab halten Flug, Belohnung, Aufgabenzeit und Audio an. Nach der Rückkehr lässt sich der Flug bewusst fortsetzen. Bei der Systemeinstellung „Bewegung reduzieren“ werden Animationen vereinfacht.

## Rechenregeln, Zeit und Punkte

- **Addition und Subtraktion:** Zahlenräume bis 20, 100 oder 1.000; alle Operanden und Ergebnisse bleiben im gewählten Bereich. Subtraktionen haben keine negativen Ergebnisse.
- **Multiplikation:** kleines Einmaleins mit Faktoren von 1 bis 10.
- **Division:** passende Umkehrungen des kleinen Einmaleins, ohne Rest und ohne Division durch null.
- Jedes Tor erhält einen anderen Antwortwert. Genau eine der drei Antworten ist richtig.

| Starttempo | Zeit pro Aufgabe | Grundpunkte je richtiger Antwort |
| --- | --- | --- |
| Entspannt | 10 Sekunden | 80 |
| Normal | 7,5 Sekunden | 100 |
| Schnell | 5 Sekunden | 125 |

Ab Aufgabe 10 sinkt die Aufgabenzeit alle zehn Aufgaben um 0,5 Sekunden, bis mindestens 2,5 Sekunden übrig bleiben. Der Punktefaktor beginnt mit ×1 und steigt ab Aufgabe 11, 21, 31 usw. jeweils um 0,25. Punkte werden als `round(Grundpunkte × Punktefaktor)` vergeben. Jede richtige Antwort zählt 100 Meter Flugstrecke. Der Besenboost verkürzt die verbleibende Zeit auf höchstens 0,9 Sekunden; Punkte und Faktor bleiben gleich.

Die nächste Aufgabe beginnt erst nach der Belohnungsphase: 1,2 Sekunden nach einer normalen richtigen Antwort beziehungsweise 1,7 Sekunden nach einem Meilenstein. Schnatz und Jubel dauern etwa eine Sekunde, der zusätzliche Zauber etwa 1,5 Sekunden. Wiederholte Anfragen erhalten dieselbe Antwortbestätigung und Belohnungskennung; sie erhöhen weder Punktestand noch Meilensteinzähler erneut. Ein neuer Durchlauf beginnt bei null.

Die Aufgaben, richtige Lösungen, Fristen, Antwortprüfung, Punkte und Bestenliste verwaltet ausschließlich der Server. Nach Ablauf der Aufgabenzeit besteht eine Transporttoleranz von 1,5 Sekunden für die bereits gewählte Antwort. Der Browser übermittelt diese automatisch beim Erreichen der Tore.

**Hinweis zur Ausgangsbasis:** Im bereitgestellten Repository befand sich kein Quellcode der beschriebenen „Mathe-Rally“. Diese Anwendung ist eine Neuimplementierung. Die oben genannten Zeit- und Punktewerte sind deshalb die hier festgelegten Regeln; ein Abgleich mit den bisherigen Formeln war nicht möglich.

## Lokal starten

Voraussetzung ist **JDK 27**, die stabile Java-Version zum Umsetzungszeitpunkt. Ein separat installiertes Maven ist dank Maven Wrapper nicht erforderlich. Der erste Build lädt Maven 3.9.16 sowie die Bibliotheken aus Maven Central; danach liefert die Anwendung alle Browserressourcen lokal aus.

Windows / PowerShell:

```powershell
$env:JAVA_HOME = 'C:\Pfad\zum\jdk-27'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\mvnw.cmd spring-boot:run
```

Linux / macOS:

```bash
export JAVA_HOME=/pfad/zum/jdk-27
export PATH="$JAVA_HOME/bin:$PATH"
chmod +x mvnw
./mvnw spring-boot:run
```

Öffne anschließend [http://localhost:8080](http://localhost:8080). Für den Zugriff vom Smartphone verwende im selben Netzwerk die IP-Adresse des Rechners und den konfigurierten Port.

Ein ausführbares JAR bauen und starten:

```bash
./mvnw verify
java -jar target/mathe-quidditch-1.0.0.jar
```

## Tests und Prüfung

```powershell
.\mvnw.cmd verify
```

```bash
./mvnw verify
```

Die automatischen Tests prüfen Aufgaben in allen Zahlenräumen und Rechenarten, unterschiedliche Antwortwerte, Punkte und Tempo, Pausen und Zeitablauf, Boost, wiederholte Antworten, Belohnungen bis zum 30. Treffer, Neustart sowie Speicherung und Rangfolge der Highscores. Die Tests verwenden eine steuerbare Uhr und isolierte H2-Datenbanken. Die produktive Datei unter `data/` wird dabei nicht verwendet.

Steuerung, Canvas-Animation und Audio lassen sich zusätzlich mit Node.js ohne weitere Pakete prüfen:

```bash
node --test scripts/*.test.mjs
```

Diese Tests prüfen WASD und Pfeiltasten, die einmalige Darstellung einer Belohnung, eingefrorene Animationen bei Pause und verborgenem Tab, den Neustart sowie gültige Zeichenkoordinaten und lesbare Antwortwerte bei Smartphone- und Desktopgrößen. Audio-Tests prüfen zusätzlich stummgeschaltete Effekte, die zufällige Auswahl aller fünf Jubelvarianten ohne direkte Wiederholung, den einmaligen Fehlerklang, Musik, angehaltene Audiowiedergabe und aufgeschobene Publikumsklänge.

Für eine manuelle Prüfung Desktop und Smartphone öffnen: alle drei Spuren sowie Boost betätigen, richtige und falsche Antworten spielen, Ton und Musik umschalten, während Aufgabe und Belohnung pausieren und den Tab wechseln. Die Meilensteine bei 10, 20 und 30 Treffern sind zusätzlich serverseitig getestet. Die technischen Prüfergebnisse und Einschränkungen stehen in [VERIFICATION.md](VERIFICATION.md).

## Konfiguration und Daten

| Umgebungsvariable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `8080` | HTTP-Port der Anwendung |
| `DATABASE_URL` | `jdbc:h2:file:./data/mathe-quidditch;DB_CLOSE_ON_EXIT=FALSE` | H2-Dateidatenbank |
| `DATABASE_USER` | `sa` | Datenbankbenutzer |
| `DATABASE_PASSWORD` | leer | Datenbankkennwort |

Highscores bleiben in `data/mathe-quidditch.mv.db` auch nach einem Neustart erhalten. Sichere den Datenordner bei gestoppter Anwendung. Laufende Spiele liegen im Arbeitsspeicher, gehören zur jeweiligen Browsersitzung und enden bei einem Serverneustart. Seit 24 Stunden unbenutzte Durchläufe werden beim Anlegen neuer Flüge entfernt. Es gibt keine zusätzlichen Ein- oder Ausgabeordner. Die H2-Webkonsole ist deaktiviert.

## Docker

Das Dockerfile baut die Anwendung mit JDK 27 und startet das JAR als Benutzer ohne Rootrechte. Docker muss lokal installiert sein.

Eigenes Image bauen und starten:

```bash
docker build -t mathe-quidditch:local .
docker run -d \
  --name mathe-quidditch \
  -p 8089:8080 \
  -v mathe-quidditch-data:/app/data \
  mathe-quidditch:local
```

Beispiel für ein **bereits veröffentlichtes Image**; `ghcr.io/dein-name/mathe-quidditch:latest` ist ein **anzupassender Registry-Platzhalter**. Dieses Repository veröffentlicht selbst kein Image.

```bash
IMAGE=ghcr.io/dein-name/mathe-quidditch:latest

docker rm -f mathe-quidditch 2>/dev/null

docker run -d \
  --name mathe-quidditch \
  --pull=always \
  -p 8089:8080 \
  -v mathe-quidditch-data:/app/data \
  "$IMAGE"
```

**8089 ist der Port am Host, 8080 der Port im Container.** Das Spiel ist damit unter [http://localhost:8089](http://localhost:8089) erreichbar. Das benannte Volume `mathe-quidditch-data` speichert die Datenbank dauerhaft unter `/app/data`, auch wenn der Container neu erstellt wird.

Alternativ einen Host-Ordner einbinden:

```bash
mkdir -p ./quidditch-data
docker run -d \
  --name mathe-quidditch \
  --pull=always \
  -p 8089:8080 \
  --mount type=bind,source="$(pwd)/quidditch-data",target=/app/data \
  "$IMAGE"
```

Der Host-Ordner muss für den Containerbenutzer schreibbar sein. Unter Linux lässt sich die verwendete UID mit `docker run --rm --entrypoint id "$IMAGE" -u` ermitteln und der Ordner gezielt diesem Benutzer zuweisen. Unter Docker Desktop muss der Ordner zur Dateifreigabe verfügbar sein. Keine zusätzliche H2-Instanz auf dieselbe Datenbankdatei zugreifen lassen.

## Aufbau und lokale Medien

- Java 27, Spring Boot 4.1.1, Maven Wrapper, Basispaket `de.agiehl`.
- REST-API für Durchläufe und Highscores, Spring JDBC und eingebettetes H2.
- HTML, CSS und JavaScript mit Canvas-Flugdarstellung; Bootstrap 5.3.8 als WebJar.
- Lokal gebündelte Schriften **Cinzel** und **Nunito**, jeweils unter SIL Open Font License; Lizenztexte stehen bei den Schriftdateien.
- KI-generierte Stadionillustration und prozedural animierte Spielfigur, Zuschauer, Tore, Schnatz und Zauber.
- Fünf bearbeitete echte Stadionjubel aus **Free Crowd Cheering Sounds** von **Gregor Quendel**, veröffentlicht unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Quelle, Lizenz und Bearbeitung sind in [den Audioquellen](src/main/resources/static/assets/audio/ATTRIBUTION.txt) dokumentiert und im Spiel verlinkt.
- Eigene synthetische Musik, Publikums-„Ohhh“ und Zauberklang; mit `python scripts/generate_audio.py` ohne zusätzliche Python-Bibliotheken reproduzierbar. Die echten Jubeldateien werden dabei erhalten. Mit `python scripts/prepare_cheers.py --download` lassen sich die Jubeldateien aus der dokumentierten Quelle erneut aufbereiten; hierfür sind Internetzugriff und FFmpeg erforderlich. Sind die Originalaufnahmen bereits unter `artifacts/audio-sources/gregor-quendel/` vorhanden, genügt der Aufruf ohne `--download`.
- Durchgehend UTF-8, Spring-Boot-Banner deaktiviert.

Fanprojekt ohne Verbindung zu den Rechteinhabern von Harry Potter / Quidditch. Die Musik verwendet keine Filmmelodien oder fremde Tonaufnahmen.
