#!/usr/bin/env python3
"""
Propstack -> Website: Objekte holen und aufbereiten.

    cd /Users/tg/Desktop/365-relaunch && python3 tools/propstack_import.py

Das Skript liest ausschließlich (GET) und ändert nichts in Propstack.
Der API-Schlüssel bleibt hier: er wird nie ausgegeben, nie protokolliert und
landet nicht in der erzeugten Datei. Ausgeliefert wird an den Browser nur das
fertige Ergebnis.

Ergebnis
  data/objekte-propstack.js      Objektdaten im Format der Website
  assets/img/propstack/…         Bilder als WebP in drei Größen

Zuordnung (siehe STATUS_ZUORDNUNG unten)
  Status „Vermarktung"   -> Aktuelle Immobilien
  Status „Abgeschlossen" -> Referenzen
"""

from __future__ import annotations

import html as html_mod
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BILD_DIR = os.path.join(ROOT, "assets", "img", "propstack")
ZIEL = os.path.join(ROOT, "data", "objekte-propstack.js")

# ---------------------------------------------------------------- Einstellungen

# Welcher Propstack-Status landet in welchem Bereich der Website.
# Weitere Status einfach ergänzen, z. B. "In Vermarktung": "aktuell".
STATUS_ZUORDNUNG = {
    "Vermarktung":   "aktuell",
    "Abgeschlossen": "referenz",
}

# Objekte mit identischem Titel und Preis nur einmal übernehmen
DOPPELTE_UEBERSPRINGEN = True

# Einzelne Propstack-Objekte bewusst nicht auf die Website übernehmen.
# Hier stehen die Propstack-IDs; ein erneuter Import respektiert sie.
AUSGESCHLOSSEN = {
    5229709,   # Molkereistraße 1, Ladenlokal (vermietet) — ersetzt durch den
               # Verkauf Molkereistraße 1 (id 5229678, 690.000 €)
}

BILD_BREITEN = [480, 800, 1200]     # Kartenbilder
GALERIE_BREITEN = [480, 1200]       # Bilder in der Detailansicht
MAX_GALERIE = 12

ART_NAME = {
    "HOUSE": "Haus", "APARTMENT": "Wohnung", "INVESTMENT": "Anlageobjekt",
    "STORE": "Ladenlokal", "OFFICE": "Büro", "GASTRONOMY": "Gastronomie",
    "PLOT": "Grundstück", "HALL": "Halle", "PARKING": "Stellplatz",
    "SHORT_TERM_ACCOMODATION": "Wohnen auf Zeit",
}
# ---------------------------------------------------------------------------
# WICHTIG: In Propstacks `optional_fields` stehen auch vertrauliche Angaben —
# Gesamt-, Innen- und Außenprovision, interne Bewertungsspannen, Sprengnetter-
# Links, Soll-/Ist-Mieten und Renditen. Deshalb wird ausschließlich diese
# Positivliste übernommen. Ein neues Feld erscheint erst, wenn es hier steht.
# Reihenfolge = Reihenfolge in der Eckdaten-Karte.
# ---------------------------------------------------------------------------
ECKDATEN_ERLAUBT = [
    "Wohnfläche ca.",
    "Grundstücksfläche ca.",
    "Nutzfläche ca.",
    "Vermietbare Fläche ca.",
    "Gewerbefläche ca.",
    "Zimmer",
    "Anzahl Schlafzimmer",
    "Anzahl Badezimmer",
    "Etage",
    "Etagenzahl",
    "Baujahr ca.",
    "Letzte Modernisierung",
    "Objektzustand",
    "Bodenbelag",
    "Heizungsart",
    "Wesentlicher Energieträger",
    "Energieausweistyp",
    "Energieeffizienzklasse",
    "Endenergiebedarf",
    "Energieverbrauchskennwert",
    "Keller",
    "Balkon / Terrasse",
    "Garten / -mitbenutzung",
    "Einbauküche",
    "Hausgeld/Monat",
    "Nebenkosten",
]

# Zweites Netz: taucht eines dieser Wörter in einem Label auf, wird es
# verworfen — selbst wenn es versehentlich in die Positivliste geriete.
ECKDATEN_GESPERRT = re.compile(
    r"provision|courtage|bewertung|sprengnetter|rendite|faktor|"
    r"nettomiete|mieteinnahm|translation missing|dossier|miteigentum",
    re.I)

ART_KATEGORIE = {
    "Haus": "haeuser", "Wohnung": "wohnungen", "Anlageobjekt": "mehrfamilienhaeuser",
    "Ladenlokal": "gewerbe", "Büro": "gewerbe", "Gastronomie": "gewerbe",
    "Halle": "gewerbe", "Grundstück": "sonstige", "Stellplatz": "sonstige",
}

# ----------------------------------------------------------------------- Zugang

def lade_env(pfad: str) -> dict:
    werte = {}
    if os.path.exists(pfad):
        for zeile in open(pfad, encoding="utf-8"):
            zeile = zeile.strip()
            if zeile and not zeile.startswith("#") and "=" in zeile:
                k, _, v = zeile.partition("=")
                werte[k.strip()] = v.strip().strip("'\"")
    return werte


ENV = lade_env(os.path.join(ROOT, ".env"))
BASE = (ENV.get("PROPSTACK_API_BASE_URL") or "https://api.propstack.de/v1").rstrip("/")
KEY = ENV.get("PROPSTACK_API_KEY") or ""


def api(pfad: str):
    """GET über curl. Der Schlüssel geht über stdin, nicht über die Kommandozeile."""
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        body = tmp.name
    try:
        cfg = [
            f'url = "{BASE}{pfad}"', f'output = "{body}"',
            "silent", "show-error", "max-time = 60",
            'write-out = "%{http_code}"',
            'header = "Accept: application/json"',
            f'header = "X-API-KEY: {KEY}"',
        ]
        proc = subprocess.run(["curl", "-K", "-"], input="\n".join(cfg) + "\n",
                              capture_output=True, text=True)
        code = int(proc.stdout.strip() or 0)
        text = open(body, encoding="utf-8", errors="replace").read()
        try:
            return code, json.loads(text)
        except json.JSONDecodeError:
            return code, None
    finally:
        try:
            os.unlink(body)
        except OSError:
            pass


def datei_laden(url: str, ziel: str) -> bool:
    cfg = [f'url = "{url}"', f'output = "{ziel}"', "silent", "show-error",
           "max-time = 90", "location", 'write-out = "%{http_code}"']
    proc = subprocess.run(["curl", "-K", "-"], input="\n".join(cfg) + "\n",
                          capture_output=True, text=True)
    return proc.stdout.strip() == "200" and os.path.getsize(ziel) > 1024


def hat_exposé_rahmen(pfad: str) -> bool:
    """Erkennt den eingebrannten 365-Rahmen (orange Balken oben und unten).

    Diese Bilder stammen aus der Exposé-Erzeugung und tragen Logo und
    www-Adresse fest im Bild. Auf der Website wirken sie wie ein Wasserzeichen
    und passen nicht ins Layout — sie werden deshalb übersprungen.
    """
    try:
        from PIL import Image
        im = Image.open(pfad).convert("RGB")
    except Exception:
        return False
    w, h = im.size
    if w < 60 or h < 60:
        return False
    px = im.load()
    schritt = max(1, w // 90)
    spalten = list(range(0, w, schritt))

    def orange_anteil(y: int) -> float:
        treffer = 0
        for x in spalten:
            r, g, b = px[x, y]
            if r > 185 and 35 < g < 135 and b < 95:
                treffer += 1
        return treffer / len(spalten)

    rand = max(3, int(h * 0.07))
    oben = max(orange_anteil(y) for y in range(1, rand))
    unten = max(orange_anteil(y) for y in range(h - rand, h - 1))
    return oben > 0.7 or unten > 0.7


# ------------------------------------------------------------------ Textpflege

def text_saeubern(roh: str | None) -> list[str]:
    """Propstack liefert teils HTML aus dem Editor. Daraus saubere Absätze machen."""
    if not roh:
        return []
    t = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", roh)
    t = re.sub(r"(?i)<br\s*/?>", "\n", t)
    t = re.sub(r"(?i)</(p|div|li|h[1-6])>", "\n\n", t)
    t = re.sub(r"(?i)<li[^>]*>", "• ", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = html_mod.unescape(t)
    t = t.replace(" ", " ")
    absaetze = []
    for teil in re.split(r"\n\s*\n+", t):
        teil = re.sub(r"[ \t]+", " ", teil).strip()
        teil = re.sub(r"\s+([,.;:!?])", r"\1", teil)
        if len(teil) > 1:
            absaetze.append(teil)
    return absaetze


def titel_saeubern(t: str | None) -> str:
    if not t:
        return ""
    return re.sub(r"\s{2,}", " ", t.replace(" ", " ")).strip(" -–—")


def slug(text: str, kennung) -> str:
    s = unicodedata.normalize("NFKD", text.lower())
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:60].strip("-")
    return f"{s or 'objekt'}-{kennung}"


def preis_text(unit: dict) -> str | None:
    wert = unit.get("price") or unit.get("base_rent")
    if not wert:
        return None
    try:
        formatiert = format(int(round(float(wert))), ",d").replace(",", ".")
    except (TypeError, ValueError):
        return None
    return f"{formatiert} €" + (" / Monat" if unit.get("marketing_type") == "RENT"
                                and not unit.get("price") else "")


def kurzfassung(absaetze: list[str], maxlen: int = 175) -> str:
    if not absaetze:
        return ""
    text = absaetze[0]
    saetze = re.split(r"(?<=[.!?])\s+", text)
    aus = ""
    for satz in saetze:
        if not aus:
            aus = satz
            if len(aus) > maxlen + 60:
                aus = aus[:maxlen].rsplit(" ", 1)[0].rstrip(" ,;:–-") + " …"
            break
        if len(aus) + 1 + len(satz) <= maxlen:
            aus += " " + satz
        else:
            break
    return aus.strip()


# --------------------------------------------------------------------- Bilder

rahmen_uebersprungen = [0]


def bilder_verarbeiten(unit_id, bilder: list, praefix: str):
    """Lädt die freigegebenen Bilder und legt sie als WebP in mehreren Größen ab."""
    try:
        from PIL import Image, ImageOps
    except ImportError:
        print("  ! Pillow fehlt — Bilder werden übersprungen.")
        return [], []

    erlaubt = [b for b in bilder
               if isinstance(b, dict)
               and not b.get("is_private")
               and not b.get("is_not_for_exposee")]
    erlaubt.sort(key=lambda b: (b.get("position") if b.get("position") is not None else 999))
    fotos = [b for b in erlaubt if not b.get("is_floorplan")]
    grundrisse = [b for b in erlaubt if b.get("is_floorplan")]
    auswahl = (fotos + grundrisse)[:MAX_GALERIE + 8]

    os.makedirs(BILD_DIR, exist_ok=True)
    galerie, karte = [], None

    for i, bild in enumerate(auswahl):
        url = next((bild[k] for k in ("big_url", "url", "medium_url")
                    if isinstance(bild.get(k), str) and bild[k].startswith("http")), None)
        if not url:
            continue
        name = f"{praefix}-{i:02d}"
        basis = os.path.join(BILD_DIR, name)
        if all(os.path.exists(f"{basis}-{w}.webp") for w in GALERIE_BREITEN):
            galerie.append(f"assets/img/propstack/{name}")
            if karte is None and not bild.get("is_floorplan"):
                karte = name
            continue

        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            roh = tmp.name
        try:
            if not datei_laden(url, roh):
                continue
            if hat_exposé_rahmen(roh):
                rahmen_uebersprungen[0] += 1
                continue
            im = ImageOps.exif_transpose(Image.open(roh))
            breiten = sorted(set(GALERIE_BREITEN + (BILD_BREITEN if karte is None else [])))
            w0, h0 = im.size
            ziel_h = w0 / (3 / 2)
            if ziel_h <= h0:
                oben = (h0 - ziel_h) * 0.45
                zug = im.crop((0, round(oben), w0, round(oben + ziel_h)))
            else:
                ziel_w = h0 * (3 / 2)
                links = (w0 - ziel_w) / 2
                zug = im.crop((round(links), 0, round(links + ziel_w), h0))
            # Jede angeforderte Breite muss auch entstehen — sonst zeigt die
            # Website später auf eine Datei, die es nicht gibt. Kleine
            # Originale werden dafür maßvoll hochskaliert.
            for w in breiten:
                pfad = f"{basis}-{w}.webp"
                if os.path.exists(pfad):
                    continue
                if w > zug.width * 1.7:
                    breit = zug.width          # zu klein: nicht künstlich aufblasen
                else:
                    breit = w
                # Achtung: nicht "bild" nennen — das ist die Schleifenvariable
                # mit den Bild-Metadaten aus Propstack.
                ausgabe = zug.resize((breit, round(zug.height * breit / zug.width)), Image.LANCZOS)
                if breit != w:                  # Dateiname trotzdem bedienen
                    ausgabe = ausgabe.resize((w, round(ausgabe.height * w / ausgabe.width)), Image.LANCZOS)
                ausgabe.convert("RGB").save(pfad, "WEBP", quality=78, method=6)
            galerie.append(f"assets/img/propstack/{name}")
            if karte is None and not bild.get("is_floorplan"):
                karte = name
            if len(galerie) >= MAX_GALERIE:
                break
        except Exception as fehler:
            print(f"  ! Bild {i} übersprungen: {type(fehler).__name__}: {fehler}")
        finally:
            try:
                os.unlink(roh)
            except OSError:
                pass

    # Sicherstellen, dass das Kartenbild in allen Kartenbreiten vorliegt
    if karte:
        from PIL import Image
        for w in BILD_BREITEN:
            pfad = os.path.join(BILD_DIR, f"{karte}-{w}.webp")
            if os.path.exists(pfad):
                continue
            quelle = next((os.path.join(BILD_DIR, f"{karte}-{q}.webp")
                           for q in sorted(GALERIE_BREITEN, reverse=True)
                           if os.path.exists(os.path.join(BILD_DIR, f"{karte}-{q}.webp"))), None)
            if not quelle:
                break
            im = Image.open(quelle)
            b = min(w, im.width)
            im.resize((b, round(im.height * b / im.width)), Image.LANCZOS) \
              .save(pfad, "WEBP", quality=78, method=6)
    return galerie, karte


# ----------------------------------------------------------------------- Ablauf

def main() -> int:
    if not KEY:
        print("Kein PROPSTACK_API_KEY in der .env. Abbruch.")
        return 2

    print(f"Basis-URL: {BASE}")
    print("Schlüssel: gefunden (wird nicht ausgegeben)\n")

    # 1) Alle Objekte listen
    units, seite = [], 1
    while seite <= 20:
        code, daten = api(f"/units?per=50&page={seite}")
        if code != 200 or not isinstance(daten, list) or not daten:
            break
        units += daten
        if len(daten) < 50:
            break
        seite += 1
    print(f"Objekte in Propstack: {len(units)}")
    if not units:
        print("Keine Objekte erhalten — Berechtigungen prüfen.")
        return 1

    def statusname(u):
        s = u.get("status")
        return s.get("name") if isinstance(s, dict) and s else None

    print("Statusverteilung:", dict(Counter(statusname(u) or "(leer)" for u in units).most_common()))

    treffer = [u for u in units
               if statusname(u) in STATUS_ZUORDNUNG and u.get("id") not in AUSGESCHLOSSEN]
    uebergangen = [u for u in units
                   if statusname(u) in STATUS_ZUORDNUNG and u.get("id") in AUSGESCHLOSSEN]
    for u in uebergangen:
        print(f"  – bewusst ausgeschlossen: {u.get('id')} {u.get('name') or ''}")
    print(f"Für die Website vorgesehen: {len(treffer)}\n")

    objekte, gesehen, nicht_uebernommen = [], set(), []
    for u in treffer:
        bereich = STATUS_ZUORDNUNG[statusname(u)]
        code, det = api(f"/units/{u['id']}")
        if code != 200 or not isinstance(det, dict):
            print(f"  ! Detail für {u['id']} nicht abrufbar (HTTP {code})")
            continue

        titel = titel_saeubern(det.get("title")) or titel_saeubern(det.get("name"))
        preis = preis_text(det)
        schluessel = (titel.lower(), preis)
        if DOPPELTE_UEBERSPRINGEN and schluessel in gesehen:
            print(f"  · übersprungen (Dublette): {titel[:52]}")
            continue
        gesehen.add(schluessel)

        felder = det.get("fields") or {}
        art = ART_NAME.get(det.get("rs_type"), det.get("rs_type") or "Immobilie")
        kategorie = ART_KATEGORIE.get(art, "sonstige")
        mandat = "Kaufen" if det.get("marketing_type") == "BUY" else "Mieten"
        ort = ", ".join(x for x in (det.get("city"), det.get("district")) if x) or det.get("city")

        beschreibung = text_saeubern(det.get("long_description_note") or det.get("description_note"))
        lage = text_saeubern(det.get("long_location_note") or det.get("location_note"))
        ausstattung = text_saeubern(det.get("long_furnishing_note") or det.get("furnishing_note"))

        # Eckdaten aus Propstacks eigenen, fertig formatierten Beschriftungen.
        # Achtung: property_space_value spiegelt in der API die Wohnfläche und
        # ist NICHT die Grundstücksfläche — die steht nur in optional_fields.
        vorhanden = {}
        for eintrag in (det.get("required_fields") or []) + (det.get("optional_fields") or []):
            name, wert = eintrag.get("name"), eintrag.get("value")
            if not name or wert in (None, "", "False"):
                continue
            if ECKDATEN_GESPERRT.search(str(name)):
                continue
            vorhanden[name.strip()] = "ja" if str(wert) == "True" else str(wert).strip()

        verworfen = [n for n in vorhanden if n not in ECKDATEN_ERLAUBT]
        fakten = [{"label": name.replace(" ca.", ""), "wert": vorhanden[name]}
                  for name in ECKDATEN_ERLAUBT if name in vorhanden]

        # hide_address ist gesetzt: die Adresse darf nicht auf die Website.
        # Steht sie trotzdem im Fließtext, muss das in Propstack korrigiert werden.
        strasse = (det.get("street") or "").strip()
        if det.get("hide_address") and len(strasse) > 4:
            volltext = " ".join(beschreibung + lage + ausstattung)
            if strasse.lower() in volltext.lower():
                print("  ! Adresse steht im Beschreibungstext: %s "
                      "- bitte in Propstack entfernen (%s)" % (strasse, titel[:36]))

        praefix = slug(titel or "objekt", det["id"])
        galerie, karte = bilder_verarbeiten(det["id"], det.get("images") or [], praefix)
        if not karte:
            print(f"  · ohne Bild, nicht übernommen: {titel[:52]}")
            continue

        objekte.append({
            "slug": praefix,
            "propstack_id": det["id"],
            "titel": titel,
            "art": art,
            "kategorie": kategorie,
            "wohnimmobilie": kategorie in ("haeuser", "wohnungen", "mehrfamilienhaeuser"),
            "mandat": mandat,
            "status": None if bereich == "aktuell" else ("VERKAUFT" if mandat == "Kaufen" else "VERMITTELT"),
            "bucket": bereich,
            # hide_address ist bei allen Objekten gesetzt: nie Straße und Hausnummer zeigen
            "ort": ort,
            "baujahr": felder.get("construction_year"),
            "preis": preis if bereich == "aktuell" else None,
            "wohnflaeche": det.get("living_space"),
            "grundstueck": det.get("property_space_value"),
            "zustand": felder.get("condition") or det.get("condition"),
            "kurztext": kurzfassung(beschreibung),
            "bild": f"assets/img/propstack/{karte}",
            "alt": f"{art} in {ort} – Objekt von 365 Grundbesitz",
            "fakten": fakten,
            "beschreibung": beschreibung,
            "lage": lage,
            "ausstattung": ausstattung,
            "galerie": galerie,
            "abschlussdatum": det.get("sold_date"),
        })
        nicht_uebernommen.extend(verworfen)
        print(f"  ✓ {bereich:<8} {art:<12} {ort:<22} {len(galerie):>2} Bilder  {titel[:44]}")

    if nicht_uebernommen:
        print("\nNicht übernommene Propstack-Felder (bewusst gefiltert):")
        for name, n in Counter(nicht_uebernommen).most_common(14):
            print(f"  {n}x  {name}")
        print("  Ergänzen bei Bedarf in ECKDATEN_ERLAUBT.")

    # Neueste zuerst. Propstack liefert `sold_date` derzeit auf keinem Objekt
    # gefüllt — solange das so ist, dient die Objekt-ID als Ersatzreihenfolge
    # (höhere ID = später angelegt). Sobald das Abschlussdatum gepflegt ist,
    # sortiert es automatisch danach.
    def sortwert(o):
        datum = o.get("abschlussdatum") or ""
        return (1 if datum else 0, datum, o.get("propstack_id") or 0)
    objekte.sort(key=sortwert, reverse=True)

    kopf = (
        "/* =========================================================================\n"
        "   AUTOMATISCH ERZEUGT — nicht von Hand ändern.\n"
        "   Quelle: Propstack, Endpunkt /units. Neu erzeugen mit:\n"
        "       python3 tools/propstack_import.py\n\n"
        "   Zuordnung: " + " · ".join(f"{k} -> {v}" for k, v in STATUS_ZUORDNUNG.items()) + "\n"
        "   Adressen werden bewusst nicht ausgegeben (hide_address in Propstack).\n"
        "   ========================================================================= */\n"
        "window.OBJEKTE = "
    )
    os.makedirs(os.path.dirname(ZIEL), exist_ok=True)
    with open(ZIEL, "w", encoding="utf-8") as fh:
        fh.write(kopf + json.dumps({"objekte": objekte}, ensure_ascii=False, indent=1) + ";\n")

    # Gegenprobe: zeigt ein Objekt auf eine Datei, die es nicht gibt?
    luecken = []
    for o in objekte:
        for pfad, breiten in [(o["bild"], BILD_BREITEN)] + [(g, GALERIE_BREITEN) for g in o["galerie"]]:
            for w in breiten:
                if not os.path.exists(os.path.join(ROOT, f"{pfad}-{w}.webp")):
                    luecken.append(f"{pfad}-{w}")
    if luecken:
        print(f"\n  ! {len(luecken)} fehlende Bilddateien — betroffene Bilder werden entfernt")
        fehlend = {l.rsplit("-", 1)[0] for l in luecken}
        for o in objekte:
            o["galerie"] = [g for g in o["galerie"] if g not in fehlend]

    aktuell = sum(1 for o in objekte if o["bucket"] == "aktuell")
    referenz = sum(1 for o in objekte if o["bucket"] == "referenz")
    bilder = sum(len(o["galerie"]) for o in objekte)
    print(f"\nGeschrieben: {os.path.relpath(ZIEL, ROOT)}")
    print(f"  Aktuelle Immobilien: {aktuell}")
    print(f"  Referenzen:          {referenz}")
    print(f"  Bilder verarbeitet:  {bilder}")
    if rahmen_uebersprungen[0]:
        print(f"  Übersprungen:        {rahmen_uebersprungen[0]} Bilder mit eingebranntem Exposé-Rahmen")
    return 0


if __name__ == "__main__":
    sys.exit(main())
