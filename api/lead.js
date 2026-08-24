/* =========================================================================
   Formular-Eingang -> E-Mail per Resend.
   Bewusst ohne Abhängigkeiten: Vercels Node-Laufzeit bringt fetch schon mit,
   damit bleibt die Website ohne Build-Schritt. Nimmt alle drei Formulare der
   Website entgegen (Bewertung, Rückruf, Besichtigung) und unterscheidet sie
   über das Feld "typ".

   Erwartete Umgebungsvariablen (bei Vercel unter Project -> Settings ->
   Environment Variables einzutragen, nicht im Code):
     RESEND_API_KEY   Pflicht. Erzeugt in Resend unter API Keys.
     RESEND_FROM      Optional. Absender, z. B. "365 Grundbesitz <noreply@365-grundbesitz.de>"
                       Muss zu einer in Resend verifizierten Domain gehören.
     LEAD_TO_EMAIL    Optional. Empfänger der Anfragen, Standard: becker@365-grundbesitz.de
   ========================================================================= */

const ABSENDER = process.env.RESEND_FROM || '365 Grundbesitz <noreply@365-grundbesitz.de>';
const EMPFAENGER = process.env.LEAD_TO_EMAIL || 'becker@365-grundbesitz.de';

function esc(wert) {
  return String(wert == null ? '' : wert).replace(/[&<>"]/g, function (z) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z];
  });
}

function zeile(label, wert) {
  if (!wert) return '';
  return '<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap;vertical-align:top">' +
    esc(label) + '</td><td style="padding:4px 0">' + esc(wert).replace(/\n/g, '<br>') + '</td></tr>';
}

const BETREFF = {
  bewertung:    'Neue Bewertungsanfrage',
  besichtigung: 'Neue Besichtigungsanfrage',
  rueckruf:     'Neuer Rückrufwunsch'
};

function aufbauen(daten) {
  var typ = BETREFF[daten.typ] ? daten.typ : 'bewertung';
  var name = [daten.vorname, daten.nachname].filter(Boolean).join(' ') || daten.name || '';
  var betreff = BETREFF[typ] + (name ? ' – ' + name : '');

  var zeilen =
    zeile('Name', name) +
    zeile('E-Mail', daten.email) +
    zeile('Telefon', daten.telefon) +
    zeile('Objekt', daten.objekt) +
    zeile('Objektart', daten.objektart) +
    zeile('Ort', [daten.plz, daten.ort].filter(Boolean).join(' ')) +
    zeile('Straße', daten.strasse) +
    zeile('Zeitraum', daten.zeitraum) +
    zeile('Bevorzugter Kontaktweg', daten.kontaktweg) +
    zeile('Wunschtermin', daten.wunschzeit || daten.zeitfenster) +
    zeile('Nachricht', daten.nachricht);

  var html =
    '<div style="font-family:sans-serif;font-size:15px;color:#16181a">' +
      '<h2 style="margin:0 0 16px">' + esc(betreff) + '</h2>' +
      '<table cellpadding="0" cellspacing="0">' + zeilen + '</table>' +
      '<p style="margin-top:20px;color:#888;font-size:12px">Über das Formular auf 365-grundbesitz.de</p>' +
    '</div>';

  return { betreff: betreff, html: html };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  var daten = req.body;
  if (typeof daten === 'string') {
    try { daten = JSON.parse(daten); } catch (e) { daten = {}; }
  }
  daten = daten || {};

  // Honeypot: serverseitig noch einmal geprüft, unabhängig vom Frontend.
  if (daten.website) { res.status(200).json({ ok: true }); return; }

  if (!process.env.RESEND_API_KEY) {
    console.error('[lead] RESEND_API_KEY ist nicht gesetzt.');
    res.status(500).json({ error: 'server_not_configured' });
    return;
  }

  var nachricht = aufbauen(daten);

  try {
    var antwort = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: ABSENDER,
        to: EMPFAENGER,
        reply_to: daten.email || undefined,
        subject: nachricht.betreff,
        html: nachricht.html
      })
    });

    if (!antwort.ok) {
      var fehlertext = await antwort.text().catch(function () { return ''; });
      console.error('[lead] Resend-Fehler:', antwort.status, fehlertext);
      res.status(502).json({ error: 'send_failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[lead] Unerwarteter Fehler:', err);
    res.status(500).json({ error: 'unexpected' });
  }
};
