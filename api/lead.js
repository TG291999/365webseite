/* =========================================================================
   Formular-Eingang -> E-Mail per Resend.
   Bewusst ohne Abhängigkeiten: Vercels Node-Laufzeit bringt fetch schon mit,
   damit bleibt die Website ohne Build-Schritt. Nimmt alle drei Formulare der
   Website entgegen (Bewertung, Rückruf, Besichtigung) und unterscheidet sie
   über das Feld "typ".

   Zwei Mails pro Anfrage:
     1. an Leonie — alle Angaben, wie bisher.
     2. an den Absender — Bestätigung, dass die Anfrage angekommen ist und
        sich innerhalb von 24 Stunden jemand meldet. Nur wenn eine E-Mail-
        Adresse vorliegt; das Rückruf-Kurzformular fragt keine ab und bleibt
        dadurch automatisch außen vor.

   Erwartete Umgebungsvariablen (bei Vercel unter Project -> Settings ->
   Environment Variables einzutragen, nicht im Code):
     RESEND_API_KEY   Pflicht. Erzeugt in Resend unter API Keys.
     RESEND_FROM      Optional. Absender, Standard: Leonie Beckers eigene Adresse.
                       Bewusst kein no-reply — Resends eigene Zustellbarkeits-
                       Prüfung rät ausdrücklich davon ab, und wer antwortet,
                       soll direkt bei ihr landen. Muss zu einer in Resend
                       verifizierten Domain gehören.
     LEAD_TO_EMAIL    Optional. Empfänger der Anfragen, Standard: info@365-grundbesitz.de
   ========================================================================= */

const ABSENDER = process.env.RESEND_FROM || 'Leonie Becker <becker@365-grundbesitz.de>';
const EMPFAENGER = process.env.LEAD_TO_EMAIL || 'info@365-grundbesitz.de';
const SITE_URL = 'https://365-grundbesitz.de';
const ORANGE = '#D93F00';   // WCAG-taugliches Orange, wie im Rest der Website

function esc(wert) {
  return String(wert == null ? '' : wert).replace(/[&<>"]/g, function (z) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z];
  });
}

function istEmail(wert) {
  return typeof wert === 'string' && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(wert.trim());
}

function zeile(label, wert) {
  if (!wert) return '';
  return '<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap;vertical-align:top;font-size:14px">' +
    esc(label) + '</td><td style="padding:4px 0;font-size:14px;color:#16181a">' +
    esc(wert).replace(/\n/g, '<br>') + '</td></tr>';
}

const BETREFF = {
  bewertung:    'Neue Bewertungsanfrage',
  besichtigung: 'Neue Besichtigungsanfrage',
  rueckruf:     'Neuer Rückrufwunsch'
};

/* ------------------------- Mail an Leonie ------------------------------- */
function internMail(daten, typ, name) {
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
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#16181a">' +
      '<h2 style="margin:0 0 16px">' + esc(betreff) + '</h2>' +
      '<table cellpadding="0" cellspacing="0">' + zeilen + '</table>' +
      '<p style="margin-top:20px;color:#888;font-size:12px">Über das Formular auf 365-grundbesitz.de</p>' +
    '</div>';

  return { betreff: betreff, html: html };
}

/* ------------------------- Bestätigung an den Absender ------------------ */
/* Text je nach Formular. Die "bewertung"-Fassung ist Wort für Wort
   abgestimmt; "besichtigung" folgt demselben Ton, aber mit eigenen Fakten
   und ohne den Verkaufssatz — hier fragt in der Regel ein Kaufinteressent
   an, nicht ein Eigentümer. */
var BESTAETIGUNG_TEXT = {
  bewertung: {
    betreff: 'Ihre Bewertungsanfrage ist angekommen',
    einleitung: 'vielen Dank für Ihre Anfrage. Ihre Angaben liegen mir vor – ich sehe sie mir persönlich an.',
    fakten: function (daten) {
      return zeile('Objektart', daten.objektart) +
             zeile('Ort', [daten.plz, daten.ort].filter(Boolean).join(' '));
    },
    versprechen: 'Innerhalb von 24 Stunden (werktags) rufe ich Sie persönlich zurück – von der 0172 / 7062000. ' +
      'Bis dahin müssen Sie nichts weiter tun.',
    sicherheit: 'Ihre Anfrage ist kostenfrei und unverbindlich, Ihre Daten bleiben vertraulich. ' +
      'Ob und wann Sie verkaufen, entscheiden allein Sie.'
  },
  besichtigung: {
    betreff: 'Ihre Besichtigungsanfrage ist angekommen',
    einleitung: function (daten) {
      return 'vielen Dank für Ihr Interesse' + (daten.objekt ? ' an „' + esc(daten.objekt) + '"' : '') +
        '. Ihre Anfrage liegt mir vor.';
    },
    fakten: function (daten) {
      return zeile('Objekt', daten.objekt) + zeile('Wunschtermin', daten.wunschzeit);
    },
    versprechen: 'Innerhalb von 24 Stunden (werktags) melde ich mich persönlich bei Ihnen mit einem ' +
      'Terminvorschlag – von der 0172 / 7062000. Bis dahin müssen Sie nichts weiter tun.',
    sicherheit: 'Ihre Anfrage ist unverbindlich, Ihre Daten bleiben vertraulich.'
  }
};

function bestaetigungsMail(daten, typ, name) {
  var text = BESTAETIGUNG_TEXT[typ];
  if (!text) return null;

  // Kein Anrede-/Titelfeld im Formular (Herr/Frau) — der volle Name ist die
  // neutrale, verlässliche Wahl statt einer geratenen Anrede.
  var vollerName = [daten.vorname, daten.nachname].filter(Boolean).join(' ') || name || '';
  var anrede = 'Guten Tag' + (vollerName ? ' ' + esc(vollerName) : '') + ',';

  var einleitungSatz = typeof text.einleitung === 'function' ? text.einleitung(daten) : text.einleitung;
  var fakten = text.fakten(daten);

  var html =
    '<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f0ea;padding:32px 0;font-family:Arial,Helvetica,sans-serif">' +
      '<tr><td align="center">' +
        '<table cellpadding="0" cellspacing="0" width="560" style="max-width:92%;background:#ffffff;border-radius:12px;overflow:hidden">' +

          '<tr><td style="background:' + ORANGE + ';padding:22px 32px">' +
            '<img src="' + SITE_URL + '/assets/img/brand/logo-365-120.png" alt="365 Grundbesitz" height="40" style="display:block">' +
          '</td></tr>' +

          '<tr><td style="padding:32px 32px 8px">' +
            '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#16181a">' + anrede + '</p>' +
            '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#16181a">' + esc(einleitungSatz) + '</p>' +
            (fakten
              ? '<table cellpadding="0" cellspacing="0" style="background:#f4f0ea;border-radius:8px;margin:0 0 20px;width:100%">' +
                  '<tr><td style="padding:14px 16px">' +
                    '<table cellpadding="0" cellspacing="0">' + fakten + '</table>' +
                  '</td></tr>' +
                '</table>'
              : '') +
            '<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#16181a">' + esc(text.versprechen) + '</p>' +
            '<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#16181a">' + esc(text.sicherheit) + '</p>' +
            '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#16181a">' +
              'Wenn Ihnen eine bestimmte Uhrzeit lieber ist oder oben etwas nicht stimmt, erreichen Sie mich ' +
              'direkt unter <a href="mailto:becker@365-grundbesitz.de" style="color:' + ORANGE + '">becker@365-grundbesitz.de</a> ' +
              'oder <a href="tel:+491727062000" style="color:' + ORANGE + '">0172 / 7062000</a>.' +
            '</p>' +
          '</td></tr>' +

          '<tr><td style="padding:0 32px 32px;border-top:1px solid #eee;padding-top:24px">' +
            '<table cellpadding="0" cellspacing="0"><tr>' +
              '<td style="padding-right:16px;vertical-align:top">' +
                '<img src="' + SITE_URL + '/assets/img/leonie/leonie-ganz-264.webp" alt="" width="64" height="85" ' +
                  'style="display:block;border-radius:10px;object-fit:cover">' +
              '</td>' +
              '<td style="vertical-align:top">' +
                '<p style="margin:0;font-size:14px;font-weight:600;color:#16181a">Leonie Becker</p>' +
                '<p style="margin:2px 0 10px;font-size:13px;color:#666">Geschäftsführerin · 365 Grundbesitz</p>' +
                '<p style="margin:0;font-size:13px;color:#666">' +
                  '<a href="tel:+491727062000" style="color:' + ORANGE + ';text-decoration:none">0172 / 7062000</a> · ' +
                  '<a href="mailto:becker@365-grundbesitz.de" style="color:' + ORANGE + ';text-decoration:none">becker@365-grundbesitz.de</a>' +
                '</p>' +
              '</td>' +
            '</tr></table>' +
          '</td></tr>' +

        '</table>' +
        '<p style="max-width:92%;width:560px;margin:20px auto 0;font-size:11px;line-height:1.6;color:#999;font-family:Arial,Helvetica,sans-serif">' +
          '365 Grundbesitz GmbH · Prinz-Friedrich-Karl-Str. 26 · 44135 Dortmund<br>' +
          'Diese E-Mail wurde automatisch versendet, weil Sie ein Formular auf 365-grundbesitz.de abgeschickt haben.' +
        '</p>' +
      '</td></tr>' +
    '</table>';

  return { betreff: text.betreff, html: html };
}

async function senden(payload) {
  var antwort = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!antwort.ok) {
    var fehlertext = await antwort.text().catch(function () { return ''; });
    throw new Error('Resend HTTP ' + antwort.status + ': ' + fehlertext);
  }
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

  var typ = BETREFF[daten.typ] ? daten.typ : 'bewertung';
  var name = [daten.vorname, daten.nachname].filter(Boolean).join(' ') || daten.name || '';

  try {
    var intern = internMail(daten, typ, name);
    await senden({ from: ABSENDER, to: EMPFAENGER, reply_to: daten.email || undefined,
                   subject: intern.betreff, html: intern.html });
  } catch (err) {
    console.error('[lead] Interne Mail fehlgeschlagen:', err);
    res.status(502).json({ error: 'send_failed' });
    return;
  }

  // Bestätigung an den Absender: eigenständiger Versuch. Schlägt sie fehl,
  // ist die eigentliche Anfrage trotzdem bei Leonie angekommen — die
  // Anfrage soll deswegen nicht als Fehler beim Absender ankommen.
  if (istEmail(daten.email)) {
    try {
      var bestaetigung = bestaetigungsMail(daten, typ, name);
      if (bestaetigung) {
        await senden({ from: ABSENDER, to: daten.email.trim(),
                       subject: bestaetigung.betreff, html: bestaetigung.html });
      }
    } catch (err) {
      console.error('[lead] Bestätigungsmail fehlgeschlagen:', err);
    }
  }

  res.status(200).json({ ok: true });
};
