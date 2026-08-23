#!/usr/bin/env python3
"""
Propstack REST API — reiner LESE-Test.

    cd /Users/tg/Desktop/365-relaunch && python3 tools/propstack_check.py

Was das Skript tut
  * liest PROPSTACK_API_KEY und PROPSTACK_API_BASE_URL aus der .env
  * ruft ausschließlich per GET ab, niemals POST/PUT/PATCH/DELETE
  * probiert die bekannten Endpunkte durch und protokolliert die Statuscodes
  * lädt ein aktives Objekt vollständig
  * analysiert die JSON-Struktur und listet alle gefundenen Felder
  * prüft, ob die Bild-URLs mit dem vorhandenen Schlüssel erreichbar sind
  * schreibt einen Bericht nach tools/propstack-report.md

Was das Skript NICHT tut
  * den API-Schlüssel ausgeben, loggen oder in den Bericht schreiben
  * irgendetwas in Propstack ändern
  * Daten in die Website übernehmen

Der Bericht enthält eine anonymisierte Beispielantwort: Namen, E-Mail-Adressen,
Telefonnummern, Hausnummern und Objekt-IDs werden ersetzt.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT = os.path.join(ROOT, "tools", "propstack-report.md")
RAW_DIR = os.path.join(ROOT, "tools", "propstack-raw")

TIMEOUT = 30
NUR_LESEN = ("GET",)


# --------------------------------------------------------------------------- env
def lade_env(pfad: str) -> dict:
    werte = {}
    if not os.path.exists(pfad):
        return werte
    with open(pfad, encoding="utf-8") as fh:
        for zeile in fh:
            zeile = zeile.strip()
            if not zeile or zeile.startswith("#") or "=" not in zeile:
                continue
            name, _, wert = zeile.partition("=")
            werte[name.strip()] = wert.strip().strip("'\"")
    return werte


ENV = lade_env(os.path.join(ROOT, ".env"))
BASE = (ENV.get("PROPSTACK_API_BASE_URL") or "https://api.propstack.de/v1").rstrip("/")
KEY = ENV.get("PROPSTACK_API_KEY") or ""


# ------------------------------------------------------------------------ helfer
def maskiere(text: str) -> str:
    """Entfernt den Schlüssel aus beliebigem Text — Sicherheitsnetz."""
    if KEY and len(KEY) > 6:
        text = text.replace(KEY, "***API-KEY***")
    return text


def _curl(url: str, mit_key: bool, range_bytes: str | None = None) -> tuple[int, str, str]:
    """Eine einzelne GET-Anfrage über curl.

    Warum nicht urllib: das hier installierte Python bringt kein
    Zertifikatspaket mit, TLS schlägt deshalb fehl. curl nutzt den
    Systemspeicher von macOS.

    Der Schlüssel wird über eine Konfiguration auf stdin übergeben
    (`curl -K -`) und steht damit NICHT in der Prozessliste.
    """
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        body_pfad = tmp.name
    try:
        cfg = [
            f'url = "{url}"',
            f'output = "{body_pfad}"',
            f'max-time = {TIMEOUT}',
            'silent',
            'show-error',
            'write-out = "%{http_code}"',
            'header = "Accept: application/json"',
            'header = "User-Agent: 365-Grundbesitz-Website/lesetest"',
        ]
        if mit_key:
            cfg.append(f'header = "X-API-KEY: {KEY}"')
        if range_bytes:
            cfg.append(f'range = "{range_bytes}"')

        proc = subprocess.run(["curl", "-K", "-"], input="\n".join(cfg) + "\n",
                              capture_output=True, text=True)
        code = int(proc.stdout.strip() or 0)
        with open(body_pfad, "rb") as fh:
            koerper = fh.read().decode("utf-8", "replace")
        fehler = maskiere(proc.stderr.strip())
        return code, koerper, fehler
    finally:
        try:
            os.unlink(body_pfad)
        except OSError:
            pass


def get(pfad: str, params: dict | None = None) -> tuple[int, object, dict]:
    """Genau eine GET-Anfrage. Gibt (status, daten, header) zurück."""
    url = BASE + pfad
    if params:
        url += "?" + urllib.parse.urlencode(params)
    code, koerper, fehler = _curl(url, mit_key=True)
    if code == 0:
        return 0, maskiere(fehler or "keine Antwort"), {}
    if code in (301, 302, 303, 307, 308):
        return code, "Weiterleitung — vermutlich nicht authentifiziert", {}
    try:
        return code, json.loads(koerper), {}
    except json.JSONDecodeError:
        return code, maskiere(koerper[:600]), {}


def kopf_pruefen(url: str) -> tuple[int, str]:
    """Prüft nur, ob eine Bild-URL erreichbar ist. Ohne API-Schlüssel."""
    code, koerper, _ = _curl(url, mit_key=False, range_bytes="0-2047")
    if code == 0:
        return 0, "keine Verbindung"
    art = "Bilddaten" if koerper[:4] in ("\xff\xd8\xff\xe0", "\x89PNG") else f"{len(koerper)} Bytes"
    return code, art


# --------------------------------------------------------------- struktur-analyse
def felder(obj, prefix="", tiefe=0, max_tiefe=3, aus=None):
    """Sammelt alle Feldpfade mit Typ und Beispielwert."""
    if aus is None:
        aus = {}
    if tiefe > max_tiefe:
        return aus
    if isinstance(obj, dict):
        for k, v in obj.items():
            pfad = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (dict, list)):
                aus[pfad] = (typ(v), kurz(v))
                felder(v, pfad, tiefe + 1, max_tiefe, aus)
            else:
                aus[pfad] = (typ(v), kurz(v))
    elif isinstance(obj, list) and obj:
        felder(obj[0], prefix + "[]", tiefe, max_tiefe, aus)
    return aus


def typ(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int):
        return "int"
    if isinstance(v, float):
        return "float"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return f"array[{len(v)}]"
    if isinstance(v, dict):
        return f"object({len(v)})"
    return type(v).__name__


def kurz(v, n=70) -> str:
    if isinstance(v, (dict, list)):
        s = json.dumps(v, ensure_ascii=False)
    else:
        s = str(v)
    s = re.sub(r"\s+", " ", s)
    return s[:n] + ("…" if len(s) > n else "")


ANON_KEYS = re.compile(
    r"(email|mail|phone|tel|mobil|fax|name|street|strasse|house_number|hausnummer|"
    r"iban|owner|contact|person|url|link|token|key|secret)", re.I)


def anonymisiere(obj, tiefe=0):
    """Ersetzt personenbezogene und identifizierende Werte."""
    if isinstance(obj, dict):
        aus = {}
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                aus[k] = anonymisiere(v, tiefe + 1)
            elif v is None or isinstance(v, bool):
                aus[k] = v
            elif k.lower() in ("id", "property_id", "unit_id", "broker_id", "client_id"):
                aus[k] = 100000 + (hash(str(v)) % 899999)
            elif ANON_KEYS.search(k) and isinstance(v, str) and v:
                aus[k] = f"<{k}>"
            elif isinstance(v, str) and len(v) > 220:
                aus[k] = v[:200].rstrip() + " …[gekürzt]"
            else:
                aus[k] = v
        return aus
    if isinstance(obj, list):
        return [anonymisiere(x, tiefe + 1) for x in obj[:3]]
    return obj


# -------------------------------------------------------------------- endpunkte
KANDIDATEN = [
    # /units ist der Endpunkt für Immobilienobjekte. /properties liefert mit
    # diesem Schlüssel eine Weiterleitung auf die Weboberfläche.
    ("/units", {"per": 50}, "Objektliste"),
    ("/units", {"per": 50, "page": 2}, "Objektliste, Seite 2"),
    ("/property_statuses", None, "Objektstatus (Vermarktungsstand)"),
    ("/properties", {"per": 5}, "Alt-Endpunkt, zur Kontrolle"),
    ("/brokers", None, "Ansprechpartner / Makler"),
    ("/property_groups", None, "Objektgruppen"),
    ("/custom_fields", None, "Eigene Felder"),
    ("/projects", {"per": 3}, "Projekte"),
    ("/contacts", {"per": 1}, "Kontakte (nur Erreichbarkeit)"),
]

WUNSCHFELDER = {
    "Objekt-ID": ["id"],
    "Titel": ["name", "title"],
    "Vermarktungsart": ["marketing_type"],
    "Objektart": ["object_type", "rs_type"],
    "Status": ["status"],
    "Kaufpreis": ["price"],
    "Miete": ["base_rent", "total_rent"],
    "Wohnfläche": ["living_space"],
    "Grundstücksfläche": ["property_space_value"],
    "Nutzfläche": ["usable_floor_space", "net_floor_space"],
    "Zimmer": ["number_of_rooms"],
    "Schlaf-/Badezimmer": ["number_of_bed_rooms", "number_of_bath_rooms"],
    "Baujahr": ["construction_year"],
    "Zustand": ["condition"],
    "Adresse": ["street", "house_number", "address", "short_address"],
    "Adresse verbergen": ["hide_address"],
    "Ort / PLZ / Stadtteil": ["city", "zip_code", "district"],
    "Geolage": ["lat", "lng"],
    "Beschreibung": ["description_note", "long_description_note"],
    "Lage": ["location_note", "long_location_note"],
    "Ausstattung": ["furnishing_note", "long_furnishing_note", "furnishings"],
    "Sonstige Angaben": ["other_note", "long_other_note"],
    "Energieausweis": ["energy_certificate_availability", "building_energy_rating_type",
                       "energy_efficiency_value", "thermal_characteristic",
                       "heating_type", "firing_types"],
    "Provision": ["courtage", "courtage_note"],
    "Verkaufsdatum": ["sold_date"],
    "Bilder": ["images"],
    "Grundrisse": ["floorplans", "is_floorplan"],
    "Dokumente": ["documents"],
    "Ansprechpartner": ["broker"],
    "Aufbereitete Eckdaten": ["optional_fields", "required_fields"],
}


def main() -> int:
    zeilen = []
    p = zeilen.append

    p("# Propstack API — Lesetest\n")
    p(f"Erstellt am {datetime.now():%d.%m.%Y %H:%M} · Basis-URL `{BASE}`\n")
    p("Ausschließlich GET-Anfragen. Es wurde nichts in Propstack verändert.\n")

    if not KEY:
        p("## Ergebnis: kein API-Schlüssel hinterlegt\n")
        p("In der `.env` steht bei `PROPSTACK_API_KEY` noch kein Wert.\n")
        p("Sobald der Schlüssel eingetragen ist, dieses Skript erneut starten:\n")
        p("```bash\ncd /Users/tg/Desktop/365-relaunch && python3 tools/propstack_check.py\n```\n")
        os.makedirs(os.path.dirname(REPORT), exist_ok=True)
        open(REPORT, "w", encoding="utf-8").write("\n".join(zeilen))
        print("Kein PROPSTACK_API_KEY in der .env gefunden.")
        print("Bitte den Schlüssel dort eintragen und das Skript erneut starten.")
        print(f"Bericht: {REPORT}")
        return 2

    print(f"Basis-URL: {BASE}")
    print("Schlüssel: gefunden (wird nicht ausgegeben)\n")

    # ---------------------------------------------------------- 1) Endpunkte
    p("## 1. Erreichbare Endpunkte\n")
    p("| Endpunkt | Parameter | Status | Ergebnis |")
    p("|---|---|---|---|")
    treffer = {}
    for pfad, params, beschreibung in KANDIDATEN:
        status, daten, _ = get(pfad, params)
        if isinstance(daten, list):
            info = f"{len(daten)} Einträge"
        elif isinstance(daten, dict):
            info = "Objekt mit " + ", ".join(list(daten.keys())[:4])
        else:
            info = kurz(daten, 60)
        p(f"| `{pfad}` | {urllib.parse.urlencode(params) if params else '–'} | "
          f"{status or 'Fehler'} | {beschreibung}: {info} |")
        print(f"  {status or 'ERR':>4}  GET {pfad}")
        if status == 200:
            treffer[(pfad, json.dumps(params, sort_keys=True))] = daten
    p("")

    liste = None
    for (pfad, _), daten in treffer.items():
        if pfad == "/units" and isinstance(daten, list) and daten:
            liste = daten
            break
        if pfad == "/units" and isinstance(daten, dict):
            for schluessel in ("data", "properties", "results", "items"):
                if isinstance(daten.get(schluessel), list) and daten[schluessel]:
                    liste = daten[schluessel]
                    break
        if liste:
            break

    if not liste:
        p("## Abbruch\n")
        p("Über `/units` kamen keine Objekte zurück. Mögliche Gründe: der "
          "Schlüssel hat keine Leserechte auf Objekte, oder der Mandant enthält "
          "keine Objekte. Statuscodes siehe Tabelle oben.\n")
        os.makedirs(os.path.dirname(REPORT), exist_ok=True)
        open(REPORT, "w", encoding="utf-8").write(maskiere("\n".join(zeilen)))
        print(f"\nKeine Objekte erhalten. Bericht: {REPORT}")
        return 1

    # ------------------------------------------------- 2) Statusverteilung
    p("## 2. Statusverteilung in der Objektliste\n")
    verteilung = defaultdict(Counter)
    for eintrag in liste:
        for feld in ("marketing_type", "rented", "object_type", "rs_type"):
            if feld in eintrag:
                verteilung[feld][kurz(eintrag[feld], 30)] += 1
        st = eintrag.get("status")
        if isinstance(st, dict):
            verteilung["status.name"][st.get("name") or "(leer)"] += 1
    if verteilung:
        p("| Feld | Werte |")
        p("|---|---|")
        for feld, zaehler in verteilung.items():
            p(f"| `{feld}` | " + ", ".join(f"{w} ({n})" for w, n in zaehler.most_common()) + " |")
    else:
        p("Keine Statusfelder in der Liste gefunden.")
    p("")

    # --------------------------------------------- 3) Ein Objekt vollständig
    mit_bildern = [x for x in liste if x.get("images")]
    obj_id = (mit_bildern[0] if mit_bildern else liste[0]).get("id")
    p("## 3. Ein Objekt vollständig (`/units/{id}`)\n")
    status, detail, _ = get(f"/units/{obj_id}")
    p(f"Statuscode: **{status}**\n")
    if status != 200 or not isinstance(detail, dict):
        p("Detailabruf nicht möglich — Antwort:\n")
        p("```\n" + kurz(detail, 400) + "\n```\n")
        detail = liste[0]
        p("Für die Feldanalyse wird ersatzweise der Listeneintrag verwendet.\n")

    # ------------------------------------------------------ 4) Feldübersicht
    alle = felder(detail)
    p(f"## 4. Gefundene Felder ({len(alle)})\n")
    p("| Feld | Typ | Beispiel (gekürzt) |")
    p("|---|---|---|")
    for pfad in sorted(alle):
        t, beispiel = alle[pfad]
        if ANON_KEYS.search(pfad.split(".")[-1]):
            beispiel = "«personenbezogen, ausgeblendet»"
        p(f"| `{pfad}` | {t} | {beispiel} |")
    p("")

    # ------------------------------------------- 5) Abgleich mit Wunschliste
    p("## 5. Abgleich mit den benötigten Angaben\n")
    p("| Benötigt | Gefunden als | Status |")
    p("|---|---|---|")
    flach = {k.split(".")[-1].replace("[]", "").lower(): k for k in alle}
    fehlend = []
    for wunsch, kandidaten in WUNSCHFELDER.items():
        gefunden = [flach[k] for k in kandidaten if k in flach]
        if gefunden:
            p(f"| {wunsch} | " + ", ".join(f"`{g}`" for g in gefunden[:3]) + " | vorhanden |")
        else:
            p(f"| {wunsch} | – | **fehlt** |")
            fehlend.append(wunsch)
    p("")

    # -------------------------------------------------------- 6) Bilderprüfung
    p("## 6. Bilder\n")
    bilder = detail.get("images") or detail.get("photos") or detail.get("attachments") or []
    if not isinstance(bilder, list) or not bilder:
        p("Im Objekt sind über die API **keine Bilder** enthalten. Entweder hat das "
          "Objekt keine Bilder, oder der Schlüssel besitzt keine Bildrechte.\n")
    else:
        p(f"Anzahl Bilder am Objekt: **{len(bilder)}**\n")
        p("| # | Feld mit URL | HTTP | Content-Type |")
        p("|---|---|---|---|")
        for i, bild in enumerate(bilder[:5], 1):
            url = None
            feldname = "?"
            if isinstance(bild, dict):
                for kandidat in ("original_url", "big_url", "url", "large_url",
                                 "medium_url", "photo_url", "src"):
                    if isinstance(bild.get(kandidat), str) and bild[kandidat].startswith("http"):
                        url, feldname = bild[kandidat], kandidat
                        break
            elif isinstance(bild, str) and bild.startswith("http"):
                url, feldname = bild, "(String)"
            if not url:
                p(f"| {i} | keine URL gefunden | – | – |")
                continue
            code, ctype = kopf_pruefen(url)
            p(f"| {i} | `{feldname}` | {code or 'Fehler'} | {ctype} |")
        if isinstance(bilder[0], dict):
            p("\nFelder je Bild: " + ", ".join(f"`{k}`" for k in bilder[0].keys()) + "\n")

    # --------------------------------------------- 7) Anonymisiertes Beispiel
    p("## 7. Anonymisierte Beispielantwort\n")
    p("Personenbezogene Werte, IDs und lange Texte sind ersetzt bzw. gekürzt.\n")
    p("```json")
    p(json.dumps(anonymisiere(detail), ensure_ascii=False, indent=2)[:9000])
    p("```\n")

    # ----------------------------------------------------------- 8) Fazit
    p("## 8. Fehlende Angaben\n")
    if fehlend:
        for f in fehlend:
            p(f"- {f}")
        p("\nPrüfen, ob diese Felder in Propstack gepflegt sind oder ob der "
          "API-Schlüssel dafür zusätzliche Rechte braucht.\n")
    else:
        p("Alle benötigten Angaben sind über die API verfügbar.\n")

    os.makedirs(RAW_DIR, exist_ok=True)
    with open(os.path.join(RAW_DIR, "detail-anonym.json"), "w", encoding="utf-8") as fh:
        json.dump(anonymisiere(detail), fh, ensure_ascii=False, indent=2)

    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    open(REPORT, "w", encoding="utf-8").write(maskiere("\n".join(zeilen)))
    print(f"\nBericht geschrieben: {REPORT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
