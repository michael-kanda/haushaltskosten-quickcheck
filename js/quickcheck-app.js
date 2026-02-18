/* ═══════════════════════════════════════════════════════
   Haushaltskosten Quickcheck v2 – WordPress Edition
   Pure JS – kein Babel, kein JSX. Funktioniert überall.
   ═══════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var h = React.createElement;
  var useState = React.useState;
  var useRef = React.useRef;
  var useEffect = React.useEffect;
  var Fragment = React.Fragment;

  var RC = window.Recharts || {};

  /* ── Partner-Daten aus PHP ── */
  var PARTNERS = (typeof qcAjax !== "undefined" && qcAjax.partners) ? qcAjax.partners : {};

  var GOLD = "#f5d86b";
  var GOLD_DARK = "#c6a559";
  var TEXT = "#1a1b25";
  var BG = "#ffffff";
  var R = 3;
  var FONT = "'Outfit', sans-serif";

  var CATEGORIES = [
    { key: "wohnen", label: "Wohnkosten", optimal: 30, color: "#c6a559", icon: "\u{1F3E0}",
      fields: [
        { id: "miete", label: "Miete / Hypothek" },
        { id: "instandhaltung", label: "Instandhaltung" },
        { id: "nebenkosten", label: "Nebenkosten (Strom, Heizung, Wasser)" },
      ]},
    { key: "notwendig", label: "Notwendige Ausgaben", optimal: 30, color: "#1a1b25", icon: "\u{1F6D2}",
      fields: [
        { id: "lebensmittel", label: "Lebensmittel" },
        { id: "versicherungen", label: "Versicherungen" },
        { id: "transport", label: "Transport / Mobilit\u00e4t" },
        { id: "gesundheit", label: "Gesundheitsvorsorge" },
        { id: "kommunikation", label: "Kommunikation (Handy, Internet)" },
      ]},
    { key: "zukunft", label: "Zuk\u00fcnftige Ziele", optimal: 30, color: "#7a6e2a", icon: "\u{1F3AF}",
      fields: [
        { id: "sparen", label: "Sparen" },
        { id: "investitionen", label: "Investitionen" },
        { id: "schuldentilgung", label: "Schuldentilgung" },
        { id: "altersvorsorge", label: "Altersvorsorge" },
      ]},
    { key: "lifestyle", label: "W\u00fcnsche & Lifestyle", optimal: 10, color: "#d4a84b", icon: "\u2728",
      fields: [
        { id: "freizeit", label: "Freizeit & Hobbys" },
        { id: "restaurant", label: "Restaurantbesuche" },
        { id: "urlaub", label: "Urlaub" },
      ]},
  ];

  /* ── Helper: Gradient Text Style ── */
  function hlStyle() {
    return {
      background: "linear-gradient(90deg, " + GOLD_DARK + " 0%, " + GOLD + " 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text"
    };
  }

  function assign() {
    var t = {};
    for (var i = 0; i < arguments.length; i++) {
      var s = arguments[i];
      if (s) for (var k in s) if (s.hasOwnProperty(k)) t[k] = s[k];
    }
    return t;
  }

  var inp = {
    width: "100%", padding: "10px 12px", borderRadius: R, border: "1px solid #ddd",
    fontSize: 15, outline: "none", color: TEXT, boxSizing: "border-box", fontFamily: "inherit",
  };
  var ta = assign({}, inp, { minHeight: 100, resize: "vertical" });

  /* ═══════════════ SignaturePad ═══════════════ */
  function SignaturePad(props) {
    var canvasRef = useRef(null);
    var stateDrawing = useState(false);
    var isDrawing = stateDrawing[0]; var setIsDrawing = stateDrawing[1];
    var stateSig = useState(false);
    var hasSignature = stateSig[0]; var setHasSignature = stateSig[1];

    useEffect(function () {
      var canvas = canvasRef.current;
      if (!canvas) return;
      var rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 150;
      var ctx = canvas.getContext("2d");
      ctx.strokeStyle = TEXT;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, []);

    function getPos(e) {
      var rect = canvasRef.current.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    function startDraw(e) {
      e.preventDefault();
      var ctx = canvasRef.current.getContext("2d");
      var p = getPos(e);
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      setIsDrawing(true);
    }
    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      var ctx = canvasRef.current.getContext("2d");
      var p = getPos(e);
      ctx.lineTo(p.x, p.y); ctx.stroke();
      setHasSignature(true);
    }
    function endDraw() {
      setIsDrawing(false);
      if (hasSignature && props.onSave) props.onSave(canvasRef.current.toDataURL());
    }
    function clear() {
      var c = canvasRef.current;
      c.getContext("2d").clearRect(0, 0, c.width, c.height);
      setHasSignature(false);
      if (props.onSave) props.onSave(null);
    }

    return h("div", null,
      h("div", { style: { border: "1px solid #ddd", borderRadius: R, position: "relative", background: "#fafafa" } },
        h("canvas", {
          ref: canvasRef,
          onMouseDown: startDraw, onMouseMove: draw, onMouseUp: endDraw, onMouseLeave: endDraw,
          onTouchStart: startDraw, onTouchMove: draw, onTouchEnd: endDraw,
          style: { width: "100%", cursor: "crosshair", touchAction: "none", display: "block" }
        }),
        !hasSignature && h("div", {
          style: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#bbb", pointerEvents: "none", fontSize: 14 }
        }, "Hier unterschreiben")
      ),
      hasSignature && h("button", {
        onClick: clear, type: "button",
        style: { marginTop: 6, fontSize: 12, color: "#999", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }
      }, "Unterschrift l\u00f6schen")
    );
  }

  /* ═══════════════ ProgressBar ═══════════════ */
  function ProgressBar(props) {
    var pct = ((props.current + 1) / props.total) * 100;
    return h("div", { style: { marginBottom: 28 } },
      h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#999", marginBottom: 6 } },
        h("span", null, "Schritt " + (props.current + 1) + " von " + props.total),
        h("span", null, Math.round(pct) + "%")
      ),
      h("div", { style: { height: 3, background: "#eee", borderRadius: R } },
        h("div", { style: { height: "100%", width: pct + "%", background: "linear-gradient(90deg, " + GOLD_DARK + ", " + GOLD + ")", borderRadius: R, transition: "width 0.4s ease" } })
      )
    );
  }

  /* ═══════════════ CheckGroup ═══════════════ */
  function CheckGroup(props) {
    function toggle(opt) {
      if (props.selected.includes(opt)) {
        props.onChange(props.selected.filter(function (s) { return s !== opt; }));
      } else if (!props.max || props.selected.length < props.max) {
        props.onChange(props.selected.concat([opt]));
      }
    }
    return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 } },
      props.options.map(function (opt) {
        var a = props.selected.includes(opt);
        return h("button", {
          key: opt, type: "button", onClick: function () { toggle(opt); },
          style: {
            padding: "10px 14px", borderRadius: R, fontSize: 14, textAlign: "left", cursor: "pointer", transition: "all 0.15s",
            border: a ? "2px solid " + GOLD_DARK : "2px solid #e5e5e5",
            background: a ? "#fdf8e8" : BG, color: TEXT, fontWeight: a ? 600 : 400, fontFamily: "inherit",
          }
        },
          h("span", { style: { marginRight: 8, color: a ? GOLD_DARK : "#ccc" } }, a ? "\u2713" : "\u25CB"),
          opt
        );
      })
    );
  }

  /* ═══════════════ RadioGroup ═══════════════ */
  function RadioGroup(props) {
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
      props.options.map(function (opt) {
        var a = props.selected === opt;
        return h("button", {
          key: opt, type: "button", onClick: function () { props.onChange(opt); },
          style: {
            padding: "10px 14px", borderRadius: R, fontSize: 14, textAlign: "left", cursor: "pointer", transition: "all 0.15s",
            border: a ? "2px solid " + GOLD_DARK : "2px solid #e5e5e5",
            background: a ? "#fdf8e8" : BG, color: TEXT, fontWeight: a ? 600 : 400, fontFamily: "inherit",
          }
        },
          h("span", { style: { marginRight: 8, color: a ? GOLD_DARK : "#ccc" } }, a ? "\u25CF" : "\u25CB"),
          opt
        );
      })
    );
  }

  /* ═══════════════ CustomTooltip ═══════════════ */
  function CustomTooltip(props) {
    if (!props.active || !props.payload || !props.payload.length) return null;
    var d = props.payload[0].payload;
    return h("div", { style: { background: BG, border: "1px solid #e5e5e5", borderRadius: R, padding: "10px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" } },
      h("div", { style: { fontWeight: 600, color: TEXT, marginBottom: 4 } }, d.name),
      h("div", { style: { fontSize: 13, color: "#666" } }, "Aktuell: " + d.value + "% \u00b7 Optimal: " + d.optimal + "%")
    );
  }

  /* ═══════════════ secTitle helper ═══════════════ */
  function secTitle(t) {
    return h("h3", { style: { fontSize: 14, fontWeight: 600, color: TEXT, margin: "18px 0 8px" } }, t);
  }

  /* ═══════════════════════════════════════════════════
     HAUPT-KOMPONENTE
     ═══════════════════════════════════════════════════ */
  function HaushaltskostenQuickcheck(props) {
    var sStep = useState(0); var step = sStep[0]; var setStep = sStep[1];
    var sPid = useState(props.initialPartnerId || null); var partnerId = sPid[0]; var setPartnerId = sPid[1];

    var sForm = useState({
      lebenssituation: [], themen: [], themenSonstig: "", prioritaeten: [], wohnen: [], familie: [],
      pensionGefuehl: "", zukunftWunsch: "", absicherung: [], investmentRisiko: "", investmentZeit: "",
      erfahrung: "", beratungWichtig: [], wichtigsteFrage: "", abschlussfrage: "",
    }); var form = sForm[0]; var setForm = sForm[1];

    var sEink = useState(""); var einkommen = sEink[0]; var setEinkommen = sEink[1];
    var sCosts = useState({}); var costs = sCosts[0]; var setCosts = sCosts[1];
    var sVoll = useState(false); var vollmachtChecked = sVoll[0]; var setVollmachtChecked = sVoll[1];
    var sSig = useState(null); var signature = sSig[0]; var setSignature = sSig[1];
    var sName = useState(""); var kundenName = sName[0]; var setKundenName = sName[1];
    var sEmail = useState(""); var kundenEmail = sEmail[0]; var setKundenEmail = sEmail[1];
    var sTel = useState(""); var kundenTelefon = sTel[0]; var setKundenTelefon = sTel[1];
    var sSub = useState(false); var submitted = sSub[0]; var setSubmitted = sSub[1];
    var sSubbing = useState(false); var submitting = sSubbing[0]; var setSubmitting = sSubbing[1];
    var sErr = useState(""); var submitError = sErr[0]; var setSubmitError = sErr[1];

    useEffect(function () {
      try {
        var p = new URLSearchParams(window.location.search).get("partner");
        if (p && PARTNERS[p]) setPartnerId(p);
      } catch (e) {}
    }, []);

    var partner = partnerId ? PARTNERS[partnerId] : null;

    function updateForm(k, v) { setForm(function (prev) { var n = assign({}, prev); n[k] = v; return n; }); }
    function updateCost(id, v) { setCosts(function (prev) { var n = assign({}, prev); n[id] = v; return n; }); }
    function getCategoryTotal(cat) { return cat.fields.reduce(function (s, f) { return s + (parseFloat(costs[f.id]) || 0); }, 0); }

    var totalCosts = CATEGORIES.reduce(function (s, cat) { return s + getCategoryTotal(cat); }, 0);

    function getChartData() {
      if (totalCosts === 0) return [];
      return CATEGORIES.map(function (cat) {
        return { name: cat.label, value: Math.round((getCategoryTotal(cat) / totalCosts) * 100), optimal: cat.optimal, color: cat.color, euro: getCategoryTotal(cat) };
      });
    }

    function getRecommendation(cat) {
      if (totalCosts === 0) return null;
      var pct = (getCategoryTotal(cat) / totalCosts) * 100;
      var diff = pct - cat.optimal;
      if (Math.abs(diff) < 3) return { type: "ok", text: "Im optimalen Bereich \u2713" };
      if (diff > 0) return { type: "high", text: Math.round(diff) + "% \u00fcber dem Optimum \u2013 Einsparpotenzial pr\u00fcfen" };
      return { type: "low", text: Math.round(Math.abs(diff)) + "% unter dem Optimum \u2013 evtl. mehr Spielraum vorhanden" };
    }

    var STEPS = [
      { title: "Willkommen", sub: "Dein pers\u00f6nlicher Finanz-Quickcheck" },
      { title: "Deine Kontaktdaten", sub: "Damit wir dich erreichen k\u00f6nnen" },
      { title: "1. Lebenssituation", sub: "Mehrfachauswahl m\u00f6glich" },
      { title: "2. Aktuelle Themen", sub: "Welche Themen besch\u00e4ftigen dich aktuell oder in naher Zukunft?" },
      { title: "3. Priorit\u00e4ten", sub: "Bitte w\u00e4hle maximal 3 Hauptpriorit\u00e4ten" },
      { title: "4. Wohnen & Immobilie", sub: "Trifft aktuell oder zuk\u00fcnftig zu?" },
      { title: "5. Familie & Zukunft", sub: "Was trifft auf dich zu?" },
      { title: "6. Pension & langfristige Ziele", sub: "Wie f\u00fchlst du dich beim Thema Pension?" },
      { title: "7. Absicherung", sub: "Welche Bereiche m\u00f6chtest du abgesichert wissen?" },
      { title: "8. Investment & Verm\u00f6gensaufbau", sub: "Deine Einstellung zu Risiko und Zeithorizont" },
      { title: "9. Erfahrung & Erwartungen", sub: "Deine bisherigen Erfahrungen" },
      { title: "10. Die wichtigste Frage", sub: "Pflichtfeld" },
      { title: "Abschlussfrage", sub: "Was ist dir besonders wichtig?" },
      { title: "Haushaltskosten-Check", sub: "Monatliche Ausgaben je Bereich" },
      { title: "Dein Ergebnis", sub: "Analyse deiner Haushaltskosten" },
      { title: "Vollmacht & Absenden", sub: "Letzte Schritte" },
    ];

    var totalSteps = STEPS.length;

    function canNext() {
      if (step === 1) return kundenName.trim().length > 0;
      if (step === 11) return form.wichtigsteFrage.trim().length > 0;
      return true;
    }

    /* ── Submit ── */
    function handleSubmit() {
      setSubmitting(true);
      setSubmitError("");

      var payload = {
        partnerId: partnerId || "",
        partner: partner || "Kein Partner",
        kontakt: { name: kundenName, email: kundenEmail, telefon: kundenTelefon },
        quickcheck: form,
        einkommen: parseFloat(einkommen) || 0,
        kosten: costs,
        kategorien: CATEGORIES.map(function (cat) {
          return { name: cat.label, betrag: getCategoryTotal(cat), prozent: totalCosts > 0 ? Math.round((getCategoryTotal(cat) / totalCosts) * 100) : 0, optimal: cat.optimal };
        }),
        vollmacht: vollmachtChecked,
        signatur: signature ? "vorhanden" : "keine",
      };

      if (typeof qcAjax !== "undefined" && qcAjax.url) {
        var formData = new FormData();
        formData.append("action", "qc_submit");
        formData.append("nonce", qcAjax.nonce);
        formData.append("payload", JSON.stringify(payload));

        fetch(qcAjax.url, { method: "POST", body: formData })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (!data.success) throw new Error(data.data || "Fehler beim Senden.");
            setSubmitted(true);
          })
          .catch(function (err) {
            console.error("Submit Error:", err);
            setSubmitError(err.message || "Ein Fehler ist aufgetreten.");
          })
          .finally(function () { setSubmitting(false); });
      } else {
        console.log("Submit:", JSON.stringify(payload, null, 2));
        setSubmitted(true);
        setSubmitting(false);
      }
    }

    /* ── Scroll bei Schrittwechsel ── */
    useEffect(function () {
      var el = document.getElementById("quickcheck-root");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [step]);

    /* ══════════ SUBMITTED ══════════ */
    if (submitted) {
      return h("div", { style: { fontFamily: FONT, padding: 40, textAlign: "center", color: TEXT, background: BG } },
        h("div", { style: { fontSize: 56, marginBottom: 16 } }, "\u2705"),
        h("h2", { style: assign({ fontSize: 22, marginBottom: 8 }, hlStyle()) }, "Vielen Dank, " + kundenName + "!"),
        h("p", { style: { color: "#666", lineHeight: 1.6 } },
          "Ihr Quickcheck wurde erfolgreich \u00fcbermittelt.",
          partner ? h("span", null, h("br"), partner.name + " wird sich in K\u00fcrze bei dir melden.") : null
        )
      );
    }

    /* ══════════ STEP RENDERER ══════════ */
    function renderStep() {
      switch (step) {

        /* ── 0: Willkommen ── */
        case 0:
          return h("div", { style: { textAlign: "center", padding: "16px 0" } },
            h("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u{1F4CA}"),
            h("h2", { style: assign({ fontSize: 22, marginBottom: 8 }, hlStyle()) }, "Haushaltskosten-Quickcheck"),
            h("p", { style: { color: "#666", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 20px", fontSize: 14 } },
              "In wenigen Minuten erh\u00e4ltst du einen klaren \u00dcberblick \u00fcber deine finanzielle Situation und konkrete Handlungsempfehlungen."
            ),
            partner && h("div", { style: { background: "#fdf8e8", borderRadius: R, padding: "12px 18px", display: "inline-block", border: "1px solid " + GOLD } },
              h("div", { style: { fontSize: 12, color: "#999" } }, "Dein Berater"),
              h("div", { style: { fontWeight: 600, color: TEXT } }, partner.name),
              h("div", { style: { fontSize: 13, color: "#666" } }, partner.role + (partner.phone ? " \u00b7 " + partner.phone : ""))
            ),
            h("div", { style: { marginTop: 20, padding: 16, background: "#fafafa", borderRadius: R, textAlign: "left", maxWidth: 440, margin: "20px auto 0", border: "1px solid #eee" } },
              h("div", { style: { fontWeight: 600, marginBottom: 8, color: TEXT, fontSize: 14 } }, "Wir starten mit drei Fragen:"),
              h("div", { style: { fontSize: 14, color: "#555", lineHeight: 1.7 } },
                "\u201EWas war der Grund, warum du dir heute Zeit genommen hast?\u201C", h("br"),
                "\u201EWas m\u00fcsste heute passieren, damit es sich f\u00fcr dich gelohnt hat?\u201C", h("br"),
                "\u201EGeht es eher um Orientierung oder um eine Entscheidung?\u201C"
              )
            )
          );

        /* ── 1: Kontaktdaten ── */
        case 1:
          return h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
            h("label", { style: { fontWeight: 500, fontSize: 14, color: TEXT } }, "Name *",
              h("input", { style: assign({}, inp, { marginTop: 4 }), value: kundenName, onChange: function (e) { setKundenName(e.target.value); }, placeholder: "Max Mustermann" })
            ),
            h("label", { style: { fontWeight: 500, fontSize: 14, color: TEXT } }, "E-Mail",
              h("input", { style: assign({}, inp, { marginTop: 4 }), type: "email", value: kundenEmail, onChange: function (e) { setKundenEmail(e.target.value); }, placeholder: "max@beispiel.at" })
            ),
            h("label", { style: { fontWeight: 500, fontSize: 14, color: TEXT } }, "Telefon",
              h("input", { style: assign({}, inp, { marginTop: 4 }), type: "tel", value: kundenTelefon, onChange: function (e) { setKundenTelefon(e.target.value); }, placeholder: "+43 ..." })
            )
          );

        /* ── 2: Lebenssituation ── */
        case 2:
          return h(CheckGroup, { options: ["Angestellt","Selbstst\u00e4ndig / Unternehmer","In Ausbildung / Studium","Pension / kurz davor","Alleinstehend","In Partnerschaft","Mit Kindern","Ohne Kinder"], selected: form.lebenssituation, onChange: function (v) { updateForm("lebenssituation", v); } });

        /* ── 3: Themen ── */
        case 3:
          return h("div", null,
            h(CheckGroup, { options: ["Haus bauen","Wohnung kaufen","Miete / Wohnen optimieren","Umschuldung / Finanzierung pr\u00fcfen","F\u00f6rderungen nutzen","Verm\u00f6gensaufbau","Pension / Altersvorsorge","Absicherung Familie","Absicherung Einkommen","Investment / Geldanlage","Privatversicherung / Gesundheit","Einkommenssituation verbessern","R\u00fccklagen aufbauen","Reisen & Lebensqualit\u00e4t","Sonstiges"], selected: form.themen, onChange: function (v) { updateForm("themen", v); } }),
            form.themen.includes("Sonstiges") && h("input", { style: assign({}, inp, { marginTop: 12 }), value: form.themenSonstig, onChange: function (e) { updateForm("themenSonstig", e.target.value); }, placeholder: "Bitte beschreiben\u2026" })
          );

        /* ── 4: Prioritäten ── */
        case 4:
          return h("div", null,
            form.prioritaeten.length >= 3 && h("div", { style: { fontSize: 13, color: GOLD_DARK, marginBottom: 8 } }, "Maximum von 3 erreicht"),
            h(CheckGroup, { max: 3, options: ["Sicherheit","Wachstum / Rendite","Flexibilit\u00e4t","Planbarkeit","Steuerliche Vorteile","F\u00f6rderung nutzen","Langfristiger Verm\u00f6gensaufbau","Kurzfristige Liquidit\u00e4t","Absicherung","Unabh\u00e4ngigkeit"], selected: form.prioritaeten, onChange: function (v) { updateForm("prioritaeten", v); } })
          );

        /* ── 5: Wohnen ── */
        case 5:
          return h(CheckGroup, { options: ["Kein Thema","Haus bauen","Wohnung kaufen","Sanieren / Umbauen","Bestehende Finanzierung optimieren"], selected: form.wohnen, onChange: function (v) { updateForm("wohnen", v); } });

        /* ── 6: Familie ── */
        case 6:
          return h(CheckGroup, { options: ["Kinder vorhanden","Kinder geplant","Ausbildung der Kinder absichern","Familie finanziell absichern","Pflege von Angeh\u00f6rigen relevant"], selected: form.familie, onChange: function (v) { updateForm("familie", v); } });

        /* ── 7: Pension ── */
        case 7:
          return h("div", null,
            h(RadioGroup, { options: ["Sehr entspannt","Eher entspannt","Unsicher","Sorgevoll"], selected: form.pensionGefuehl, onChange: function (v) { updateForm("pensionGefuehl", v); } }),
            secTitle("Was w\u00fcnschst du dir f\u00fcr deine Zukunft?"),
            h("textarea", { style: ta, value: form.zukunftWunsch, onChange: function (e) { updateForm("zukunftWunsch", e.target.value); }, placeholder: "Deine W\u00fcnsche und Vorstellungen\u2026" })
          );

        /* ── 8: Absicherung ── */
        case 8:
          return h(CheckGroup, { options: ["Einkommen","Familie","Krankheit","Unfall","Pflege","Haftung","Noch nicht besch\u00e4ftigt"], selected: form.absicherung, onChange: function (v) { updateForm("absicherung", v); } });

        /* ── 9: Investment ── */
        case 9:
          return h("div", null,
            secTitle("Welche Aussage passt am ehesten zu dir?"),
            h(RadioGroup, { options: ["Sicherheit ist mir wichtiger als Rendite","Ausgewogen: Sicherheit & Wachstum","Wachstum ist mir wichtiger als Sicherheit"], selected: form.investmentRisiko, onChange: function (v) { updateForm("investmentRisiko", v); } }),
            secTitle("Zeithorizont"),
            h(RadioGroup, { options: ["Kurzfristig (0\u20133 Jahre)","Mittelfristig (3\u201310 Jahre)","Langfristig (10+ Jahre)"], selected: form.investmentZeit, onChange: function (v) { updateForm("investmentZeit", v); } })
          );

        /* ── 10: Erfahrung ── */
        case 10:
          return h("div", null,
            secTitle("Bisherige Erfahrungen mit Finanzthemen"),
            h(RadioGroup, { options: ["Sehr gute","Gemischte","Eher negative","Kaum Erfahrung"], selected: form.erfahrung, onChange: function (v) { updateForm("erfahrung", v); } }),
            secTitle("Was ist dir in der Beratung besonders wichtig?"),
            h(CheckGroup, { options: ["Verst\u00e4ndliche Erkl\u00e4rungen","Transparenz","Langfristige Begleitung","Sicherheit","Unabh\u00e4ngigkeit","Vergleichsm\u00f6glichkeiten"], selected: form.beratungWichtig, onChange: function (v) { updateForm("beratungWichtig", v); } })
          );

        /* ── 11: Wichtigste Frage ── */
        case 11:
          return h("div", null,
            h("div", { style: { background: "#fdf8e8", borderLeft: "3px solid " + GOLD_DARK, padding: "10px 14px", borderRadius: "0 " + R + "px " + R + "px 0", marginBottom: 14, fontSize: 14, color: "#666" } },
              "Pflichtfeld \u2013 nimm dir einen Moment Zeit."
            ),
            h("textarea", { style: ta, value: form.wichtigsteFrage, onChange: function (e) { updateForm("wichtigsteFrage", e.target.value); }, placeholder: "Was ist dir pers\u00f6nlich beim Thema Finanzen am wichtigsten?" })
          );

        /* ── 12: Abschlussfrage ── */
        case 12:
          return h("textarea", { style: ta, value: form.abschlussfrage, onChange: function (e) { updateForm("abschlussfrage", e.target.value); }, placeholder: "Was darf in einem Finanzkonzept f\u00fcr dich auf keinen Fall fehlen \u2013 und was auf keinen Fall enthalten sein?" });

        /* ── 13: Haushaltskosten ── */
        case 13:
          return h("div", null,
            h("label", { style: { fontWeight: 600, fontSize: 14, display: "block", marginBottom: 14, color: TEXT } },
              "Monatliches Netto-Einkommen (Haushalt)",
              h("div", { style: { position: "relative", marginTop: 4 } },
                h("input", { style: assign({}, inp, { paddingLeft: 28 }), type: "number", value: einkommen, onChange: function (e) { setEinkommen(e.target.value); }, placeholder: "z.B. 3500" }),
                h("span", { style: { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#999" } }, "\u20AC")
              )
            ),
            CATEGORIES.map(function (cat) {
              return h("div", { key: cat.key, style: { marginBottom: 18 } },
                h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 } },
                  h("span", { style: { fontSize: 18 } }, cat.icon),
                  h("span", { style: { fontWeight: 600, color: TEXT } }, cat.label),
                  h("span", { style: { fontSize: 12, color: "#999", marginLeft: "auto" } }, "Optimal: " + cat.optimal + "%")
                ),
                h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, paddingLeft: 26 } },
                  cat.fields.map(function (f) {
                    return h("label", { key: f.id, style: { fontSize: 13, color: TEXT } },
                      f.label,
                      h("div", { style: { position: "relative", marginTop: 2 } },
                        h("input", { style: assign({}, inp, { fontSize: 13, padding: "8px 10px 8px 22px" }), type: "number", value: costs[f.id] || "", onChange: function (e) { updateCost(f.id, e.target.value); }, placeholder: "0" }),
                        h("span", { style: { position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#bbb", fontSize: 12 } }, "\u20AC")
                      )
                    );
                  })
                )
              );
            })
          );

        /* ── 14: Ergebnis ── */
        case 14:
          var chartData = getChartData();
          var einkommenNum = parseFloat(einkommen) || 0;
          return h("div", null,
            totalCosts === 0
              ? h("div", { style: { textAlign: "center", padding: 32, color: "#999" } }, "Bitte gib im vorherigen Schritt deine monatlichen Ausgaben ein.")
              : h("div", null,
                  /* Summary cards */
                  h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 24 } },
                    [
                      { label: "Einkommen", val: einkommenNum, bg: "#fdf8e8" },
                      { label: "Ausgaben gesamt", val: totalCosts, bg: "#fafafa" },
                      { label: "Differenz", val: einkommenNum - totalCosts, bg: einkommenNum - totalCosts >= 0 ? "#fdf8e8" : "#fef0f0" },
                    ].map(function (c, i) {
                      return h("div", { key: i, style: { background: c.bg, borderRadius: R, padding: 12, textAlign: "center", border: "1px solid #eee" } },
                        h("div", { style: { fontSize: 12, color: "#999" } }, c.label),
                        h("div", { style: { fontSize: 18, fontWeight: 700, color: TEXT } }, "\u20AC " + c.val.toLocaleString("de-AT"))
                      );
                    })
                  ),
                  /* Pie Chart */
                  h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
                    h("h3", { style: assign({ fontSize: 16, fontWeight: 600, marginBottom: 4 }, hlStyle()) }, "Deine tats\u00e4chliche Verteilung"),
                    h("p", { style: { fontSize: 13, color: "#999", marginBottom: 8 } }, "Optimale Verteilung: 30 / 30 / 30 / 10"),
                    h(RC.ResponsiveContainer, { width: "100%", height: 280 },
                      h(RC.PieChart, null,
                        h(RC.Pie, { data: chartData, cx: "50%", cy: "50%", innerRadius: 55, outerRadius: 105, paddingAngle: 2, dataKey: "value", label: function (p) { return p.value + "%"; }, labelLine: false },
                          chartData.map(function (entry, i) {
                            return h(RC.Cell, { key: i, fill: entry.color, stroke: "#fff", strokeWidth: 2 });
                          })
                        ),
                        h(RC.Tooltip, { content: h(CustomTooltip) }),
                        h(RC.Legend, { formatter: function (v) { return h("span", { style: { fontSize: 13, color: "#666" } }, v); } })
                      )
                    )
                  ),
                  /* Recommendations */
                  h("div", { style: { marginTop: 20 } },
                    h("h3", { style: assign({ fontSize: 16, fontWeight: 600, marginBottom: 12 }, hlStyle()) }, "Handlungsempfehlungen"),
                    CATEGORIES.map(function (cat) {
                      var rec = getRecommendation(cat);
                      var pct = Math.round((getCategoryTotal(cat) / totalCosts) * 100);
                      if (!rec) return null;
                      var st = { ok: { bg: "#fdf8e8", brd: GOLD_DARK, cl: "#7a6e2a" }, high: { bg: "#fef0f0", brd: "#d44", cl: "#c33" }, low: { bg: "#fafafa", brd: "#ccc", cl: "#888" } };
                      var s = st[rec.type];
                      return h("div", { key: cat.key, style: { background: s.bg, borderRadius: R, padding: "12px 16px", marginBottom: 8, borderLeft: "3px solid " + s.brd } },
                        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 } },
                          h("span", { style: { fontWeight: 600, color: TEXT } }, cat.icon + " " + cat.label),
                          h("span", { style: { fontSize: 13, color: "#666" } }, pct + "% (\u20AC " + getCategoryTotal(cat).toLocaleString("de-AT") + ") \u00b7 Optimal: " + cat.optimal + "%")
                        ),
                        h("div", { style: { fontSize: 13, color: s.cl, marginTop: 4 } }, rec.text)
                      );
                    })
                  )
                )
          );

        /* ── 15: Vollmacht ── */
        case 15:
          return h("div", null,
            h("div", { style: { background: "#fafafa", borderRadius: R, padding: 18, marginBottom: 18, border: "1px solid #eee" } },
              h("h3", { style: assign({ fontSize: 16, fontWeight: 600, marginBottom: 8 }, hlStyle()) }, "Vollmacht zur Vertragsabfrage"),
              h("p", { style: { fontSize: 14, color: "#666", lineHeight: 1.6, marginBottom: 12 } },
                "Mit deiner Zustimmung erm\u00e4chtigst du uns, bestehende Vertr\u00e4ge bei deinen aktuellen Anbietern abzufragen, um dir ein optimales Angebot erstellen zu k\u00f6nnen."
              ),
              h("a", { href: "#", target: "_blank", rel: "noopener noreferrer", style: { color: GOLD_DARK, fontSize: 14, fontWeight: 500, textDecoration: "underline", display: "inline-block", marginBottom: 12 } },
                "\u{1F4C4} Vollmacht-Formular ansehen (PDF)"
              ),
              h("div", { style: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 } },
                h("input", { type: "checkbox", id: "vollmacht", checked: vollmachtChecked, onChange: function (e) { setVollmachtChecked(e.target.checked); }, style: { width: 18, height: 18, marginTop: 2, accentColor: GOLD_DARK, cursor: "pointer" } }),
                h("label", { htmlFor: "vollmacht", style: { fontSize: 14, color: TEXT, lineHeight: 1.5, cursor: "pointer" } },
                  "Ich erteile hiermit die Vollmacht, meine bestehenden Vertr\u00e4ge abzufragen. Ich habe die",
                  h("a", { href: "#", style: { color: GOLD_DARK } }, " Vollmachtsbedingungen"),
                  " gelesen und akzeptiere diese."
                )
              ),
              vollmachtChecked && h("div", null,
                h("div", { style: { fontSize: 14, fontWeight: 500, color: TEXT, marginBottom: 8 } }, "Unterschrift"),
                h(SignaturePad, { onSave: setSignature })
              )
            ),
            partner && h("div", { style: { background: "#fdf8e8", borderRadius: R, padding: 14, marginBottom: 18, border: "1px solid " + GOLD } },
              h("div", { style: { fontSize: 13, color: "#999", marginBottom: 2 } }, "Deine Daten werden gesendet an:"),
              h("div", { style: { fontWeight: 600, color: TEXT } }, partner.name + " \u2013 " + partner.role),
              h("div", { style: { fontSize: 13, color: "#666" } }, partner.email)
            ),
            !partner && h("div", { style: { background: "#fef8e8", borderRadius: R, padding: 14, marginBottom: 18, borderLeft: "3px solid " + GOLD_DARK } },
              h("div", { style: { fontSize: 14, color: "#666" } }, "\u26A0\uFE0F Kein Vertriebspartner zugewiesen. Bitte verwende den Link, den dir dein Berater geschickt hat.")
            ),
            submitError && h("div", { style: { background: "#fef0f0", borderRadius: R, padding: 12, marginBottom: 12, border: "1px solid #f5c6c6", color: "#c33", fontSize: 14 } },
              "\u26A0\uFE0F " + submitError
            )
          );

        default: return null;
      }
    }

    /* ══════════ LAYOUT ══════════ */
    return h("div", { style: { fontFamily: FONT, background: BG, color: TEXT } },
      h("div", { style: { maxWidth: 680, margin: "0 auto", padding: "24px 20px 80px" } },
        h(ProgressBar, { current: step, total: totalSteps }),

        h("div", { style: { background: BG, borderRadius: R, padding: "24px 20px", border: "1px solid #e5e5e5" } },
          h("h2", { style: assign({ fontSize: 20, fontWeight: 700, marginBottom: 2 }, hlStyle()) }, STEPS[step].title),
          h("p", { style: { fontSize: 14, color: "#999", marginBottom: 18 } }, STEPS[step].sub),
          renderStep()
        ),

        h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 16, gap: 12 } },
          h("button", {
            onClick: function () { setStep(function (s) { return Math.max(0, s - 1); }); },
            disabled: step === 0,
            style: {
              padding: "10px 22px", borderRadius: R, fontSize: 15, fontWeight: 600, fontFamily: "inherit",
              border: "1px solid #ddd", background: BG,
              color: step === 0 ? "#ccc" : TEXT, opacity: step === 0 ? 0.5 : 1,
              cursor: step === 0 ? "default" : "pointer",
            }
          }, "\u2190 Zur\u00fcck"),

          step < totalSteps - 1
            ? h("button", {
                onClick: function () { setStep(function (s) { return s + 1; }); },
                disabled: !canNext(),
                style: {
                  padding: "10px 28px", borderRadius: R, fontSize: 15, fontWeight: 600, fontFamily: "inherit",
                  border: "none", background: canNext() ? GOLD : "#e5e5e5",
                  color: canNext() ? TEXT : "#999", cursor: canNext() ? "pointer" : "default",
                }
              }, "Weiter \u2192")
            : h("button", {
                onClick: handleSubmit, disabled: submitting,
                style: {
                  padding: "10px 28px", borderRadius: R, fontSize: 15, fontWeight: 600, fontFamily: "inherit",
                  border: "none", background: submitting ? "#e5e5e5" : GOLD,
                  color: submitting ? "#999" : TEXT, cursor: submitting ? "wait" : "pointer",
                }
              }, submitting ? "\u23F3 Wird gesendet\u2026" : "\u2709\uFE0F Absenden")
        )
      )
    );
  }

  /* ═══════════════ MOUNT ═══════════════ */
  function mount() {
    var root = document.getElementById("quickcheck-root");
    if (!root) return;
    var partnerId = root.getAttribute("data-partner") || "";
    var reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(h(HaushaltskostenQuickcheck, { initialPartnerId: partnerId || null }));
  }

  function tryMount(attempts) {
    if (!window.React || !window.ReactDOM || !window.Recharts) {
      if (attempts > 0) {
        setTimeout(function () { tryMount(attempts - 1); }, 200);
      } else {
        console.error("Quickcheck: Dependencies nicht geladen (React/ReactDOM/Recharts).");
      }
      return;
    }
    /* Recharts-Referenz nochmal setzen (falls beim ersten Mal noch nicht da) */
    RC = window.Recharts;
    mount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { tryMount(30); });
  } else {
    tryMount(30);
  }

})();
