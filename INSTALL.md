# Atlas einrichten (Schritt für Schritt)

Atlas ist ein Sprachassistent für Android. Jede Person bekommt ihre **eigene Kopie**: eigene Webseite, eigene Daten, eigene Schlüssel. Nichts wird mit anderen geteilt.

Du brauchst etwa eine Stunde und vier kostenlose Konten: **GitHub**, **Vercel**, **Upstash** und **Groq**. Ein Android-Handy mit Chrome.

## 1. Kopie anlegen (GitHub)
1. Bei github.com ein Konto anlegen und anmelden.
2. Auf diese Seite gehen und oben rechts auf **Fork** tippen, dann **Create fork**.
   Du hast jetzt eine eigene Kopie unter deinem Namen.

## 2. Speicher anlegen (Upstash)
1. Bei upstash.com ein Konto anlegen.
2. **Redis**, **Create database**. Name egal, Region in Europa (zum Beispiel Frankfurt), Gratis-Tarif.
3. Auf der Seite der Datenbank unter **REST API** stehen zwei Werte: `UPSTASH_REDIS_REST_URL` und `UPSTASH_REDIS_REST_TOKEN`. Beide kopieren (Taste „Copy“) und aufheben.

## 3. Webseite starten (Vercel)
1. Bei vercel.com mit dem GitHub-Konto anmelden (Hobby-Tarif ist kostenlos).
2. **Add New**, **Project**, deine Kopie „Atlas-Vorlage“ auswählen, **Import**.
3. Bei **Environment Variables** drei Einträge anlegen:
   - `ATLAS_SECRET`: ein langes Passwort, mindestens 8 Zeichen. Das tippst du später in der App ein. Gut aufheben!
   - `UPSTASH_REDIS_REST_URL`: der Wert aus Schritt 2
   - `UPSTASH_REDIS_REST_TOKEN`: der Wert aus Schritt 2
4. **Deploy**. Danach zeigt Vercel die Adresse deiner Seite, zum Beispiel `https://atlas-deinname.vercel.app`. Aufheben.

## 4. App bauen (GitHub)
1. In deiner Kopie bei GitHub: **Settings**, **Secrets and variables**, **Actions**, Reiter **Variables**, **New repository variable**.
   Name: `ATLAS_URL`, Wert: die Adresse aus Schritt 3 **mit einem Schrägstrich am Ende** (`https://atlas-deinname.vercel.app/`).
2. Reiter **Actions**: falls GitHub fragt, **I understand my workflows, go ahead and enable them** antippen.
3. Links **Atlas APK**, rechts **Run workflow**, **Run workflow**. Der Bau dauert etwa 5 Minuten.
4. Danach in deiner Kopie rechts unter **Releases** die neueste Version öffnen und **Atlas.apk** laden.
5. Auf dem Handy antippen und installieren. Android fragt einmal, ob Installationen aus dieser Quelle erlaubt sind: erlauben.

## 5. Erster Start
1. Atlas öffnen, das Passwort aus Schritt 3 eingeben.
2. Der **Einrichtungsassistent** startet. Er fragt Name, Wohnort, Arbeit und die Zugänge.
   - **Groq** ist Pflicht (console.groq.com, API Keys, kostenlos). Ohne den Schlüssel kann Atlas nicht antworten.
   - Alles andere ist freiwillig. Zu jedem Zugang steht, was er kostet und wo man ihn bekommt.
   - Ohne Fish-Audio-Schlüssel spricht Atlas mit der Stimme des Handys.
3. Mikrofon und Standort erlauben. Hey Atlas, WhatsApp und Parkplatz schaltest du später über die Kacheln auf dem Startbildschirm ein.

## Updates bekommen
Wenn es eine neue Version der Vorlage gibt:
1. In deiner Kopie bei GitHub auf **Sync fork**, dann **Update branch**.
2. Vercel baut die Webseite von selbst neu. Atlas bekommt dadurch sofort die neuen Funktionen.
3. Hat sich auch die App selbst geändert, baut GitHub automatisch eine neue APK. In Atlas erscheint unten die Meldung „Es gibt eine neue Version“. Auf **Laden** tippen und installieren.

## Wenn etwas hakt
- **Passwort geht nicht:** Es muss genau das aus `ATLAS_SECRET` sein. Im Vercel-Projekt unter Settings, Environment Variables nachsehen.
- **Der Bau bricht ab mit „FEHLT: ATLAS_URL“:** Schritt 4.1 nachholen.
- **Atlas antwortet nicht:** Der Groq-Schlüssel fehlt oder ist falsch. Zahnrad auf dem Startbildschirm, dort neu eintragen und testen.
- **Assistent noch einmal starten:** Zahnrad, dort „Einrichtungsassistent noch einmal starten“.

## Gut zu wissen
- Deine Daten (Name, Adresse, Notizen, Schlüssel) liegen nur in **deiner** Datenbank bei Upstash und in **deinem** Vercel-Projekt.
- Die Schlüssel werden verschlüsselt gespeichert.
- Der Signatur-Schlüssel der App wird beim ersten Bau erzeugt und in deiner Kopie unter `signatur/` abgelegt. Löschst du ihn, lässt sich die App nicht mehr überinstallieren.
- Mach deine Kopie am besten **privat** (GitHub, Settings, Danger Zone, Change visibility), dann ist auch der Signatur-Schlüssel nicht öffentlich. Die Update-Meldung in der App funktioniert dann allerdings nicht mehr, weil sie das öffentliche Projekt abfragt.
