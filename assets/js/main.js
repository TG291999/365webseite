/* =========================================================================
   365 GRUNDBESITZ — Interaktion
   Kein Framework, keine externen Bibliotheken (§31).
   ========================================================================= */
(function () {
  'use strict';

  var SITE    = window.SITE || {};
  var REVIEWS = (window.REVIEWS && window.REVIEWS.reviews) || [];
  var OBJEKTE = (window.OBJEKTE && window.OBJEKTE.objekte) || [];
  var VIDEOS  = (window.VIDEOS && window.VIDEOS.videos) || [];

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return (o || {})[k]; }, obj);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function starsMarkup(n) {
    var out = '';
    for (var i = 0; i < (n || 5); i++) out += '<svg aria-hidden="true"><use href="#i-star"></use></svg>';
    return '<span class="stars" role="img" aria-label="' + (n || 5) + ' von 5 Sternen">' + out + '</span>';
  }

  /* ------------------------------ Tracking (§33) -------------------------
     Schreibt ausschließlich in window.dataLayer. Ohne GTM/GA4 und ohne
     Consent-Tool passiert nichts weiter — es wird bewusst kein
     Tracking-Skript hart eingebunden.                                    */
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    if (!SITE.tracking || !SITE.tracking.enabled) return;
    var payload = Object.assign({ event: event }, params || {});
    window.dataLayer.push(payload);
    if (SITE.tracking.debug) console.log('[track]', payload);
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]');
    if (el) track(el.getAttribute('data-track'));
  });

  /* ------------------------ Konfigwerte in die Seite --------------------- */
  function hydrateConfig() {
    $$('[data-site]').forEach(function (el) {
      var v = get(SITE, el.getAttribute('data-site'));
      if (v !== undefined && v !== null) el.textContent = v;
    });
    $$('[data-site-href]').forEach(function (el) {
      var v = get(SITE, el.getAttribute('data-site-href'));
      if (v) el.setAttribute('href', v);
    });
    var y = $('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
  }

  /* -------------------------------- Header ------------------------------- */
  function initHeader() {
    var header = $('#site-header');
    var burger = $('.burger');
    var nav    = $('#mobile-nav');
    if (!header) return;

    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (burger && nav) {
      burger.addEventListener('click', function () {
        var open = burger.getAttribute('aria-expanded') === 'true';
        burger.setAttribute('aria-expanded', String(!open));
        burger.setAttribute('aria-label', !open ? 'Menü schließen' : 'Menü öffnen');
        nav.classList.toggle('is-open', !open);
      });
      nav.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') {
          burger.setAttribute('aria-expanded', 'false');
          nav.classList.remove('is-open');
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) {
          burger.setAttribute('aria-expanded', 'false');
          nav.classList.remove('is-open');
          burger.focus();
        }
      });
    }
  }

  /* --------------------- Mobiler CTA-Balken (§7/§29) --------------------- */
  function initCtaBar() {
    var bar = $('[data-cta-bar]');
    if (!bar) return;

    // Bewusst ohne Ausnahmen: Die Leiste war vorher im Formularbereich
    // ausgeblendet und auf Unterseiten ohne Formular durchgehend sichtbar.
    // Das wirkte auf dem Telefon zufällig — mal da, mal weg. Jetzt gilt
    // überall dieselbe Regel: ab dem Ende des Hero sichtbar, sonst nicht.
    function update() {
      var show = window.scrollY > 480;
      bar.classList.toggle('is-visible', show);
      bar.setAttribute('aria-hidden', String(!show));
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* ---------------------------- Scroll-Reveal ---------------------------- */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* -------------------- Hintergrundvideo im Header ----------------------- */
  function initHeroVideo() {
    var video = $('[data-hero-video]');
    var btn   = $('[data-hero-videobtn]');
    if (!video) return;

    if (reduceMotion) {                     // nur Standbild, kein Laden
      video.removeAttribute('autoplay');
      video.pause();
      if (btn) btn.hidden = true;
      return;
    }

    // Manche Browser blockieren Autoplay trotz muted — dann bleibt das Poster.
    var tryPlay = video.play();
    if (tryPlay && tryPlay.catch) tryPlay.catch(function () { setBtn(true); });

    function setBtn(paused) {
      if (!btn) return;
      btn.setAttribute('aria-pressed', String(paused));
      var label = $('[data-hero-videolabel]', btn);
      var icon  = btn.querySelector('use');
      if (label) label.textContent = paused ? 'Video abspielen' : 'Video pausieren';
      if (icon) icon.setAttribute('href', paused ? '#i-play-sm' : '#i-pause');
    }

    if (btn) {
      btn.addEventListener('click', function () {
        if (video.paused) { video.play(); setBtn(false); }
        else { video.pause(); setBtn(true); }
      });
    }

    // Außerhalb des Sichtfelds anhalten — spart Akku und Rechenlast
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (!btn || btn.getAttribute('aria-pressed') === 'true') return;
        if (entries[0].isIntersecting) { video.play().catch(function () {}); }
        else { video.pause(); }
      }, { threshold: 0.05 }).observe(video);
    }
  }

  /* ------------------- Kompetenznachweise rendern ------------------------ */
  function initCredentials() {
    var host = $('[data-credentials]');
    if (!host) return;
    var list = (SITE.credentials || []).filter(function (c) { return c && c.value; });
    if (!list.length) { host.hidden = true; return; }
    host.innerHTML = list.map(function (c) {
      return '<li><svg aria-hidden="true"><use href="#i-badge"></use></svg>' +
        '<span><span class="credentials__value">' + esc(c.value) + '</span>' +
        (c.label ? '<span class="credentials__label">' + esc(c.label) + '</span>' : '') +
        '</span></li>';
    }).join('');
  }

  /* -------------------- Google-Review-Laufband (§9) ---------------------- */
  var MIN_FOR_MARQUEE = 6;   // darunter: ruhige statische Reihe

  function reviewCard(r) {
    return '<li class="review-card">' +
      starsMarkup(r.sterne) +
      '<p class="review-card__text">' + esc(r.auszug || r.text) + '</p>' +
      '<p class="review-card__meta"><strong>' + esc(r.autor) + '</strong>' +
      '<span class="dot" aria-hidden="true"></span>' +
      '<svg class="g-mark" aria-hidden="true"><use href="#i-google"></use></svg> Google</p>' +
      '</li>';
  }

  function initMarquee() {
    var root = $('[data-marquee]');
    if (!root) return;
    var track_ = $('[data-marquee-track]', root);
    var pauseBtn = $('[data-marquee-pause]', root);

    // §11: Mieterstimmen bleiben im Laufband außen vor — der Hero darüber
    // spricht Eigentümer an. Verkäufer, Käufer und Vermieter zählen dazu.
    var list = REVIEWS.filter(function (r) {
      return r.ticker && r.auszug && r.zielgruppe !== 'mieter';
    });
    list.sort(function (a, b) {
      var rang = { verkaeufer: 0, vermieter: 1, kaeufer: 2 };
      return (rang[a.zielgruppe] === undefined ? 3 : rang[a.zielgruppe]) -
             (rang[b.zielgruppe] === undefined ? 3 : rang[b.zielgruppe]);
    });

    if (!list.length) { root.hidden = true; return; }

    var few = list.length < MIN_FOR_MARQUEE;
    var html = list.map(reviewCard).join('');

    if (few || reduceMotion) {
      root.classList.add('marquee--static');
      if (list.length <= 3) root.setAttribute('data-wenige', '');
      track_.innerHTML = html;
      if (pauseBtn) pauseBtn.hidden = true;
      return;
    }

    // Nahtlose Schleife: Inhalt exakt verdoppeln, Animation läuft auf -50 %.
    track_.innerHTML = html + html;
    $$('.review-card', track_).slice(list.length).forEach(function (el) {
      el.setAttribute('aria-hidden', 'true');
    });

    // Sehr langsame, gleichmäßige Geschwindigkeit: ~26 px pro Sekunde.
    var setSpeed = function () {
      var half = track_.scrollWidth / 2;
      if (!half) return;
      root.style.setProperty('--marquee-duration', Math.round(half / 26) + 's');
    };
    setSpeed();
    window.addEventListener('resize', setSpeed, { passive: true });

    if (pauseBtn) {
      var label = $('[data-pause-label]', pauseBtn);
      pauseBtn.addEventListener('click', function () {
        var paused = root.classList.toggle('is-paused');
        pauseBtn.setAttribute('aria-pressed', String(paused));
        if (label) label.textContent = paused ? 'Weiter' : 'Pause';
      });
    }
  }

  /* ---------------------- Kundenstimmen, durchblätterbar (§11) -----------
     Zeigt alle Bewertungen, deren deutsches Original gepflegt ist. Zwei
     Karten nebeneinander auf dem Desktop, eine auf dem Telefon.          */
  function initTestimonials() {
    var root = $('[data-tstm]');
    if (!root) return;

    // Bewusste Auswahl statt Vollständigkeit: nur `highlight`-Bewertungen.
    // Fällt die Auswahl weg, greift die alte Freigabe als Rückfalllösung.
    var liste = REVIEWS.filter(function (r) { return r.highlight && r.text; });
    if (!liste.length) liste = REVIEWS.filter(function (r) { return r.testimonial && r.text; });
    if (!liste.length) { root.closest('section').hidden = true; return; }

    var track  = $('[data-tstm-track]', root);
    var toggle = $('[data-tstm-toggle]', root);

    function karte(r, kopie) {
      // Ort und Datum bleiben bewusst weg: der Ort steht ohnehin meist im Text
      // und ein „vor einem Jahr" lässt Belege alt aussehen, ohne etwas zu belegen.
      return '<li class="tstm' + (kopie ? ' tstm--dup' : '') + '"' +
               (kopie ? ' aria-hidden="true"' : '') + '>' +
        '<p class="tstm__context">' + esc(r.kontext || 'Bewertung bei Google') + '</p>' +
        '<blockquote class="tstm__quote">„' + esc(r.text) + '"</blockquote>' +
        '<div class="tstm__foot">' +
          '<span class="tstm__name">' + esc(r.autor) + '</span>' +
          '<span class="tstm__src">' + starsMarkup(r.sterne) +
            '<svg class="g-mark" aria-hidden="true"><use href="#i-google"></use></svg> Google</span>' +
        '</div>' +
      '</li>';
    }

    // Zweimal dieselbe Liste: die Kopie schiebt sich nach, während das
    // Original hinausläuft. Die Kopie ist für Vorleseprogramme unsichtbar.
    track.innerHTML = liste.map(function (r) { return karte(r, false); }).join('') +
                      liste.map(function (r) { return karte(r, true); }).join('');

    // Ruhiges Lesetempo. Die Dauer richtet sich nach der tatsächlichen
    // Bandbreite, damit auf jedem Gerät gleich schnell gelaufen wird.
    var TEMPO = 34;   // Pixel je Sekunde
    function tempoSetzen() {
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var weg = (track.scrollWidth + gap) / 2;
      track.style.setProperty('--tstm-dauer', Math.round(weg / TEMPO) + 's');
    }

    var gestoppt = false;
    toggle.addEventListener('click', function () {
      gestoppt = !gestoppt;
      root.setAttribute('data-pause', gestoppt ? '1' : '0');
      toggle.setAttribute('aria-pressed', String(gestoppt));
      toggle.setAttribute('aria-label', gestoppt ? 'Bewertungen weiterlaufen lassen' : 'Bewertungen anhalten');
      $('[data-icon-pause]', toggle).hidden = gestoppt;
      $('[data-icon-play]', toggle).hidden = !gestoppt;
    });

    var breiteAlt = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth === breiteAlt) return;   // iOS: Adressleiste löst resize aus
      breiteAlt = window.innerWidth;
      tempoSetzen();
    }, { passive: true });

    tempoSetzen();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(tempoSetzen);
  }

  /* --------------------- Eigentümervideos (§12) -------------------------- */
  function initVideos() {
    var section = $('[data-videos]');
    if (!section) return;
    if (!VIDEOS.length) { section.hidden = true; return; }   // kein echtes Material -> nicht rendern

    var grid = $('[data-video-grid]', section);
    grid.innerHTML = VIDEOS.slice(0, 3).map(function (v) {
      return '<div class="video-card">' +
        '<img src="' + esc(v.poster) + '" alt="" loading="lazy" decoding="async">' +
        '<button class="video-card__play" type="button" data-video-src="' + esc(v.src) + '" ' +
                'data-track="testimonial_video_play" ' +
                'aria-label="Video abspielen: ' + esc(v.objektart) + ', ' + esc(v.stadt) + '">' +
          '<span class="video-card__icon" aria-hidden="true"><svg><use href="#i-play-sm"></use></svg></span>' +
          '<span class="video-card__label"><b>' + esc(v.objektart) + ' · ' + esc(v.stadt) + '</b>' +
            esc(v.kontext || '') + '</span>' +
        '</button>' +
      '</div>';
    }).join('');
    section.hidden = false;

    var mitUt = VIDEOS.some(function (v) { return v.untertitel; });
    var note = $('[data-video-note]', section);
    if (note && !mitUt) note.hidden = true;

    // Video erst bei Klick laden (§12, §31)
    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-video-src]');
      if (!btn) return;
      var card = btn.closest('.video-card');
      var vid = document.createElement('video');
      vid.src = btn.getAttribute('data-video-src');
      vid.controls = true; vid.autoplay = true; vid.playsInline = true;
      vid.setAttribute('preload', 'auto');
      card.innerHTML = '';
      card.appendChild(vid);
      vid.focus({ preventScroll: true });
    });
  }

  /* ------------- Ambient-Loops (erst laden, wenn sichtbar) --------------- */
  function initLazyVideos() {
    var vids = $$('[data-lazy-video]');
    if (!vids.length) return;

    if (reduceMotion) {                    // nur Poster zeigen
      vids.forEach(function (v) { v.removeAttribute('autoplay'); v.hidden = true;
        var img = v.parentElement.querySelector('[data-lazy-fallback]');
        if (img) img.hidden = false;
      });
      return;
    }
    if (!('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          if (!v.dataset.loaded) {
            $$('source', v).forEach(function (src) {
              src.setAttribute('src', src.getAttribute('data-src'));
            });
            v.load();
            v.dataset.loaded = '1';
          }
          v.play().catch(function () {});
        } else if (v.dataset.loaded) {
          v.pause();
        }
      });
    }, { rootMargin: '200px 0px', threshold: 0.05 });
    vids.forEach(function (v) { io.observe(v); });
  }

  /* -------------------------------- FAQ (§22) ---------------------------- */
  function initFaq() {
    var root = $('[data-faq]');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('.faq__q');
      if (!btn) return;
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.setAttribute('data-open', String(!open));
    });
  }

  /* --------------------- Multi-Step-Leadformular (§24) ------------------- */
  function initLeadForm() {
    var form = $('[data-lead-form]');
    if (!form) return;

    var steps    = $$('.lf__step', form);
    var btnNext  = $('[data-lf-next]', form);
    var btnBack  = $('[data-lf-back]', form);
    var btnSubmit= $('[data-lf-submit]', form);
    var fill     = $('[data-progress-fill]', form);
    var curEl    = $('[data-step-current]', form);
    var labelEl  = $('[data-step-label]', form);
    var bar      = $('.lf__progress-bar', form);
    var okBox    = $('[data-lf-ok]', form);
    var errBox   = $('[data-lf-error]', form);
    var labels   = ['Immobilie', 'Lage', 'Zeitraum', 'Kontakt'];

    var current = 1;
    var started = false;

    function show(n) {
      current = n;
      steps.forEach(function (s) {
        s.classList.toggle('is-active', Number(s.getAttribute('data-step')) === n);
      });
      fill.style.width = (n / steps.length * 100) + '%';
      curEl.textContent = n;
      labelEl.textContent = labels[n - 1] || '';
      bar.setAttribute('aria-valuenow', n);
      btnBack.hidden   = n === 1;
      btnNext.hidden   = n === steps.length;
      btnSubmit.hidden = n !== steps.length;

      var focusable = $('input, textarea', steps[n - 1]);
      if (focusable && n > 1) focusable.focus({ preventScroll: true });
    }

    function fieldError(input, msg) {
      var field = input.closest('.field');
      var box = field ? $('.field__error', field) : null;
      if (field) field.setAttribute('data-invalid', msg ? 'true' : 'false');
      if (box) box.textContent = msg || '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }

    function validateStep(n) {
      var step = steps[n - 1];
      var ok = true;
      var firstBad = null;

      // Radiogruppen
      var groups = {};
      $$('input[type=radio]', step).forEach(function (r) { groups[r.name] = groups[r.name] || []; groups[r.name].push(r); });
      Object.keys(groups).forEach(function (name) {
        var chosen = groups[name].some(function (r) { return r.checked; });
        var box = $('[data-error-for="' + name + '"]', step);
        if (box) box.textContent = chosen ? '' : 'Bitte wählen Sie eine Option aus.';
        if (!chosen) { ok = false; firstBad = firstBad || groups[name][0]; }
      });

      // Telefonnummer ist nur Pflicht, wenn ein Rückruf gewünscht wurde
      var wantsCall = !!form.querySelector('input[name=kontaktweg][value=Telefon]:checked');
      var tel = form.querySelector('#telefon');
      if (tel) tel.required = wantsCall;

      // Text-/Checkbox-Felder
      $$('input:not([type=radio]), textarea', step).forEach(function (input) {
        if (input.name === 'website') return;                    // Honeypot
        if (!input.required) { fieldError(input, ''); return; }

        var msg = '';
        if (input.type === 'checkbox') {
          if (!input.checked) msg = 'Bitte bestätigen Sie die Einwilligung.';
        } else if (!input.value.trim()) {
          msg = 'Bitte füllen Sie dieses Feld aus.';
        } else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(input.value.trim())) {
          msg = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
        } else if (input.id === 'plz' && !/^[0-9]{5}$/.test(input.value.trim())) {
          msg = 'Bitte geben Sie eine fünfstellige Postleitzahl ein.';
        } else if (input.type === 'tel' && input.value.replace(/[^0-9]/g, '').length < 6) {
          msg = 'Bitte geben Sie eine gültige Telefonnummer ein.';
        }
        fieldError(input, msg);
        if (msg) { ok = false; firstBad = firstBad || input; }
      });

      if (!ok && firstBad) firstBad.focus({ preventScroll: false });
      return ok;
    }

    // Erststart tracken, sobald der Nutzer wirklich interagiert
    form.addEventListener('input',  onFirstInteraction);
    form.addEventListener('change', onFirstInteraction);
    function onFirstInteraction() {
      if (started) return;
      started = true;
      track('valuation_form_start');
    }

    btnNext.addEventListener('click', function () {
      if (!validateStep(current)) return;
      var next = current + 1;
      show(next);
      if (next === 2) track('valuation_form_step_2');
      if (next === 3) track('valuation_form_step_3');
      if (next === 4) track('valuation_form_step_4');
    });

    btnBack.addEventListener('click', function () { show(Math.max(1, current - 1)); });

    // Auswahlkarten: Klick führt direkt weiter — weniger Reibung
    $$('.choice input[type=radio]', form).forEach(function (radio) {
      radio.addEventListener('change', function () {
        // Kontaktweg steuert nur die Pflichtfelder, kein Weiterspringen
        if (radio.name === 'kontaktweg') {
          var tel = form.querySelector('#telefon');
          var hint = form.querySelector('[data-tel-hint]');
          var call = radio.value === 'Telefon';
          if (tel) { tel.required = call; if (!call) fieldError(tel, ''); }
          if (hint) hint.textContent = call ? '' : '(optional)';
          return;
        }
        var step = Number(radio.closest('.lf__step').getAttribute('data-step'));
        if (step === current && current < steps.length) {
          window.setTimeout(function () { btnNext.click(); }, 180);
        }
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      okBox.hidden = true; errBox.hidden = true;
      if (!validateStep(steps.length)) return;
      if (form.website && form.website.value) return;            // Honeypot ausgelöst

      var data = Object.fromEntries(new FormData(form).entries());
      delete data.website;
      data.typ = 'bewertung';

      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Wird gesendet …';

      var done = function (success) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Persönliche Rückmeldung anfordern';
        if (success) {
          track('valuation_form_submit', { objektart: data.objektart, zeitraum: data.zeitraum });
          form.querySelector('.lf__step.is-active').style.display = 'none';
          $('.lf__nav', form).hidden = true;
          okBox.hidden = false;
          okBox.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        } else {
          errBox.hidden = false;
        }
      };

      var endpoint = SITE.form && SITE.form.endpoint;
      if (!endpoint) {
        // Lokaler Demo-Modus: kein Versand, aber vollständiger Ablauf.
        console.info('[365] Demo-Modus — es wurde nichts versendet. Daten:', data);
        window.setTimeout(function () { done(true); }, 500);
        return;
      }

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { done(r.ok); })
        .catch(function () { done(false); });
    });

    show(1);
  }

  /* ---------------------- Rückruf-Kurzformular --------------------------- */
  function initCallback() {
    var form   = $('[data-callback-form]');
    var toggle = $('[data-callback-toggle]');
    if (!form || !toggle) return;

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      form.hidden = open;
      toggle.textContent = open ? 'Oder Rückruf vereinbaren' : 'Rückruf-Formular schließen';
      if (!open) {
        $('#cb-name').focus({ preventScroll: true });
        track('callback_form_open');
      }
    });

    var ok  = $('[data-cb-ok]', form);
    var err = $('[data-cb-error]', form);
    var btn = $('[data-cb-submit]', form);

    function fehler(input, msg) {
      var field = input.closest('.field');
      var box = field ? $('.field__error', field) : $('[data-error-for="' + input.id + '"]', form);
      if (field) field.setAttribute('data-invalid', msg ? 'true' : 'false');
      if (box) box.textContent = msg || '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ok.hidden = true; err.hidden = true;
      var gueltig = true, ersterFehler = null;

      var name = $('#cb-name'), tel = $('#cb-tel'), consent = $('#cb-consent');
      var m1 = name.value.trim() ? '' : 'Bitte tragen Sie Ihren Namen ein.';
      var m2 = tel.value.replace(/[^0-9]/g, '').length >= 6 ? '' : 'Bitte geben Sie eine gültige Telefonnummer ein.';
      var m3 = consent.checked ? '' : 'Bitte bestätigen Sie die Einwilligung.';
      fehler(name, m1); fehler(tel, m2); fehler(consent, m3);
      [[name, m1], [tel, m2], [consent, m3]].forEach(function (p) {
        if (p[1]) { gueltig = false; ersterFehler = ersterFehler || p[0]; }
      });
      if (!gueltig) { ersterFehler.focus(); return; }
      if (form.website && form.website.value) return;            // Honeypot

      var daten = Object.fromEntries(new FormData(form).entries());
      delete daten.website;
      daten.typ = 'rueckruf';

      btn.disabled = true; btn.textContent = 'Wird gesendet …';
      var fertig = function (erfolg) {
        btn.disabled = false; btn.textContent = 'Rückruf anfordern';
        if (erfolg) {
          track('callback_submit');
          $$('.field, .consent, [data-cb-submit]', form).forEach(function (el) { el.hidden = true; });
          ok.hidden = false;
        } else { err.hidden = false; }
      };

      var endpoint = SITE.form && SITE.form.endpoint;
      if (!endpoint) {
        console.info('[365] Demo-Modus — Rückruf nicht versendet. Daten:', daten);
        window.setTimeout(function () { fertig(true); }, 450);
        return;
      }
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(daten)
      }).then(function (r) { fertig(r.ok); }).catch(function () { fertig(false); });
    });
  }

  /* ------------------- Objektlisten (Referenzen / Immobilien) ------------ */
  function objectCard(o) {
    var img = o.bild;
    var meta = [o.art, o.ort].filter(Boolean).join(' · ');
    var referenz = o.bucket === 'referenz';
    return '<article class="ref" data-kategorie="' + esc(o.kategorie) + '" data-bucket="' + esc(o.bucket) + '" data-mandat="' + esc(o.mandat) + '">' +
      '<div class="ref__media">' +
        '<img src="' + esc(img) + '-800.webp" ' +
             'srcset="' + esc(img) + '-480.webp 480w, ' + esc(img) + '-800.webp 800w, ' + esc(img) + '-1200.webp 1200w" ' +
             'sizes="(max-width: 719px) 92vw, (max-width: 1023px) 46vw, 30vw" ' +
             'width="1200" height="900" loading="lazy" decoding="async" alt="' + esc(o.alt) + '">' +
        (o.status ? '<span class="ref__status">' + esc(o.status) + '</span>' : '') +
      '</div>' +
      '<p class="ref__meta">' + esc(meta) + '</p>' +
      '<h3 class="ref__title">' + esc(o.titel) + '</h3>' +
      // Referenzen zeigen nur den Titel: sie belegen Verkäufe, sie bewerben
      // sie nicht. Beschreibungen bleiben den aktuellen Immobilien vorbehalten.
      (referenz ? '' : '<p class="ref__text">' + esc(o.kurztext) + '</p>') +
      (o.preis ? '<p class="obj__price">' + esc(o.preis) + '</p>' : '') +
      // Referenzen sind Beleg, kein Angebot: keine Detailseite, kein Klick.
      // Aktuelle Immobilien führen auf eine eigene Unterseite — kein Popup:
      // eigener Verlauf, funktionierende Zurück-Taste, teilbarer Link.
      (referenz ? '' :
        '<a class="obj__open" href="immobilie.html?objekt=' + encodeURIComponent(o.slug) + '" ' +
           'data-track="object_open">' +
          'Alle Angaben ansehen<svg aria-hidden="true"><use href="#i-arrow"></use></svg>' +
          '<span class="visually-hidden"> zu ' + esc(o.titel) + '</span>' +
        '</a>') +
    '</article>';
  }

  /* ------------------ Objekt-Detailseite (immobilie.html) ---------------
     Bewusst eine eigene Seite statt eines Popups: eigener Verlauf, echte
     Zurück-Taste, teilbarer Link, kein Fenster-im-Fenster auf dem Telefon.
     Aufbau wie ein Exposé: Galerie oben, darunter Titel und Eckdaten, dann
     Beschreibung links und eine Datenspalte rechts.                      */
  var galState = { bilder: [], index: 0 };

  /* Das Bewertungsformular steht nur auf der Startseite. Von Unterseiten aus
     muss der Verweis deshalb dorthin führen, nicht auf einen leeren Anker. */
  function bewertungZiel() {
    return document.getElementById('bewertung') ? '#bewertung' : 'index.html#bewertung';
  }

  function zeigeBild(i) {
    var n = galState.bilder.length;
    if (!n) return;
    galState.index = (i + n) % n;
    var b = galState.bilder[galState.index];
    var main = $('[data-gal-main]');
    if (main) {
      main.src = b + '-1200.webp';
      main.style.animation = 'none';
      void main.offsetWidth;
      main.style.animation = '';
    }
    var cnt = $('[data-gal-count]');
    if (cnt) cnt.textContent = (galState.index + 1) + ' von ' + n;
    $$('[data-gal-index]').forEach(function (t) {
      var aktiv = Number(t.getAttribute('data-gal-index')) === galState.index;
      t.setAttribute('aria-current', String(aktiv));
      if (aktiv && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  function absaetze(list) {
    return (list || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
  }

  /* Eckdaten für die Seitenspalte: Label leicht aufgeräumt */
  var FAKT_LABEL = {
    'qm Wohnfläche': 'Wohnfläche', 'qm Grundstück': 'Grundstück',
    'Zimmer': 'Zimmer', 'Baujahr': 'Baujahr', 'Zustand': 'Zustand',
    'Etage': 'Etage', 'Etagen': 'Etagen', 'Heizungsart': 'Heizung'
  };
  var FAKT_EINHEIT = { 'qm Wohnfläche': ' m²', 'qm Grundstück': ' m²' };

  function terminFormular(o) {
    return '<form class="terminform" data-termin-form novalidate>' +
      '<input type="hidden" name="objekt" value="' + esc(o.titel) + '">' +
      '<input type="hidden" name="objekt_id" value="' + esc(o.propstack_id || o.slug) + '">' +
      '<div class="field-grid field-grid--2">' +
        '<div class="field"><label for="t-vorname">Vorname</label>' +
          '<input type="text" id="t-vorname" name="vorname" autocomplete="given-name" required>' +
          '<p class="field__error" role="alert"></p></div>' +
        '<div class="field"><label for="t-nachname">Nachname</label>' +
          '<input type="text" id="t-nachname" name="nachname" autocomplete="family-name" required>' +
          '<p class="field__error" role="alert"></p></div>' +
        '<div class="field"><label for="t-email">E-Mail</label>' +
          '<input type="email" id="t-email" name="email" autocomplete="email" required>' +
          '<p class="field__error" role="alert"></p></div>' +
        '<div class="field"><label for="t-tel">Telefon</label>' +
          '<input type="tel" id="t-tel" name="telefon" autocomplete="tel" required>' +
          '<p class="field__error" role="alert"></p></div>' +
      '</div>' +
      '<div class="field-grid"><div class="field">' +
        '<label for="t-zeit">Wann passt es Ihnen? <span class="opt">(optional)</span></label>' +
        '<input type="text" id="t-zeit" name="wunschzeit" placeholder="z. B. nächste Woche nachmittags">' +
      '</div></div>' +
      '<div class="field-grid"><div class="field">' +
        '<label for="t-text">Ihre Nachricht <span class="opt">(optional)</span></label>' +
        '<textarea id="t-text" name="nachricht" rows="3"></textarea>' +
      '</div></div>' +
      '<label class="consent" for="t-consent">' +
        '<input type="checkbox" id="t-consent" name="einwilligung" required>' +
        '<span>Ich bin damit einverstanden, dass meine Angaben zur Bearbeitung meiner ' +
          'Anfrage gespeichert und verarbeitet werden. Weitere Informationen in der ' +
          '<a href="datenschutz.html">Datenschutzerklärung</a>.</span></label>' +
      '<p class="field__error" data-error-for="t-consent" role="alert"></p>' +
      '<div style="position:absolute;left:-9999px" aria-hidden="true">' +
        '<label for="t-hp">Bitte nicht ausfüllen</label>' +
        '<input type="text" id="t-hp" name="website" tabindex="-1" autocomplete="off"></div>' +
      '<button class="btn btn--primary" type="submit" data-t-submit>Besichtigung anfragen</button>' +
      '<p class="lf__trust"><svg aria-hidden="true"><use href="#i-lock"></use></svg>' +
        '<span>Vertraulich und unverbindlich. Ich melde mich persönlich bei Ihnen.</span></p>' +
      '<div class="lf__message lf__message--ok" data-t-ok hidden role="status" style="margin-top:1.25rem">' +
        '<strong>Vielen Dank.</strong> Ihre Anfrage ist bei mir angekommen. Ich melde mich ' +
        'mit einem Terminvorschlag bei Ihnen.</div>' +
      '<div class="lf__message lf__message--error" data-t-error hidden role="alert" style="margin-top:1.25rem">' +
        '<strong>Ihre Anfrage konnte nicht gesendet werden.</strong> Bitte versuchen Sie es ' +
        'erneut oder rufen Sie mich an unter <a href="' + esc((SITE.contact || {}).phoneMobileHref || '#') + '">' +
        esc((SITE.contact || {}).phoneMobile || '') + '</a>.</div>' +
    '</form>';
  }

  function initObjektSeite() {
    var host = $('[data-objekt-seite]');
    if (!host) return;

    var slug = '';
    try { slug = new URLSearchParams(window.location.search).get('objekt') || ''; } catch (e) { slug = ''; }
    var o = OBJEKTE.filter(function (x) { return x.slug === slug; })[0];

    if (!o) {
      host.innerHTML =
        '<section class="section"><div class="container container--narrow" style="text-align:center">' +
          '<p class="eyebrow eyebrow--center">Nicht gefunden</p>' +
          '<h1 class="h2">Diese Immobilie gibt es nicht mehr.</h1>' +
          '<p class="lead" style="margin:1.25rem auto 2rem;max-width:46ch">Vielleicht wurde sie bereits ' +
            'verkauft. In der Übersicht finden Sie alle Objekte, die aktuell vermarktet werden.</p>' +
          '<a class="btn btn--primary" href="immobilien.html">Zu den aktuellen Immobilien</a>' +
        '</div></section>';
      document.title = 'Immobilie nicht gefunden | 365 Grundbesitz';
      return;
    }

    var c = SITE.contact || {};
    var aktuell = o.bucket === 'aktuell';
    var zurueck = aktuell ? 'immobilien.html' : 'referenzen.html';
    var zurueckText = aktuell ? 'Alle aktuellen Immobilien' : 'Alle Referenzen';

    document.title = o.titel + ' | 365 Grundbesitz';
    var beschr = document.querySelector('meta[name="description"]');
    if (beschr && o.kurztext) beschr.setAttribute('content', o.kurztext);

    galState = { bilder: (o.galerie && o.galerie.length ? o.galerie : [o.bild]), index: 0 };
    var mehrere = galState.bilder.length > 1;

    var thumbs = mehrere
      ? '<div class="objgal__thumbs">' + galState.bilder.map(function (b, i) {
          return '<button type="button" data-gal-index="' + i + '" aria-current="' + (i === 0) + '" ' +
                 'aria-label="Bild ' + (i + 1) + ' anzeigen">' +
                 '<img src="' + esc(b) + '-480.webp" alt="" loading="lazy" decoding="async"></button>';
        }).join('') + '</div>'
      : '';

    var nav = mehrere
      ? '<button class="objgal__nav objgal__nav--prev" type="button" data-gal-step="-1" aria-label="Vorheriges Bild">' +
          '<svg aria-hidden="true"><use href="#i-arrow-l"></use></svg></button>' +
        '<button class="objgal__nav objgal__nav--next" type="button" data-gal-step="1" aria-label="Nächstes Bild">' +
          '<svg aria-hidden="true"><use href="#i-arrow"></use></svg></button>' +
        '<span class="objgal__count" data-gal-count>1 von ' + galState.bilder.length + '</span>'
      : '';

    var tags = (o.status ? '<span class="objgal__tag">' + esc(o.status) + '</span>' : '') +
               (o.art ? '<span class="objgal__tag objgal__tag--neutral">' + esc(o.art) + '</span>' : '');

    var fakten = (o.fakten || []).filter(function (fk) { return fk.wert; }).map(function (fk) {
      var label = FAKT_LABEL[fk.label] || fk.label;
      return '<div><dt>' + esc(label) + '</dt><dd>' + esc(fk.wert) + (FAKT_EINHEIT[fk.label] || '') + '</dd></div>';
    }).join('');
    if (o.ort) fakten = '<div><dt>Ort</dt><dd>' + esc(o.ort) + '</dd></div>' + fakten;

    var preisZeile = o.preis
      ? '<p class="objhead__price">' + esc(o.preis) + ' <span>Kaufpreis</span></p>'
      : (o.status === 'VERKAUFT'
          ? '<p class="objhead__price"><span>Dieses Objekt wurde bereits verkauft.</span></p>'
          : (o.status === 'VERMITTELT'
              ? '<p class="objhead__price"><span>Dieses Objekt wurde bereits vermittelt.</span></p>' : ''));

    host.innerHTML =
      '<div class="objseite">' +
        '<div class="container">' +
          '<a class="objseite__zurueck" href="' + zurueck + '">' +
            '<svg aria-hidden="true"><use href="#i-arrow-l"></use></svg>' + zurueckText + '</a>' +
        '</div>' +

        '<div class="container">' +
          '<div class="objgal">' +
            '<div class="objgal__main">' +
              '<img data-gal-main src="' + esc(galState.bilder[0]) + '-1200.webp" alt="' + esc(o.alt) + '">' +
              '<span class="objgal__tags">' + tags + '</span>' + nav +
            '</div>' + thumbs +
          '</div>' +

          '<div class="objhead">' +
            '<div class="objhead__text">' +
              '<p class="objhead__meta">' + esc([o.art, o.ort].filter(Boolean).join(' · ')) + '</p>' +
              '<h1 class="objhead__title">' + esc(o.titel) + '</h1>' +
              preisZeile +
            '</div>' +
            (aktuell
              ? '<div class="objhead__aktion">' +
                  '<a class="btn btn--primary" href="#termin">Besichtigungstermin anfragen</a>' +
                '</div>'
              : '') +
          '</div>' +

          '<div class="objgrid">' +
            '<div class="objtext">' +
              (o.beschreibung && o.beschreibung.length
                ? '<section><h2>Objektbeschreibung</h2>' + absaetze(o.beschreibung) + '</section>' : '') +
              (o.lage && o.lage.length
                ? '<section><h2>Lage</h2>' + absaetze(o.lage) + '</section>' : '') +
            '</div>' +

            '<aside class="objside">' +
              (fakten ? '<div class="objcard"><p class="objcard__title">Eckdaten</p><dl class="objfacts">' + fakten + '</dl></div>' : '') +
              '<div class="objaction">' +
                (aktuell
                  ? '<a class="btn btn--primary" href="#termin">Besichtigung anfragen</a>'
                  : '<a class="btn btn--primary" href="' + bewertungZiel() + '" data-track="hero_cta_click">' +
                      'Immobilie bewerten lassen</a>') +
                '<div class="objaction__person">' +
                  '<img src="assets/img/leonie/leonie-portrait-136.webp" alt="" loading="lazy" decoding="async">' +
                  '<span><b>' + esc(c.person || 'Leonie Becker') + '</b>' +
                    '<span>' + (aktuell ? 'Ihre Ansprechpartnerin für dieses Objekt' : 'Ihre Ansprechpartnerin') + '</span></span>' +
                '</div>' +
                '<div class="objcontact">' +
                  '<a href="' + esc(c.phoneMobileHref || '#') + '" data-track="phone_click">' +
                    '<svg aria-hidden="true"><use href="#i-phone"></use></svg>' + esc(c.phoneMobile || '') + '</a>' +
                  '<a href="' + esc(c.whatsappHref || '#') + '" target="_blank" rel="noopener noreferrer" data-track="whatsapp_click">' +
                    '<svg aria-hidden="true"><use href="#i-whatsapp"></use></svg>WhatsApp</a>' +
                  '<a href="' + esc(c.emailPersonHref || c.emailHref || '#') + '">' +
                    '<svg aria-hidden="true"><use href="#i-mail"></use></svg>' + esc(c.emailPerson || c.email || '') + '</a>' +
                '</div>' +
                '<p class="objside__hint">Alle Angaben stammen aus den Objektunterlagen und wurden ohne Gewähr übernommen.</p>' +
              '</div>' +
            '</aside>' +
          '</div>' +
        '</div>' +
      '</div>' +

      (aktuell
        ? '<section class="section section--paper-2" id="termin">' +
            '<div class="container container--narrow">' +
              '<p class="eyebrow">Besichtigung</p>' +
              '<h2 class="h2">Termin anfragen</h2>' +
              '<p class="lead measure" style="margin:1.1rem 0 2rem">Sagen Sie mir, wann es Ihnen passt. ' +
                'Ich melde mich mit einem konkreten Terminvorschlag – oder rufe kurz an, wenn Fragen offen sind.</p>' +
              terminFormular(o) +
            '</div>' +
          '</section>'
        : '');

    // Galerie bedienen
    if (mehrere) {
      host.addEventListener('click', function (e) {
        var nb = e.target.closest('[data-gal-step]');
        if (nb) { zeigeBild(galState.index + Number(nb.getAttribute('data-gal-step'))); return; }
        var th = e.target.closest('[data-gal-index]');
        if (th) zeigeBild(Number(th.getAttribute('data-gal-index')));
      });
      document.addEventListener('keydown', function (e) {
        if (e.target.closest('input, textarea')) return;
        if (e.key === 'ArrowRight') zeigeBild(galState.index + 1);
        if (e.key === 'ArrowLeft')  zeigeBild(galState.index - 1);
      });
    }

    if (aktuell) terminFormularVerdrahten(o);
    track('object_view', { objekt: o.slug });
  }

  function terminFormularVerdrahten(o) {
    var form = $('[data-termin-form]');
    if (!form) return;
    var ok  = $('[data-t-ok]', form);
    var err = $('[data-t-error]', form);
    var btn = $('[data-t-submit]', form);

    function fehler(el, msg) {
      var feld = el.closest('.field');
      var box = feld ? $('.field__error', feld) : $('[data-error-for="' + el.id + '"]', form);
      if (feld) feld.setAttribute('data-invalid', msg ? 'true' : 'false');
      if (box) box.textContent = msg || '';
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ok.hidden = true; err.hidden = true;
      var gueltig = true, erster = null;
      [['#t-vorname', 'Bitte tragen Sie Ihren Vornamen ein.'],
       ['#t-nachname', 'Bitte tragen Sie Ihren Nachnamen ein.']].forEach(function (paar) {
        var el = $(paar[0], form), msg = el.value.trim() ? '' : paar[1];
        fehler(el, msg); if (msg) { gueltig = false; erster = erster || el; }
      });
      var mail = $('#t-email', form);
      var mm = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(mail.value.trim()) ? '' : 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
      fehler(mail, mm); if (mm) { gueltig = false; erster = erster || mail; }
      // Für eine Terminabsprache braucht es eine Rufnummer — hin und her
      // per E-Mail kostet bei Besichtigungen die meiste Zeit.
      var tel = $('#t-tel', form);
      var tm = tel.value.replace(/[^0-9]/g, '').length >= 6 ? '' : 'Bitte geben Sie eine Telefonnummer an, unter der ich Sie erreiche.';
      fehler(tel, tm); if (tm) { gueltig = false; erster = erster || tel; }
      var con = $('#t-consent', form);
      var cm = con.checked ? '' : 'Bitte bestätigen Sie die Einwilligung.';
      fehler(con, cm); if (cm) { gueltig = false; erster = erster || con; }
      if (!gueltig) { erster.focus(); return; }
      if (form.website && form.website.value) return;

      var daten = Object.fromEntries(new FormData(form).entries());
      delete daten.website;
      daten.typ = 'besichtigung';

      btn.disabled = true; btn.textContent = 'Wird gesendet …';
      var fertig = function (erfolg) {
        btn.disabled = false; btn.textContent = 'Besichtigung anfragen';
        if (erfolg) {
          track('viewing_request_submit', { objekt: o.slug });
          $$('.field-grid, .consent, [data-t-submit], .lf__trust', form)
            .forEach(function (el) { el.hidden = true; });
          ok.hidden = false;
          ok.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        } else {
          err.hidden = false;
        }
      };

      var endpoint = (SITE.form || {}).endpoint;
      if (!endpoint) {
        console.info('[365] Demo-Modus — Besichtigungsanfrage nicht versendet. Daten:', daten);
        setTimeout(function () { fertig(true); }, 500);
        return;
      }
      fetch(endpoint, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(daten) })
        .then(function (r) { fertig(r.ok); }).catch(function () { fertig(false); });
    });
  }

  /* ---------- Kuratierte Referenzen auf der Startseite (§13) -------------
     Zeigt bis zu drei abgeschlossene Objekte, Verkäufe zuerst. Quelle ist
     dieselbe Datei wie auf der Referenzseite, damit beides zusammenpasst. */
  function initRefHighlights() {
    var host = $('[data-ref-highlights]');
    if (!host) return;

    // Feste Auswahl aus data/site.js in genau dieser Reihenfolge. Fehlt ein
    // Objekt (etwa nach einem Import), rücken Verkaufsreferenzen nach, damit
    // der Abschnitt nie leer oder lückenhaft dasteht.
    var gewuenscht = (SITE.startseiteReferenzen || []);
    var nachSlug = {};
    OBJEKTE.forEach(function (o) { nachSlug[o.slug] = o; });

    var refs = [];
    gewuenscht.forEach(function (slug) {
      if (nachSlug[slug] && refs.indexOf(nachSlug[slug]) === -1) refs.push(nachSlug[slug]);
    });
    OBJEKTE.forEach(function (o) {
      if (refs.length >= 3) return;
      if (o.bucket === 'referenz' && o.mandat === 'Kaufen' && refs.indexOf(o) === -1) refs.push(o);
    });

    if (!refs.length) { host.closest('section').hidden = true; return; }
    refs = refs.slice(0, 3);

    host.setAttribute('data-anzahl', String(refs.length));
    host.innerHTML = refs.map(objectCard).join('');
  }

  function initObjectGrid() {
    var grid = $('[data-obj-grid]');
    if (!grid || !OBJEKTE.length) return;

    var bucket = grid.getAttribute('data-bucket');          // 'referenz' | 'aktuell'
    var pool = OBJEKTE.filter(function (o) { return o.bucket === bucket; });

    var empty = $('[data-obj-empty]');
    var filters = $$('[data-filter]');
    var leiste = filters.length ? filters[0].parentElement : null;

    function passt(o, key) {
      if (key === 'wohnimmobilien') return o.wohnimmobilie && o.mandat === 'Kaufen';
      if (key === 'weitere')        return !(o.wohnimmobilie && o.mandat === 'Kaufen');
      if (key === 'alle')           return true;
      return o.kategorie === key;
    }

    function apply(key) {
      var items = pool.filter(function (o) { return passt(o, key); });
      // Zwei Kriterien, in dieser Reihenfolge: Dortmund zuerst (Heimatmarkt),
      // danach Verkäufe vor Vermietungen. Sonst stehen vermietete Gewerbe-
      // flächen vor verkauften Häusern — auf einer Verkaufsseite verkehrt.
      // Innerhalb der Gruppen bleibt die Propstack-Reihenfolge erhalten.
      var fest = SITE.referenzenReihenfolge || [];
      items.sort(function (a, b) {
        // Hand gesetzte Reihenfolge schlägt jede Regel.
        var fa = fest.indexOf(a.slug), fb = fest.indexOf(b.slug);
        if (fa !== -1 || fb !== -1) {
          if (fa === -1) return 1;
          if (fb === -1) return -1;
          return fa - fb;
        }
        var da = /dortmund/i.test(a.ort || '') ? 0 : 1;
        var db = /dortmund/i.test(b.ort || '') ? 0 : 1;
        if (da !== db) return da - db;
        var va = a.mandat === 'Kaufen' ? 0 : 1;
        var vb = b.mandat === 'Kaufen' ? 0 : 1;
        return va - vb;
      });
      grid.innerHTML = items.map(objectCard).join('');
      if (empty) empty.hidden = items.length > 0;
      var cnt = $('[data-obj-count]');
      if (cnt) cnt.textContent = items.length;
    }

    // Filter, die nichts treffen, gar nicht erst anbieten. Und bei sehr
    // wenigen Objekten ist eine Filterleiste ohnehin nur Beiwerk.
    var sichtbar = [];
    filters.forEach(function (btn) {
      var key = btn.getAttribute('data-filter');
      var treffer = pool.filter(function (o) { return passt(o, key); }).length;
      btn.hidden = treffer === 0;
      if (!btn.hidden) sichtbar.push(btn);
    });
    if (leiste) leiste.hidden = pool.length < 5 || sichtbar.length < 2;

    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filters.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        btn.setAttribute('aria-pressed', 'true');
        apply(btn.getAttribute('data-filter'));
      });
    });

    // Startfilter: der vorgesehene, sofern er etwas zeigt — sonst „alle"
    var start = $('[data-filter][aria-pressed="true"]');
    var startKey = start ? start.getAttribute('data-filter') : 'alle';
    var zeigtGenug = pool.filter(function (o) { return passt(o, startKey); }).length;
    if (!filters.length || (leiste && leiste.hidden)) { startKey = 'alle'; }
    else if (!zeigtGenug || zeigtGenug < Math.min(2, pool.length)) {
      startKey = 'alle';
      filters.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === 'alle'));
      });
    }
    apply(startKey);
  }

  /* --------------------------------- Start ------------------------------- */
  function init() {
    hydrateConfig();
    initHeader();
    initHeroVideo();
    initCredentials();
    initCtaBar();
    initReveal();
    initMarquee();
    initTestimonials();
    initVideos();
    initLazyVideos();
    initFaq();
    initLeadForm();
    initCallback();
    initRefHighlights();
    initObjectGrid();
    initObjektSeite();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
