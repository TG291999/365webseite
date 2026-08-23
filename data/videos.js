/* =========================================================================
   EIGENTÜMERVIDEOS (§12)
   Ist diese Liste leer, wird die gesamte Sektion NICHT gerendert.
   Bewusst keine Platzhalter-Videos.

   Felder
     objektart  Art der Immobilie, z. B. „Einfamilienhaus"
     stadt      Ort
     kontext    ein kurzer, sachlicher Zusatz
     poster     Standbild (WebP), wird zuerst geladen
     src        Videodatei, wird erst bei Klick geladen
     untertitel true, wenn im Video Untertitel eingebrannt sind
   ========================================================================= */
window.VIDEOS = {
  "videos": [
    {
      /* TODO: Vor dem Livegang ergänzen bzw. bestätigen —
         Namen des Eigentümerpaars (mit dessen Einverständnis),
         Objektart und Ort. Aktuell bewusst allgemein gehalten,
         weil diese Angaben nicht belegt sind. */
      "objektart": "Eigentümerpaar",
      "stadt": "Verkauf mit 365 Grundbesitz",
      "kontext": "Über die Zusammenarbeit mit Leonie Becker.",
      "poster": "assets/img/video/poster-eigentuemer-720.webp",
      "src": "assets/video/eigentuemer-720.mp4",
      "untertitel": true
    }
  ]
};
