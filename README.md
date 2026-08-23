# 365 Grundbesitz — Relaunch (lokaler Stand)

Statische Website ohne Build-Prozess. HTML, CSS und ein JavaScript ohne
Framework und ohne externe Bibliotheken. Alle Schriften und Bilder liegen lokal.

---

## Lokal starten

```bash
cd /Users/tg/Desktop/365-relaunch && python3 serve.py
```

Danach im Browser: `http://localhost:4365`

Bitte **nicht** `python3 -m http.server` verwenden: der eingebaute Server
sendet bei HTML keinen Zeichensatz mit, manche Browser raten dann falsch und
zeigen „PersÃ¶nlich" statt „Persönlich". `serve.py` setzt UTF-8 explizit und
liefert die richtigen MIME-Typen für WebP, MP4 und woff2.

Die Seite funktioniert auch per Doppelklick auf `index.html` (`file://`),
weil alle Daten als JavaScript-Dateien eingebunden sind und kein `fetch()`
verwendet wird.

---

## Was du selbst pflegst

Alles Inhaltliche liegt in `data/`. Dafür ist kein HTML nötig.

| Datei | Inhalt |
|---|---|
| `data/site.js` | Google-Bewertungszahl, Sterne-Schnitt, Telefonnummern, E-Mail, Formular-Endpunkt, Tracking-Schalter |
| `data/reviews.js` | Google-Bewertungen für Laufband und Kundenstimmen |
| `data/objekte.js` | Referenzobjekte und aktuelle Angebote |
| `data/videos.js` | Eigentümervideos – ein echtes Video ist eingebunden |

### Google-Bewertungen ergänzen

Alle **30 Bewertungen** sind in `data/reviews.js` erfasst: Name, Sterne (alle
fünf), Datum und Quelle. Zwei davon liegen im **deutschen Original** vor
(Marcel Krause, Marita Kwiotek — übernommen von der bisherigen Website).

**Achtung: der gelieferte Export war eine Übersetzung.** CSV und Excel
enthielten die Texte in spanischer Maschinenübersetzung — die Spaltenüber-
schrift sagt es selbst: „Text (Google-Übersetzung)". Nachweis: Marita Kwiotek
steht dort als *„Muchas gracias a la Sra. Becker por su asesoramiento
experto…"*, im Original aber als *„Vielen Dank an Frau Becker für die
fachgerechte, kompetente und freundliche Beratung…"*.

Diese Texte dürfen nicht auf die Website. Sie sind nicht das, was die Leute
geschrieben haben, und eine Rückübersetzung würde realen, namentlich
genannten Personen Worte in den Mund legen. Sie liegen deshalb nur im Feld
`nur_uebersetzung` zur Zuordnung und werden **nirgends angezeigt**.

**So kommen die Originale rein:** Google-Unternehmensprofil auf Deutsch
öffnen, oder in Google Maps bei der jeweiligen Bewertung auf „Originaltext
anzeigen". Dann je Eintrag in `data/reviews.js`:

```js
"text":        "Wortwörtlicher deutscher Text …",
"auszug":      "Kurzer wortwörtlicher Ausschnitt.",   // fürs Laufband
"zielgruppe":  "verkaeufer",   // verkaeufer | kaeufer | mieter | sonstige
"kontext":     "Verkauf eines Einfamilienhauses",
"ort":         "Dortmund",
"ticker":      true,
"testimonial": true,
"nur_uebersetzung": null       // danach nicht mehr gebraucht
```

Jede Bewertung mit gefülltem `text` erscheint sofort im durchblätterbaren
Bereich. Ab sechs Einträgen mit `ticker: true` startet zusätzlich das
Laufband unter dem Hero.

Zwei der 30 haben auch bei Google keinen Text (Rudi Ruessel, Philipp Deters) —
reine Sternebewertungen. Sie zählen mit, erscheinen aber nicht als Karte.

Die Gesamtzahl und der Sterneschnitt stehen in `data/site.js`.

---

## Kundenstimmen: durchblätterbar

Der Bereich „Was Eigentümer über die Zusammenarbeit sagen" ist ein Slider:
zwei Karten nebeneinander auf dem Desktop, eine auf dem Telefon. Vor- und
Zurück-Tasten, Punkte zum Direktanspringen, Zähler („3–4 von 18"),
Pfeiltasten, Wischen auf dem Telefon, und rechts ein Verweis auf das
Google-Profil. Karten außerhalb der Ansicht werden per `aria-hidden` aus der
Tabreihenfolge genommen.

---

## Formular scharf schalten

Aktuell läuft das Bewertungsformular im **Demo-Modus**: es validiert
vollständig, zeigt die Erfolgsmeldung, versendet aber nichts.

Für den Livebetrieb in `data/site.js`:

```js
form: { endpoint: 'https://…' }
```

Das Formular schickt dann ein JSON-POST mit den Feldern
`objektart, plz, ort, strasse, zeitraum, kontaktweg, vorname, nachname, email,
telefon, nachricht, einwilligung`.

`kontaktweg` ist entweder `E-Mail` oder `Telefon`. Bei `E-Mail` ist die
Telefonnummer optional und häufig leer — das ist gewollt.

---

## Tracking

Es ist **kein** Tracking-Skript fest eingebaut. Alle Events werden nur in
`window.dataLayer` geschrieben und können von einem bestehenden GTM/GA4-Setup
abgeholt werden — nachdem die Einwilligung vorliegt.

Events: `hero_cta_click`, `phone_click`, `whatsapp_click`,
`google_reviews_click`, `reference_click`, `testimonial_video_play`,
`valuation_form_start`, `valuation_form_step_2`, `valuation_form_step_3`,
`valuation_form_step_4`, `valuation_form_submit`.

Zum Mitlesen in der Konsole: in `data/site.js` `tracking.debug = true`.

---

## Zielgruppen-Kalibrierung

Der Auftritt ist bewusst auf Eigentümer ab ca. 55 Jahren ausgelegt, die eine
hochwertige Wohnimmobilie verkaufen. Daraus folgen mehrere Entscheidungen, die
nicht ohne Anlass zurückgedreht werden sollten:

- **Schriftgrößen.** Fließtext 18 px, Sekundärtext 16,5 px, Kontextzeilen 13 px.
  Gedämpfte Farbe bei rund 6:1 statt der geforderten 4,5:1. Presbyopie ist ab 45
  die Regel, die Kontrastempfindlichkeit sinkt ab 55 messbar. Kleine graue Texte
  wirken „modern", werden von der Zielgruppe aber schlicht nicht gelesen.
- **Kompetenznachweise** (`data/site.js` → `credentials`). Beantworten den
  häufigsten unausgesprochenen Einwand: „Kann sie eine Immobilie dieser
  Größenordnung?"
- **Diskrete Vermarktung** als eigene Sektion. Im gehobenen Segment ist
  Diskretion das eigentliche Unterscheidungsmerkmal gegenüber Portal-Maklern.
  Vorher stand das Thema nur in einer FAQ-Antwort.
- **„Für Sie bedeutet das"** in jedem Prozessschritt. Übersetzt Leistung in
  Entlastung. Die größte Sorge dieser Gruppe ist der Aufwand, nicht der Preis.
- **Formular für den langsamen Entscheider.** Zwischen erstem Besuch und Mandat
  liegen in diesem Segment oft 6–12 Monate. Die Telefonnummer ist deshalb
  optional; Standard ist „Zunächst nur per E-Mail". Wer den Anruf fürchtet,
  bricht sonst ab.
- **FAQ „Woran binde ich mich?"** Die Frage nach der Vertragsbindung ist eine
  der größten Hürden vor der Entscheidung.

---

## Offene Punkte vor dem Livegang

1. **Google-Bewertungen** — 27 fehlen noch (siehe oben).
2. **Google-Profil-URL** — in `data/site.js` die direkte Profil-URL statt der
   Such-URL eintragen. Solange dort nur zwei von 30 Bewertungen sichtbar sind,
   muss die Zahl mit einem Klick überprüfbar sein.
3. **Dritter Kompetenznachweis** — in `data/site.js` → `credentials` die echte
   Zahl vermittelter Immobilien und das Gründungsjahr eintragen. Der Eintrag
   erscheint automatisch, sobald `value` gesetzt ist.
4. **Vertragskonditionen** — im FAQ „Woran binde ich mich?" die tatsächliche
   Laufzeit, Auftragsart und Ausstiegsregelung ergänzen (`index.html`, TODO im
   Code markiert).
5. **Nutzenzeilen bestätigen** — die sechs „Für Sie bedeutet das"-Sätze im
   Verkaufsprozess sind Leistungszusagen. Bitte einmal gegenlesen, ob alle
   zutreffen — besonders „Sie müssen bei den Besichtigungen nicht anwesend sein".
6. **Videorechte prüfen** — im Header läuft das Markenvideo, im Verkaufs-
   prozess ein stummer Ausschnitt aus dem Beratungsvideo. In beiden sind
   Kundinnen und Kunden zu sehen. Bitte sicherstellen, dass für die
   Veröffentlichung auf der Website Einverständniserklärungen vorliegen.
7. **Eigentümervideo beschriften** — das eingebundene Testimonial ist echtes
   Material, aber ohne belegte Angaben. In `data/videos.js` bitte Name des
   Eigentümerpaars (mit dessen Einverständnis), Objektart und Ort ergänzen.
   Bis dahin steht dort bewusst nur „Eigentümerpaar".
8. **Vita auf `leonie-becker.html`** — bewusst leer gelassen, weil keine
   belegten Angaben vorlagen.
9. **Datenschutzerklärung** — 1:1 vom alten Webflow-Auftritt übernommen und
   beschreibt noch das alte Setup. Muss vor dem Livegang an die tatsächliche
   Technik angepasst und rechtlich geprüft werden.
10. **Bildnachweis im Impressum** — der Hinweis „Freepik" stammt aus dem alten
   Impressum und ist zu bestätigen oder zu streichen.
11. **Case Studies** auf `referenzen.html` — Ausgangssituation → Strategie →
   Ergebnis → Eigentümerstimme, sobald echte Angaben vorliegen.

---

## Video und Bild

| Datei | Verwendung | Größe |
|---|---|---|
| `assets/video/hero-1280.mp4` / `-854` | Hintergrund im Header, stumm, Endlosschleife | 1,6 / 0,8 MB |
| `assets/video/beratung-1280.mp4` / `-854` | Verkaufsprozess, stumm, lädt erst beim Scrollen | 1,7 / 0,9 MB |
| `assets/video/eigentuemer-720.mp4` | Eigentümervideo, mit Ton, lädt erst bei Klick | 8,0 MB |

Die Hintergrundvideos laufen stumm, sind über den Button rechts unten
pausierbar und werden bei `prefers-reduced-motion` gar nicht erst geladen —
dann erscheint nur das Standbild. Außerhalb des Sichtfelds pausieren sie
automatisch.

Das Eigentümervideo hat eingebrannte Untertitel und ist auch ohne Ton
verständlich. Es lädt erst, wenn jemand auf Abspielen klickt.

Fotos von Leonie Becker stammen aus dem Shooting in `~/Desktop/Fotoshooting Leo`:
`leonie-hero` (stehend, Hero und Personenseite), `leonie-sitzend`
(Personenmarke), `leonie-gespraech` (Beratungssituation).

---

## Propstack-Anbindung

Der Schlüssel steht in `.env` (Rechte 600, in `.gitignore`, vom lokalen Server
gesperrt). Er wird nie ausgegeben und geht an curl über stdin, damit er nicht
in der Prozessliste steht.

### Was wo liegt

| Endpunkt | Ergebnis |
|---|---|
| `GET /units` | Objektliste, paginiert über `?per=50&page=n` |
| `GET /units/{id}` | vollständiges Objekt inkl. `title`, Texten und Bildern |
| `GET /property_statuses` | die acht Status des Mandanten |
| `GET /properties` | **nicht nutzbar** — leitet auf die Weboberfläche um |

`/brokers`, `/property_groups`, `/projects` und `/contacts` geben 401 zurück.
Für die Website wird davon nichts gebraucht.

### Zwei Skripte

```bash
python3 tools/propstack_check.py     # nur prüfen, schreibt einen Bericht
python3 tools/propstack_import.py    # Objekte und Bilder holen
```

Der Import schreibt `data/objekte-propstack.js` und legt die Bilder als WebP
unter `assets/img/propstack/` ab. Die Zuordnung steht oben im Skript:

```python
STATUS_ZUORDNUNG = {
    "Vermarktung":   "aktuell",
    "Abgeschlossen": "referenz",
}
```

Weitere Status ergänzt man dort mit einer Zeile, etwa `"In Vermarktung": "aktuell"`.

### Zwei Fallen, die im Skript abgefangen sind

**`property_space_value` ist nicht die Grundstücksfläche.** Das Feld spiegelt in
der API die Wohnfläche. Die echte Grundstücksfläche steht nur in
`optional_fields` unter „Grundstücksfläche ca.". Deshalb baut das Skript die
Eckdaten aus Propstacks eigenen, fertig formatierten Beschriftungen.

**In `optional_fields` stehen auch vertrauliche Angaben** — Gesamt-, Innen- und
Außenprovision, interne Bewertungsspannen, Sprengnetter-Links, Soll- und
Ist-Renditen. Ein einfaches Durchreichen würde die Provisionsstruktur
veröffentlichen. Übernommen wird deshalb ausschließlich die Positivliste
`ECKDATEN_ERLAUBT`; zusätzlich verwirft ein Sperrmuster alles, was nach
Provision, Bewertung oder Rendite aussieht. Beim Lauf listet das Skript auf,
welche Felder es verworfen hat.

Außerdem warnt der Import, wenn bei gesetztem `hide_address` die Straße im
Beschreibungstext auftaucht — das lässt sich nur in Propstack beheben.

### Live: die Objektseiten laufen aus Propstack

`index.html`, `referenzen.html` und `immobilien.html` laden
`data/objekte-propstack.js`. Die alte `data/objekte.js` bleibt als Sicherung
liegen, wird aber von keiner Seite mehr eingebunden.

Nach jeder Änderung in Propstack neu einlesen:

```bash
python3 tools/propstack_import.py
```

Das Skript lädt nur Bilder, die noch nicht lokal liegen — ein zweiter Lauf ist
also schnell. Objekte ohne Bild werden nicht übernommen.

---

## Aktueller Datenstand

| | Objekte |
|---|---|
| Aktuelle Immobilien (Status „Vermarktung") | 3 |
| Referenzen (Status „Abgeschlossen") | 18 |
| davon Verkäufe | 11 |
| Galeriebilder | 222 |

Die Referenzen stehen mit dem neuesten Abschluss oben. Objekte mit gepflegtem
Verkaufsdatum kommen zuerst, danach folgen die übrigen nach Anlagedatum.
Derzeit ist das Datum bei **6 von 18** Objekten gefüllt — wird es in Propstack
nachgetragen, sortiert der Import automatisch danach.

Die Startseite zeigt unter „Erfolgreich verkauft" nur Kauf-Referenzen.
Vermittelte Mietobjekte erscheinen ausschließlich auf der Referenzseite,
gekennzeichnet als VERMITTELT.

Offen in Propstack: „Gerhart-Hauptmann-Str. 8" steht noch auf „Inaktiv" und
hat keine Bilder; die Dublette „Hattinger Straße 775 – 26004x" wird vom Import
übersprungen, sollte aber gelöscht werden.

### Was der Import automatisch aussortiert

- Bilder mit **eingebranntem Exposé-Rahmen** (orange Balken mit Logo und
  www-Adresse) — beim letzten Lauf 20 Stück
- Bilder mit `is_private` oder `is_not_for_exposee`
- Dubletten mit identischem Titel und Preis
- Objekte ohne verwendbares Bild
- alle Felder außerhalb von `ECKDATEN_ERLAUBT`

Fehlt eine Bildgröße, weil das Original zu klein ist, wird sie erzeugt statt
übersprungen — sonst zeigt die Website auf eine Datei, die es nicht gibt.
Am Ende jedes Laufs prüft das Skript alle Pfade gegen die Platte.

---

## Objekt-Detailansicht

Alle Objektkarten sind gleich hoch aufgebaut: Bild, Objektart, Titel (2 Zeilen),
Beschreibung (3 Zeilen) und der Link am Fuß liegen über alle Karten hinweg auf
derselben Höhe, unabhängig von der Textlänge.

Jede Objektkarte auf `referenzen.html` und `immobilien.html` öffnet über
„Alle Angaben ansehen" ein Fenster im Aufbau einer Exposé-Seite: großes Bild
über die volle Breite, Bildleiste darunter, dann Titel und Preis, danach
Beschreibung und Lage links und eine mitlaufende Eckdaten-Spalte rechts mit
Ansprechpartnerin und Kontaktwegen — ohne die Seite zu verlassen.

Alle Inhalte kommen aus `data/objekte.js` (`galerie`, `fakten`,
`beschreibung`, `lage`) und sind unverändert von den bestehenden
Objektseiten übernommen. Escape schließt, Pfeiltasten blättern in der Galerie.

Nicht übernommen wurde der zweite Faktenblock der alten Objektseiten
(Wohneinheiten, Heizung, Zimmer, Balkon). Er lag nur in verwürfelter
Reihenfolge vor — eine falsche Zuordnung wäre schlimmer als die Lücke.

---

## Aufbau

```
serve.py              lokaler Vorschau-Server (UTF-8, richtige MIME-Typen)
tools/propstack_check.py  Lesetest der Propstack-API (ändert nichts)
.env                  Zugangsdaten, nicht weitergeben
index.html            Startseite (13 Sektionen inkl. Video-Header)
referenzen.html       Verkaufserfolge mit Filtern
immobilien.html       Aktuelle Angebote
leonie-becker.html    Personenseite
impressum.html
datenschutz.html

assets/css/base.css        Tokens, Reset, Typografie, Buttons
assets/css/components.css  Komponenten in Reihenfolge der Startseite
assets/js/main.js          Header, Laufband, FAQ, Formular, Objektlisten
assets/fonts/              Newsreader + Inter, selbst gehostet
assets/img/                Logo, Leonie, Objektbilder, Galerie (WebP)
assets/video/              Header-Loop, Beratungs-Loop, Eigentümervideo
data/                      Inhalte
```

### Farben

| Token | Wert | Verwendung |
|---|---|---|
| `--c-orange` | `#FF4D01` | Markenorange: Logo, Linien, Sterne, Zahlen, Hover |
| `--c-orange-cta` | `#D93F00` | Gefüllte Buttons und Badges mit weißer Schrift (4,51:1) |
| `--c-ink` | `#16181A` | Fließtext und Überschriften |
| `--c-paper` | `#FBF9F6` | Grundfläche |
| `--c-dark` | `#191B1D` | Dunkle Sektionen und Footer |

Weiße Schrift auf `#FF4D01` erreicht nur 3,33:1 und ist deshalb für Buttons
nicht zulässig — dafür ist `--c-orange-cta` da. Das reine Markenorange bleibt
unverändert für alle Flächen ohne kleinen Text.

### Schriften

Newsreader in zwei statischen optischen Größen (Display 72 für große
Headlines, Text 16 für Zitate und Zahlen) plus Inter als variable Schrift.
Zusammen rund 93 KB statt 176 KB — und kein Google-Fonts-CDN, damit keine
IP-Adressen an Google übertragen werden.
