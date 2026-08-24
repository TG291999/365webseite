/* =========================================================================
   ZENTRALE KONFIGURATION  —  hier und nur hier pflegen (§35)
   Diese Werte werden an allen Stellen der Website automatisch eingesetzt.
   ========================================================================= */
window.SITE = {

  /* --- Google-Bewertungen ------------------------------------------------
     Bei neuen Bewertungen NUR diese beiden Zahlen ändern.
     Sie erscheinen automatisch im Trust-Balken und in der Kundenstimmen-
     Sektion.                                                              */
  google: {
    rating: 5.0,
    ratingText: '5,0',
    count: 30,
    // TODO: Durch die direkte URL des Google-Unternehmensprofils ersetzen
    // (Google Maps -> Profil -> Teilen -> Link kopieren). Bis dahin
    // funktionierende Such-URL.
    url: 'https://www.google.com/maps/search/365+Grundbesitz+GmbH+Dortmund'
  },

  /* --- Kontakt ----------------------------------------------------------- */
  contact: {
    company:   '365 Grundbesitz GmbH',
    person:    'Leonie Becker',
    role:      'Geschäftsführerin · Immobilienkauffrau (IHK/EBZ)',
    street:    'Prinz-Friedrich-Karl-Straße 26',
    zip:       '44135',
    city:      'Dortmund',

    phoneOffice:        '0231 / 862 803 21',
    phoneOfficeHref:    'tel:+4923186280321',
    phoneMobile:        '0172 / 7062000',
    phoneMobileHref:    'tel:+491727062000',
    whatsapp:           '0172 / 7062000',
    whatsappHref:       'https://wa.me/491727062000',

    email:           'info@365-grundbesitz.de',
    emailHref:       'mailto:info@365-grundbesitz.de',
    emailPerson:     'becker@365-grundbesitz.de',
    emailPersonHref: 'mailto:becker@365-grundbesitz.de',
    instagram: 'https://www.instagram.com/365grundbesitz/'
  },

  /* --- Kompetenznachweise ------------------------------------------------
     Beantwortet den häufigsten unausgesprochenen Einwand der Zielgruppe:
     „Kann sie eine Immobilie dieser Größenordnung?"
     Einträge mit value: null werden NICHT gerendert. Bitte nur belegbare
     Angaben eintragen.                                                    */
  /* Feste Reihenfolge am Anfang der Referenzseite. Diese Objekte stehen in
     genau dieser Folge vorn, alles Weitere sortiert sich danach automatisch
     (Dortmund zuerst, Verkäufe vor Vermietungen). Zum Umstellen einfach die
     Slugs tauschen — sie stehen in data/objekte-propstack.js. */
  referenzenReihenfolge: [
    'investoren-aufgepasst-vielseitige-kapitalanlage-in-belebter-5229678',
    'frequentierte-einzelhandelsflache-am-mengeder-markt-5303877',
    'viel-platz-viele-moglichkeiten-zweifamilienhaus-in-brechten-5229661'
  ],

  /* Feste Auswahl der drei Referenzen auf der Startseite — bewusst gesetzt
     statt automatisch sortiert, damit die Reihenfolge stabil bleibt und ein
     erneuter Propstack-Import sie nicht verändert. Reihenfolge = Anzeige
     von links nach rechts. Slugs stehen in data/objekte-propstack.js. */
  startseiteReferenzen: [
    'viel-platz-viele-moglichkeiten-zweifamilienhaus-in-brechten-5229661',
    'charmante-altbauwohnung-mit-3-balkonen-im-beliebten-bo-ehren-5229674',
    'historisches-wohn-und-geschaftshaus-attraktive-kapitalanlage-5229727'
  ],

  credentials: [
    {
      value: 'Immobilienkauffrau (IHK/EBZ)',
      label: 'Abgeschlossene kaufmännische Ausbildung in der Immobilienwirtschaft'
    },
    {
      value: 'Gewerbeerlaubnis nach § 34c GewO',
      label: 'Erteilt durch die Stadt Dortmund, Aufsicht: Ordnungsamt'
    },
    {
      // Dritter Nachweis derzeit bewusst leer — er erscheint erst, wenn
      // `value` gefüllt ist. Eine belastbare Stückzahl wäre hier die
      // stärkste Ergänzung.
      value: null,
      label: 'In Dortmund und Umgebung'
    }
  ],

  /* --- Formular ----------------------------------------------------------
     endpoint: null  ->  Lokaler Demo-Modus. Das Formular validiert und
     zeigt die Erfolgsmeldung, versendet aber nichts.
     Für den Livebetrieb hier die URL des Form-Handlers eintragen
     (z. B. eigener Endpunkt, Formspree, Webflow-Form-Action).            */
  form: {
    endpoint: null
  },

  /* --- Tracking ----------------------------------------------------------
     Events werden ausschließlich in window.dataLayer geschrieben (§33).
     Ohne vorhandenes Consent-Tool und ohne GTM/GA4 passiert nichts weiter —
     es wird bewusst KEIN Tracking-Skript hart eingebunden.               */
  tracking: {
    enabled: true,     // schreibt in dataLayer
    debug: false       // true -> zusätzlich console.log der Events
  }
};
