/* ═══════════════════════════════════════════════════════
   Haushaltskosten Quickcheck v3 – WordPress Edition
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

  /* ══════════ KATEGORIEN (neu: 30/30/30/10) ══════════ */
  var CATEGORIES = [
    { key: "wohnen", label: "Wohnkosten", optimal: 30, color: "#c6a559", icon: "\u{1F3E0}",
      fields: [
        { id: "miete", label: "Miete / Hypothek" },
        { id: "instandhaltung", label: "Instandhaltung" },
        { id: "strom", label: "Strom" },
        { id: "gas", label: "Gas" },
        { id: "wasser", label: "Wasser" },
      ]},
    { key: "konsum", label: "Konsum / Fixkosten", optimal: 30, color: "#1a1b25", icon: "\u{1F6D2}",
      fields: [
        { id: "lebensmittel", label: "Lebensmittel" },
        { id: "kleidung", label: "Kleidung" },
        { id: "kommunikation", label: "Kommunikation (Internet, Handy)" },
        { id: "abos", label: "Abos" },
        { id: "leasing", label: "Leasing / Kredit" },
        { id: "kfz", label: "KFZ" },
        { id: "haustiere", label: "Haustiere" },
        { id: "zigaretten", label: "Zigaretten" },
        { id: "geschenke", label: "Geschenke" },
        { id: "kinderbetreuung", label: "Kinder / Betreuung" },
        { id: "freizeit", label: "Freizeit / Hobbys" },
        { id: "urlaub", label: "Urlaub" },
        { id: "restaurant", label: "Restaurantbesuche" },
      ]},
    { key: "sparen", label: "Sparen / Investment", optimal: 30, color: "#7a6e2a", icon: "\u{1F3AF}",
      type: "sparen", fields: [] },
    { key: "versicherungen", label: "Versicherungen", optimal: 10, color: "#d4a84b", icon: "\u{1F6E1}\uFE0F",
      type: "versicherung", fields: [] },
  ];

  /* ── Versicherungs-Sparten ── */
  var VERSICHERUNG_SPARTEN = [
    { id: "eigenheim", label: "Eigenheimversicherung", hasQm: true },
    { id: "haushalt", label: "Haushaltsversicherung", hasQm: true },
    { id: "haftpflicht", label: "Haftpflichtversicherung" },
    { id: "rechtsschutz", label: "Rechtsschutzversicherung" },
    { id: "unfall", label: "Unfallversicherung" },
    { id: "kranken", label: "Krankenversicherung" },
    { id: "berufsunfaehigkeit", label: "Berufsunf\u00e4higkeitsversicherung" },
    { id: "kfzvers", label: "KFZ-Versicherung", hasBm: true },
    { id: "ableben", label: "Ablebensversicherung" },
    { id: "sonstige", label: "Sonstige Versicherung" },
  ];

  var FAMILIENSTAND_OPTS = ["Ledig", "Verheiratet", "Geschieden", "Verwitwet", "Eingetr. Partnerschaft"];

  function emptyPerson() {
    return { name: "", gebDatum: "", gebOrt: "", gebLand: "", familienstand: "", staatsangehoerigkeit: "",
      email: "", telefon: "", strasse: "", plz: "", ort: "", beruf: "", branche: "", iban: "",
      raucher: "", groesse: "", gewicht: "" };
  }
  function emptyKind() { return { name: "", gebDatum: "", gebOrt: "", groesse: "", gewicht: "" }; }
  function emptyVersicherung() {
    var v = {};
    VERSICHERUNG_SPARTEN.forEach(function (s) { v[s.id] = { betrag: "", gesellschaft: "", qm: "", bmstufe: "" }; });
    return v;
  }
  function emptySparen() {
    return { giroKontostand: "", giroBank: "", sparMonatlich: "", sparKontostand: "",
      bausparerMonatlich: "", bausparerKontostand: "", fonds: [], lvMonatlich: "", lvGesellschaft: "",
      goldMonatlich: "", goldKontostand: "" };
  }
  function emptyFonds() { return { name: "", isin: "", monatlich: "", kontostand: "" }; }

  /* ── Helpers ── */
  function hlStyle() {
    return { background: "linear-gradient(90deg, " + GOLD_DARK + " 0%, " + GOLD + " 100%)",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" };
  }
  function assign() {
    var t = {};
    for (var i = 0; i < arguments.length; i++) {
      var s = arguments[i];
      if (s) for (var k in s) if (s.hasOwnProperty(k)) t[k] = s[k];
    }
    return t;
  }

  var inp = { width: "100%", padding: "10px 12px", borderRadius: R, border: "1px solid #ddd",
    fontSize: 15, outline: "none", color: TEXT, boxSizing: "border-box", fontFamily: "inherit" };
  var inpSm = assign({}, inp, { fontSize: 13, padding: "8px 10px" });
  var ta = assign({}, inp, { minHeight: 100, resize: "vertical" });
  var sel = assign({}, inp, { background: BG });

  /* ═══════════════ SignaturePad ═══════════════ */
  function SignaturePad(props) {
    var canvasRef = useRef(null);
    var stateDrawing = useState(false); var isDrawing = stateDrawing[0]; var setIsDrawing = stateDrawing[1];
    var stateSig = useState(false); var hasSignature = stateSig[0]; var setHasSignature = stateSig[1];
    useEffect(function () {
      var canvas = canvasRef.current; if (!canvas) return;
      var rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width; canvas.height = 150;
      var ctx = canvas.getContext("2d"); ctx.strokeStyle = TEXT; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    }, []);
    function getPos(e) { var rect = canvasRef.current.getBoundingClientRect(); var t = e.touches ? e.touches[0] : e; return { x: t.clientX - rect.left, y: t.clientY - rect.top }; }
    function startDraw(e) { e.preventDefault(); var ctx = canvasRef.current.getContext("2d"); var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); setIsDrawing(true); }
    function draw(e) { if (!isDrawing) return; e.preventDefault(); var ctx = canvasRef.current.getContext("2d"); var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSignature(true); }
    function endDraw() { setIsDrawing(false); if (hasSignature && props.onSave) props.onSave(canvasRef.current.toDataURL()); }
    function clear() { var c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); setHasSignature(false); if (props.onSave) props.onSave(null); }
    return h("div", null,
      h("div", { style: { border: "1px solid #ddd", borderRadius: R, position: "relative", background: "#fafafa" } },
        h("canvas", { ref: canvasRef, onMouseDown: startDraw, onMouseMove: draw, onMouseUp: endDraw, onMouseLeave: endDraw,
          onTouchStart: startDraw, onTouchMove: draw, onTouchEnd: endDraw,
          style: { width: "100%", cursor: "crosshair", touchAction: "none", display: "block" } }),
        !hasSignature && h("div", { style: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#bbb", pointerEvents: "none", fontSize: 14 } }, "Hier unterschreiben")
      ),
      hasSignature && h("button", { onClick: clear, type: "button",
        style: { marginTop: 6, fontSize: 12, color: "#999", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" } }, "Unterschrift l\u00f6schen")
    );
  }

  /* ═══════════════ ProgressBar ═══════════════ */
  function ProgressBar(props) {
    var pct = ((props.current + 1) / props.total) * 100;
    return h("div", { style: { marginBottom: 28 } },
      h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#999", marginBottom: 6 } },
        h("span", null, "Schritt " + (props.current + 1) + " von " + props.total), h("span", null, Math.round(pct) + "%") ),
      h("div", { style: { height: 3, background: "#eee", borderRadius: R } },
        h("div", { style: { height: "100%", width: pct + "%", background: "linear-gradient(90deg, " + GOLD_DARK + ", " + GOLD + ")", borderRadius: R, transition: "width 0.4s ease" } }) )
    );
  }

  /* ═══════════════ CheckGroup ═══════════════ */
  function CheckGroup(props) {
    function toggle(opt) {
      if (props.selected.includes(opt)) props.onChange(props.selected.filter(function (s) { return s !== opt; }));
      else if (!props.max || props.selected.length < props.max) props.onChange(props.selected.concat([opt]));
    }
    return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 } },
      props.options.map(function (opt) {
        var a = props.selected.includes(opt);
        return h("button", { key: opt, type: "button", onClick: function () { toggle(opt); },
          style: { padding: "10px 14px", borderRadius: R, fontSize: 14, textAlign: "left", cursor: "pointer", transition: "all 0.15s",
            border: a ? "2px solid " + GOLD_DARK : "2px solid #e5e5e5", background: a ? "#fdf8e8" : BG, color: TEXT, fontWeight: a ? 600 : 400, fontFamily: "inherit" } },
          h("span", { style: { marginRight: 8, color: a ? GOLD_DARK : "#ccc" } }, a ? "\u2713" : "\u25CB"), opt );
      })
    );
  }

  /* ═══════════════ RadioGroup ═══════════════ */
  function RadioGroup(props) {
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
      props.options.map(function (opt) {
        var a = props.selected === opt;
        return h("button", { key: opt, type: "button", onClick: function () { props.onChange(opt); },
          style: { padding: "10px 14px", borderRadius: R, fontSize: 14, textAlign: "left", cursor: "pointer", transition: "all 0.15s",
            border: a ? "2px solid " + GOLD_DARK : "2px solid #e5e5e5", background: a ? "#fdf8e8" : BG, color: TEXT, fontWeight: a ? 600 : 400, fontFamily: "inherit" } },
          h("span", { style: { marginRight: 8, color: a ? GOLD_DARK : "#ccc" } }, a ? "\u25CF" : "\u25CB"), opt );
      })
    );
  }

  function CustomTooltip(props) {
    if (!props.active || !props.payload || !props.payload.length) return null;
    var d = props.payload[0].payload;
    return h("div", { style: { background: BG, border: "1px solid #e5e5e5", borderRadius: R, padding: "10px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" } },
      h("div", { style: { fontWeight: 600, color: TEXT, marginBottom: 4 } }, d.name),
      h("div", { style: { fontSize: 13, color: "#666" } }, "Aktuell: " + d.value + "% \u00b7 Optimal: " + d.optimal + "%") );
  }
  function secTitle(t) { return h("h3", { style: { fontSize: 14, fontWeight: 600, color: TEXT, margin: "18px 0 8px" } }, t); }

  /* ═══════════════ Formular-Helfer ═══════════════ */
  function field(lbl, value, onChange, opts) {
    opts = opts || {};
    var required = opts.required ? " *" : "";
    if (opts.type === "select") {
      return h("label", { style: { fontWeight: 500, fontSize: 13, color: TEXT, display: "block" } }, lbl + required,
        h("select", { style: assign({}, sel, { marginTop: 4 }), value: value, onChange: function (e) { onChange(e.target.value); } },
          h("option", { value: "" }, "\u2013 Bitte w\u00e4hlen \u2013"),
          (opts.options || []).map(function (o) { return h("option", { key: o, value: o }, o); }) ));
    }
    return h("label", { style: { fontWeight: 500, fontSize: 13, color: TEXT, display: "block" } }, lbl + required,
      h("input", { style: assign({}, opts.small ? inpSm : inp, { marginTop: 4 }), type: opts.type || "text",
        value: value, onChange: function (e) { onChange(e.target.value); }, placeholder: opts.placeholder || "" }) );
  }

  /* ═══════════════ PersonForm ═══════════════ */
  function PersonForm(props) {
    var p = props.data; var u = props.onChange;
    function set(k) { return function (v) { var n = assign({}, p); n[k] = v; u(n); }; }
    var g2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 };
    var g3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 };
    return h("div", { style: { border: "1px solid #eee", borderRadius: R, padding: 16, marginBottom: 14, background: "#fafafa" } },
      h("div", { style: assign({ fontSize: 15, fontWeight: 600, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid " + GOLD }, hlStyle()) }, props.label || "Person"),
      h("div", { style: g2 }, field("Name", p.name, set("name"), { required: true, placeholder: "Vor- und Nachname" }),
        field("Geburtsdatum", p.gebDatum, set("gebDatum"), { type: "date" }) ),
      h("div", { style: g3 }, field("Geburtsort", p.gebOrt, set("gebOrt")),
        field("Geburtsland", p.gebLand, set("gebLand"), { placeholder: "\u00d6sterreich" }),
        field("Staatsangeh\u00f6rigkeit", p.staatsangehoerigkeit, set("staatsangehoerigkeit"), { placeholder: "\u00d6sterreich" }) ),
      h("div", { style: g2 }, field("Familienstand", p.familienstand, set("familienstand"), { type: "select", options: FAMILIENSTAND_OPTS }),
        field("Raucher", p.raucher, set("raucher"), { type: "select", options: ["Nichtraucher", "Raucher"] }) ),
      h("div", { style: g2 }, field("E-Mail", p.email, set("email"), { type: "email", placeholder: "max@beispiel.at" }),
        field("Telefon", p.telefon, set("telefon"), { type: "tel", placeholder: "+43 ..." }) ),
      h("div", { style: g3 }, field("Stra\u00dfe & Nr.", p.strasse, set("strasse")),
        field("PLZ", p.plz, set("plz"), { placeholder: "1010" }), field("Ort", p.ort, set("ort"), { placeholder: "Wien" }) ),
      h("div", { style: g2 }, field("Beruf", p.beruf, set("beruf")), field("Branche", p.branche, set("branche")) ),
      h("div", { style: g3 }, field("IBAN", p.iban, set("iban"), { placeholder: "AT..." }),
        field("Gr\u00f6\u00dfe (cm)", p.groesse, set("groesse"), { type: "number", placeholder: "175" }),
        field("Gewicht (kg)", p.gewicht, set("gewicht"), { type: "number", placeholder: "75" }) )
    );
  }

  /* ═══════════════ KindForm ═══════════════ */
  function KindForm(props) {
    var k = props.data; var u = props.onChange;
    function set(key) { return function (v) { var n = assign({}, k); n[key] = v; u(n); }; }
    return h("div", { style: { border: "1px solid #eee", borderRadius: R, padding: 14, marginBottom: 10, background: "#fefef8" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } },
        h("span", { style: { fontSize: 14, fontWeight: 600, color: TEXT } }, "\u{1F476} Kind " + (props.index + 1)),
        h("button", { type: "button", onClick: props.onRemove, style: { background: "none", border: "none", color: "#d44", cursor: "pointer", fontSize: 18, padding: 0 } }, "\u00d7") ),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 } },
        field("Name", k.name, set("name")), field("Geburtsdatum", k.gebDatum, set("gebDatum"), { type: "date" }) ),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 } },
        field("Geburtsort", k.gebOrt, set("gebOrt")),
        field("Gr\u00f6\u00dfe (cm)", k.groesse, set("groesse"), { type: "number" }),
        field("Gewicht (kg)", k.gewicht, set("gewicht"), { type: "number" }) )
    );
  }

  /* ═══════════════════════════════════════════════════
     HAUPT-KOMPONENTE
     ═══════════════════════════════════════════════════ */
  function HaushaltskostenQuickcheck(props) {
    var sStep = useState(0); var step = sStep[0]; var setStep = sStep[1];
    var sPid = useState(props.initialPartnerId || null); var partnerId = sPid[0]; var setPartnerId = sPid[1];

    /* Einstiegsfragen */
    var sEinstieg = useState({ grund: "", erwartung: "", orientierung: "" }); var einstieg = sEinstieg[0]; var setEinstieg = sEinstieg[1];
    /* Kontaktdaten */
    var sZwei = useState(false); var zweiPersonen = sZwei[0]; var setZweiPersonen = sZwei[1];
    var sPersonA = useState(emptyPerson()); var personA = sPersonA[0]; var setPersonA = sPersonA[1];
    var sPersonB = useState(emptyPerson()); var personB = sPersonB[0]; var setPersonB = sPersonB[1];
    var sKinder = useState([]); var kinder = sKinder[0]; var setKinder = sKinder[1];
    /* Quickcheck */
    var sForm = useState({
      themen: [], themenSonstig: "", prioritaeten: [], wohnen: [], familie: [],
      pensionGefuehl: "", zukunftWunsch: "", pensionHoehe: "", pensionAlter: "",
      absicherung: [], investmentRisiko: "", investmentZeit: "",
      erfahrung: "", beratungWichtig: [], wichtigsteFrage: "", abschlussfrage: ""
    }); var form = sForm[0]; var setForm = sForm[1];
    /* Haushaltskosten */
    var sEinkA = useState(""); var einkommenA = sEinkA[0]; var setEinkommenA = sEinkA[1];
    var sEinkB = useState(""); var einkommenB = sEinkB[0]; var setEinkommenB = sEinkB[1];
    var sCosts = useState({}); var costs = sCosts[0]; var setCosts = sCosts[1];
    var sVers = useState(emptyVersicherung()); var versicherungen = sVers[0]; var setVersicherungen = sVers[1];
    var sSpar = useState(emptySparen()); var sparen = sSpar[0]; var setSparen = sSpar[1];
    /* Vollmacht */
    var sVoll = useState(false); var vollmachtChecked = sVoll[0]; var setVollmachtChecked = sVoll[1];
    var sSig = useState(null); var signature = sSig[0]; var setSignature = sSig[1];
    var sSub = useState(false); var submitted = sSub[0]; var setSubmitted = sSub[1];
    var sSubbing = useState(false); var submitting = sSubbing[0]; var setSubmitting = sSubbing[1];
    var sErr = useState(""); var submitError = sErr[0]; var setSubmitError = sErr[1];

    useEffect(function () {
      try { var p = new URLSearchParams(window.location.search).get("partner"); if (p && PARTNERS[p]) setPartnerId(p); } catch (e) {}
    }, []);

    var partner = partnerId ? PARTNERS[partnerId] : null;

    function updateForm(k, v) { setForm(function (prev) { var n = assign({}, prev); n[k] = v; return n; }); }
    function updateCost(id, v) { setCosts(function (prev) { var n = assign({}, prev); n[id] = v; return n; }); }
    function updateEinstieg(k, v) { setEinstieg(function (prev) { var n = assign({}, prev); n[k] = v; return n; }); }
    function updateVers(sid, key, v) {
      setVersicherungen(function (prev) { var n = assign({}, prev); n[sid] = assign({}, n[sid]); n[sid][key] = v; return n; });
    }
    function updateSparen(k, v) { setSparen(function (prev) { var n = assign({}, prev); n[k] = v; return n; }); }
    function updateFonds(idx, key, v) {
      setSparen(function (prev) { var n = assign({}, prev); var f = prev.fonds.map(function (x) { return assign({}, x); }); f[idx][key] = v; n.fonds = f; return n; });
    }
    function addFonds() { setSparen(function (prev) { var n = assign({}, prev); n.fonds = prev.fonds.concat([emptyFonds()]); return n; }); }
    function removeFonds(idx) { setSparen(function (prev) { var n = assign({}, prev); n.fonds = prev.fonds.filter(function (_, i) { return i !== idx; }); return n; }); }
    function addKind() { setKinder(function (prev) { return prev.concat([emptyKind()]); }); }
    function removeKind(idx) { setKinder(function (prev) { return prev.filter(function (_, i) { return i !== idx; }); }); }
    function updateKind(idx, data) { setKinder(function (prev) { return prev.map(function (k, i) { return i === idx ? data : k; }); }); }

    /* Berechnungen */
    function getSimpleCatTotal(cat) { return cat.fields.reduce(function (s, f) { return s + (parseFloat(costs[f.id]) || 0); }, 0); }
    function getVersicherungenTotal() { var t = 0; VERSICHERUNG_SPARTEN.forEach(function (s) { t += (parseFloat(versicherungen[s.id].betrag) || 0); }); return t; }
    function getSparenTotal() {
      var t = (parseFloat(sparen.sparMonatlich) || 0) + (parseFloat(sparen.bausparerMonatlich) || 0) + (parseFloat(sparen.lvMonatlich) || 0) + (parseFloat(sparen.goldMonatlich) || 0);
      sparen.fonds.forEach(function (f) { t += (parseFloat(f.monatlich) || 0); }); return t;
    }
    function getCategoryTotal(cat) {
      if (cat.type === "versicherung") return getVersicherungenTotal();
      if (cat.type === "sparen") return getSparenTotal();
      return getSimpleCatTotal(cat);
    }
    var totalCosts = CATEGORIES.reduce(function (s, cat) { return s + getCategoryTotal(cat); }, 0);

    function getChartData() {
      if (totalCosts === 0) return [];
      return CATEGORIES.map(function (cat) {
        return { name: cat.label, value: Math.round((getCategoryTotal(cat) / totalCosts) * 100), optimal: cat.optimal, color: cat.color, euro: getCategoryTotal(cat) };
      });
    }

    /* Neue Farblogik */
    function getRecommendation(cat) {
      if (totalCosts === 0) return null;
      var pct = Math.round((getCategoryTotal(cat) / totalCosts) * 100);
      var diff = pct - cat.optimal;
      if (cat.key === "wohnen" || cat.key === "konsum") {
        if (pct <= cat.optimal) return { type: "ok", text: "Im gr\u00fcnen Bereich (" + pct + "%) \u2713" };
        return { type: "high", text: pct + "% \u2013 " + Math.round(diff) + "% \u00fcber dem Optimum von " + cat.optimal + "%. Einsparpotenzial pr\u00fcfen." };
      }
      if (cat.key === "versicherungen") {
        if (pct === cat.optimal) return { type: "ok", text: "Exakt im Optimum (" + pct + "%) \u2713" };
        if (pct > cat.optimal) return { type: "high", text: pct + "% \u2013 " + Math.round(diff) + "% \u00fcber dem Optimum. Pr\u00fcfen, ob Einsparungen m\u00f6glich." };
        return { type: "high", text: pct + "% \u2013 " + Math.round(Math.abs(diff)) + "% unter dem Optimum. M\u00f6glicherweise unterversichert." };
      }
      if (cat.key === "sparen") {
        if (pct >= cat.optimal) return { type: "ok", text: "Im gr\u00fcnen Bereich (" + pct + "%) \u2713" };
        return { type: "high", text: pct + "% \u2013 " + Math.round(Math.abs(diff)) + "% unter dem Optimum von " + cat.optimal + "%. Sparquote erh\u00f6hen." };
      }
      return null;
    }

    function getGesellschaften() {
      var set = {};
      VERSICHERUNG_SPARTEN.forEach(function (s) { var g = (versicherungen[s.id].gesellschaft || "").trim(); if (g) set[g] = true; });
      var lv = (sparen.lvGesellschaft || "").trim(); if (lv) set[lv] = true;
      return Object.keys(set);
    }

    /* Steps */
    var STEPS = [
      { title: "Willkommen", sub: "Dein pers\u00f6nlicher Finanz-Quickcheck" },
      { title: "Deine Kontaktdaten", sub: "Damit wir dich bestm\u00f6glich beraten k\u00f6nnen" },
      { title: "1. Aktuelle Themen", sub: "Welche Themen besch\u00e4ftigen dich aktuell oder in naher Zukunft?" },
      { title: "2. Priorit\u00e4ten", sub: "Bitte w\u00e4hle maximal 3 Hauptpriorit\u00e4ten" },
      { title: "3. Wohnen & Immobilie", sub: "Trifft aktuell oder zuk\u00fcnftig zu?" },
      { title: "4. Familie & Zukunft", sub: "Was trifft auf dich zu?" },
      { title: "5. Pension & langfristige Ziele", sub: "Wie f\u00fchlst du dich beim Thema Pension?" },
      { title: "6. Absicherung", sub: "Welche Bereiche m\u00f6chtest du abgesichert wissen?" },
      { title: "7. Investment & Verm\u00f6gensaufbau", sub: "Deine Einstellung zu Risiko und Zeithorizont" },
      { title: "8. Erfahrung & Erwartungen", sub: "Deine bisherigen Erfahrungen" },
      { title: "9. Die wichtigste Frage", sub: "Nimm dir einen Moment Zeit" },
      { title: "Haushaltskosten-Check", sub: "Monatliche Ausgaben je Bereich" },
      { title: "Dein Ergebnis", sub: "Analyse deiner Haushaltskosten" },
      { title: "Vollmacht & Absenden", sub: "Letzte Schritte" },
    ];
    var totalSteps = STEPS.length;

    function canNext() {
      if (step === 1) return personA.name.trim().length > 0;
      if (step === 10) return form.wichtigsteFrage.trim().length > 0;
      return true;
    }

    /* Submit */
    function handleSubmit() {
      setSubmitting(true); setSubmitError("");
      var payload = {
        partnerId: partnerId || "", partner: partner || "Kein Partner",
        einstiegsfragen: einstieg, kontaktPersonen: zweiPersonen ? 2 : 1,
        personA: personA, personB: zweiPersonen ? personB : null, kinder: kinder,
        kontakt: { name: personA.name, email: personA.email, telefon: personA.telefon },
        quickcheck: form, einkommen: (parseFloat(einkommenA) || 0) + (zweiPersonen ? (parseFloat(einkommenB) || 0) : 0),
        einkommenA: parseFloat(einkommenA) || 0, einkommenB: zweiPersonen ? (parseFloat(einkommenB) || 0) : null,
        kosten: costs, versicherungen: versicherungen, sparen: sparen,
        kategorien: CATEGORIES.map(function (cat) {
          return { name: cat.label, betrag: getCategoryTotal(cat), prozent: totalCosts > 0 ? Math.round((getCategoryTotal(cat) / totalCosts) * 100) : 0, optimal: cat.optimal };
        }),
        gesellschaften: getGesellschaften(), vollmacht: vollmachtChecked, signatur: signature ? "vorhanden" : "keine"
      };
      if (typeof qcAjax !== "undefined" && qcAjax.url) {
        var formData = new FormData();
        formData.append("action", "qc_submit"); formData.append("nonce", qcAjax.nonce);
        formData.append("payload", JSON.stringify(payload));
        fetch(qcAjax.url, { method: "POST", body: formData })
          .then(function (res) { return res.json(); })
          .then(function (data) { if (!data.success) throw new Error(data.data || "Fehler beim Senden."); setSubmitted(true); })
          .catch(function (err) { console.error("Submit Error:", err); setSubmitError(err.message || "Ein Fehler ist aufgetreten."); })
          .finally(function () { setSubmitting(false); });
      } else { console.log("Submit:", JSON.stringify(payload, null, 2)); setSubmitted(true); setSubmitting(false); }
    }

    useEffect(function () { var el = document.getElementById("quickcheck-root"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, [step]);

    if (submitted) {
      return h("div", { style: { fontFamily: FONT, padding: 40, textAlign: "center", color: TEXT, background: BG } },
        h("div", { style: { fontSize: 56, marginBottom: 16 } }, "\u2705"),
        h("h2", { style: assign({ fontSize: 22, marginBottom: 8 }, hlStyle()) }, "Vielen Dank, " + personA.name + "!"),
        h("p", { style: { color: "#666", lineHeight: 1.6 } }, "Ihr Quickcheck wurde erfolgreich \u00fcbermittelt.",
          partner ? h("span", null, h("br"), partner.name + " wird sich in K\u00fcrze bei dir melden.") : null ) );
    }

    /* ══════════ Hilfs-Renderer ══════════ */
    function renderSimpleCat(cat) {
      return h("div", { key: cat.key, style: { marginBottom: 22 } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 } },
          h("span", { style: { fontSize: 18 } }, cat.icon), h("span", { style: { fontWeight: 600, color: TEXT } }, cat.label),
          h("span", { style: { fontSize: 12, color: "#999", marginLeft: "auto" } }, "Optimal: " + cat.optimal + "%") ),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, paddingLeft: 26 } },
          cat.fields.map(function (f) {
            return h("label", { key: f.id, style: { fontSize: 13, color: TEXT } }, f.label,
              h("div", { style: { position: "relative", marginTop: 2 } },
                h("input", { style: assign({}, inpSm, { paddingLeft: 22 }), type: "number", value: costs[f.id] || "", onChange: function (e) { updateCost(f.id, e.target.value); }, placeholder: "0" }),
                h("span", { style: { position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#bbb", fontSize: 12 } }, "\u20AC") ));
          }) ));
    }
    function euroField(label, value, onChange) {
      return h("label", { style: { fontSize: 12, color: TEXT } }, label,
        h("div", { style: { position: "relative", marginTop: 2 } },
          h("input", { style: assign({}, inpSm, { paddingLeft: 22 }), type: "number", value: value, onChange: function (e) { onChange(e.target.value); }, placeholder: "0" }),
          h("span", { style: { position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#bbb", fontSize: 11 } }, "\u20AC") ));
    }
    function sparBlock(title, mKey, kKey) {
      return h("div", { style: { marginBottom: 12, padding: "10px 12px", background: "#fafafa", borderRadius: R, border: "1px solid #eee" } },
        h("div", { style: { fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 } }, title),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
          euroField("Mtl. Sparrate", sparen[mKey], function (v) { updateSparen(mKey, v); }),
          euroField("Kontostand", sparen[kKey], function (v) { updateSparen(kKey, v); }) ));
    }

    /* ══════════ STEP RENDERER ══════════ */
    function renderStep() {
      switch (step) {

        /* 0: Willkommen + Einstiegsfragen */
        case 0:
          return h("div", { style: { textAlign: "center", padding: "16px 0" } },
            h("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u{1F4CA}"),
            h("h2", { style: assign({ fontSize: 22, marginBottom: 8 }, hlStyle()) }, "Haushaltskosten-Quickcheck"),
            h("p", { style: { color: "#666", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 20px", fontSize: 14 } },
              "In wenigen Minuten erh\u00e4ltst du einen klaren \u00dcberblick \u00fcber deine finanzielle Situation und konkrete Handlungsempfehlungen." ),
            partner && h("div", { style: { background: "#fdf8e8", borderRadius: R, padding: "12px 18px", display: "inline-block", border: "1px solid " + GOLD, marginBottom: 20 } },
              h("div", { style: { fontSize: 12, color: "#999" } }, "Dein Berater"),
              h("div", { style: { fontWeight: 600, color: TEXT } }, partner.name),
              h("div", { style: { fontSize: 13, color: "#666" } }, partner.role + (partner.phone ? " \u00b7 " + partner.phone : "")) ),
            h("div", { style: { textAlign: "left", maxWidth: 520, margin: "0 auto" } },
              h("div", { style: { fontWeight: 600, marginBottom: 14, color: TEXT, fontSize: 15 } }, "Zum Einstieg drei kurze Fragen:"),
              h("label", { style: { display: "block", marginBottom: 14, fontSize: 14, color: "#555" } },
                "\u201EWas war der Grund, warum du dir heute Zeit genommen hast?\u201C",
                h("textarea", { style: assign({}, ta, { minHeight: 60, marginTop: 6 }), value: einstieg.grund, onChange: function (e) { updateEinstieg("grund", e.target.value); } }) ),
              h("label", { style: { display: "block", marginBottom: 14, fontSize: 14, color: "#555" } },
                "\u201EWas m\u00fcsste heute passieren, damit es sich f\u00fcr dich gelohnt hat?\u201C",
                h("textarea", { style: assign({}, ta, { minHeight: 60, marginTop: 6 }), value: einstieg.erwartung, onChange: function (e) { updateEinstieg("erwartung", e.target.value); } }) ),
              h("label", { style: { display: "block", marginBottom: 6, fontSize: 14, color: "#555" } },
                "\u201EGeht es eher um Orientierung oder um eine Entscheidung?\u201C",
                h("textarea", { style: assign({}, ta, { minHeight: 60, marginTop: 6 }), value: einstieg.orientierung, onChange: function (e) { updateEinstieg("orientierung", e.target.value); } }) )
            )
          );

        /* 1: Kontaktdaten */
        case 1:
          return h("div", null,
            h("div", { style: { display: "flex", gap: 10, marginBottom: 18 } },
              h("button", { type: "button", onClick: function () { setZweiPersonen(false); },
                style: { flex: 1, padding: "10px 14px", borderRadius: R, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                  border: !zweiPersonen ? "2px solid " + GOLD_DARK : "2px solid #e5e5e5", background: !zweiPersonen ? "#fdf8e8" : BG, color: TEXT, fontWeight: !zweiPersonen ? 600 : 400 } }, "\u{1F464} Eine Person"),
              h("button", { type: "button", onClick: function () { setZweiPersonen(true); },
                style: { flex: 1, padding: "10px 14px", borderRadius: R, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                  border: zweiPersonen ? "2px solid " + GOLD_DARK : "2px solid #e5e5e5", background: zweiPersonen ? "#fdf8e8" : BG, color: TEXT, fontWeight: zweiPersonen ? 600 : 400 } }, "\u{1F465} Zwei Personen") ),
            h(PersonForm, { label: zweiPersonen ? "Person A" : "Deine Daten", data: personA, onChange: setPersonA }),
            zweiPersonen && h(PersonForm, { label: "Person B", data: personB, onChange: setPersonB }),
            h("div", { style: { marginTop: 8 } },
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } },
                h("span", { style: { fontWeight: 600, fontSize: 15, color: TEXT } }, "Kinder"),
                h("button", { type: "button", onClick: addKind,
                  style: { padding: "6px 14px", borderRadius: R, fontSize: 13, fontWeight: 600, fontFamily: "inherit", border: "none", background: GOLD, color: TEXT, cursor: "pointer" } }, "+ Kind hinzuf\u00fcgen") ),
              kinder.length === 0 && h("div", { style: { fontSize: 13, color: "#999", padding: "8px 0" } }, "Keine Kinder angegeben."),
              kinder.map(function (kind, idx) {
                return h(KindForm, { key: idx, index: idx, data: kind, onChange: function (d) { updateKind(idx, d); }, onRemove: function () { removeKind(idx); } });
              }) )
          );

        /* 2: Themen */
        case 2:
          return h("div", null,
            h(CheckGroup, { options: ["Haus bauen","Wohnung kaufen","Miete / Wohnen optimieren","Umschuldung / Finanzierung pr\u00fcfen","F\u00f6rderungen nutzen","Verm\u00f6gensaufbau","Pension / Altersvorsorge","Absicherung Familie","Absicherung Einkommen","Investment / Geldanlage","Privatversicherung / Gesundheit","Einkommenssituation verbessern","R\u00fccklagen aufbauen","Reisen & Lebensqualit\u00e4t","Sonstiges"], selected: form.themen, onChange: function (v) { updateForm("themen", v); } }),
            form.themen.includes("Sonstiges") && h("input", { style: assign({}, inp, { marginTop: 12 }), value: form.themenSonstig, onChange: function (e) { updateForm("themenSonstig", e.target.value); }, placeholder: "Bitte beschreiben\u2026" }) );

        /* 3: Priorit\u00e4ten */
        case 3:
          return h("div", null,
            form.prioritaeten.length >= 3 && h("div", { style: { fontSize: 13, color: GOLD_DARK, marginBottom: 8 } }, "Maximum von 3 erreicht"),
            h(CheckGroup, { max: 3, options: ["Sicherheit","Wachstum / Rendite","Flexibilit\u00e4t","Planbarkeit","Steuerliche Vorteile","F\u00f6rderung nutzen","Langfristiger Verm\u00f6gensaufbau","Kurzfristige Liquidit\u00e4t","Absicherung","Unabh\u00e4ngigkeit"], selected: form.prioritaeten, onChange: function (v) { updateForm("prioritaeten", v); } }) );

        /* 4: Wohnen */
        case 4:
          return h(CheckGroup, { options: ["Kein Thema","Haus bauen","Wohnung kaufen","Sanieren / Umbauen","Bestehende Finanzierung optimieren"], selected: form.wohnen, onChange: function (v) { updateForm("wohnen", v); } });

        /* 5: Familie */
        case 5:
          return h(CheckGroup, { options: ["Kinder vorhanden","Kinder geplant","Ausbildung der Kinder absichern","Familie finanziell absichern","Pflege von Angeh\u00f6rigen relevant"], selected: form.familie, onChange: function (v) { updateForm("familie", v); } });

        /* 6: Pension (erweitert) */
        case 6:
          return h("div", null,
            h(RadioGroup, { options: ["Sehr entspannt","Eher entspannt","Unsicher","Sorgevoll"], selected: form.pensionGefuehl, onChange: function (v) { updateForm("pensionGefuehl", v); } }),
            secTitle("Wie hoch muss deine Pension sein und wann willst du in Pension gehen?"),
            h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 } },
              h("label", { style: { fontWeight: 500, fontSize: 14, color: TEXT } }, "Gew\u00fcnschte Pensionsh\u00f6he (\u20AC mtl.)",
                h("div", { style: { position: "relative", marginTop: 4 } },
                  h("input", { style: assign({}, inp, { paddingLeft: 28 }), type: "number", value: form.pensionHoehe, onChange: function (e) { updateForm("pensionHoehe", e.target.value); }, placeholder: "z.B. 2000" }),
                  h("span", { style: { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#999" } }, "\u20AC") ) ),
              h("label", { style: { fontWeight: 500, fontSize: 14, color: TEXT } }, "Gew\u00fcnschtes Pensionsalter",
                h("input", { style: assign({}, inp, { marginTop: 4 }), type: "number", value: form.pensionAlter, onChange: function (e) { updateForm("pensionAlter", e.target.value); }, placeholder: "z.B. 60" }) ) ),
            secTitle("Was w\u00fcnschst du dir f\u00fcr deine Zukunft?"),
            h("textarea", { style: ta, value: form.zukunftWunsch, onChange: function (e) { updateForm("zukunftWunsch", e.target.value); }, placeholder: "Deine W\u00fcnsche und Vorstellungen\u2026" }) );

        /* 7: Absicherung */
        case 7:
          return h(CheckGroup, { options: ["Einkommen","Familie","Krankheit","Unfall","Pflege","Haftung","Noch nicht besch\u00e4ftigt"], selected: form.absicherung, onChange: function (v) { updateForm("absicherung", v); } });

        /* 8: Investment */
        case 8:
          return h("div", null,
            secTitle("Welche Aussage passt am ehesten zu dir?"),
            h(RadioGroup, { options: ["Sicherheit ist mir wichtiger als Rendite","Ausgewogen: Sicherheit & Wachstum","Wachstum ist mir wichtiger als Sicherheit"], selected: form.investmentRisiko, onChange: function (v) { updateForm("investmentRisiko", v); } }),
            secTitle("Zeithorizont"),
            h(RadioGroup, { options: ["Kurzfristig (0\u20133 Jahre)","Mittelfristig (3\u201310 Jahre)","Langfristig (10+ Jahre)"], selected: form.investmentZeit, onChange: function (v) { updateForm("investmentZeit", v); } }) );

        /* 9: Erfahrung */
        case 9:
          return h("div", null,
            secTitle("Bisherige Erfahrungen mit Finanzthemen"),
            h(RadioGroup, { options: ["Sehr gute","Gemischte","Eher negative","Kaum Erfahrung"], selected: form.erfahrung, onChange: function (v) { updateForm("erfahrung", v); } }),
            secTitle("Was ist dir in der Beratung besonders wichtig?"),
            h(CheckGroup, { options: ["Verst\u00e4ndliche Erkl\u00e4rungen","Transparenz","Langfristige Begleitung","Sicherheit","Unabh\u00e4ngigkeit","Vergleichsm\u00f6glichkeiten"], selected: form.beratungWichtig, onChange: function (v) { updateForm("beratungWichtig", v); } }) );

        /* 10: Wichtigste Frage + Abschlussfrage (zusammengefasst) */
        case 10:
          return h("div", null,
            h("div", { style: { background: "#fdf8e8", borderLeft: "3px solid " + GOLD_DARK, padding: "10px 14px", borderRadius: "0 " + R + "px " + R + "px 0", marginBottom: 14, fontSize: 14, color: "#666" } }, "Pflichtfeld \u2013 nimm dir einen Moment Zeit."),
            h("label", { style: { display: "block", marginBottom: 16, fontSize: 14, color: "#555" } },
              "Was ist dir pers\u00f6nlich beim Thema Finanzen am wichtigsten?",
              h("textarea", { style: assign({}, ta, { marginTop: 6 }), value: form.wichtigsteFrage, onChange: function (e) { updateForm("wichtigsteFrage", e.target.value); }, placeholder: "Was ist dir pers\u00f6nlich beim Thema Finanzen am wichtigsten?" }) ),
            h("label", { style: { display: "block", fontSize: 14, color: "#555" } },
              "Was darf in einem Finanzkonzept f\u00fcr dich auf keinen Fall fehlen?",
              h("textarea", { style: assign({}, ta, { marginTop: 6 }), value: form.abschlussfrage, onChange: function (e) { updateForm("abschlussfrage", e.target.value); }, placeholder: "Was darf in einem Finanzkonzept f\u00fcr dich auf keinen Fall fehlen?" }) ) );

        /* 11: Haushaltskosten (komplett neu) */
        case 11:
          return h("div", null,
            zweiPersonen
              ? h("div", { style: { marginBottom: 18 } },
                  h("div", { style: { fontWeight: 600, fontSize: 14, color: TEXT, marginBottom: 10 } }, "Monatliches Netto-Einkommen"),
                  h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } },
                    h("label", { style: { fontWeight: 500, fontSize: 13, color: TEXT, display: "block" } }, (personA.name || "Person A"),
                      h("div", { style: { position: "relative", marginTop: 4 } },
                        h("input", { style: assign({}, inp, { paddingLeft: 28 }), type: "number", value: einkommenA, onChange: function (e) { setEinkommenA(e.target.value); }, placeholder: "z.B. 2500" }),
                        h("span", { style: { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#999" } }, "\u20AC") ) ),
                    h("label", { style: { fontWeight: 500, fontSize: 13, color: TEXT, display: "block" } }, (personB.name || "Person B"),
                      h("div", { style: { position: "relative", marginTop: 4 } },
                        h("input", { style: assign({}, inp, { paddingLeft: 28 }), type: "number", value: einkommenB, onChange: function (e) { setEinkommenB(e.target.value); }, placeholder: "z.B. 2500" }),
                        h("span", { style: { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#999" } }, "\u20AC") ) ) ),
                  h("div", { style: { fontSize: 13, color: "#999", marginTop: 6, textAlign: "right" } }, "Gesamt: \u20AC " + ((parseFloat(einkommenA) || 0) + (parseFloat(einkommenB) || 0)).toLocaleString("de-AT")) )
              : h("label", { style: { fontWeight: 600, fontSize: 14, display: "block", marginBottom: 18, color: TEXT } },
                  "Monatliches Netto-Einkommen",
                  h("div", { style: { position: "relative", marginTop: 4 } },
                    h("input", { style: assign({}, inp, { paddingLeft: 28 }), type: "number", value: einkommenA, onChange: function (e) { setEinkommenA(e.target.value); }, placeholder: "z.B. 3500" }),
                    h("span", { style: { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#999" } }, "\u20AC") ) ),
            renderSimpleCat(CATEGORIES[0]),
            renderSimpleCat(CATEGORIES[1]),
            /* Sparen / Investment */
            h("div", { style: { marginBottom: 22 } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } },
                h("span", { style: { fontSize: 18 } }, "\u{1F3AF}"), h("span", { style: { fontWeight: 600, color: TEXT } }, "Sparen / Investment"),
                h("span", { style: { fontSize: 12, color: "#999", marginLeft: "auto" } }, "Optimal: 30%") ),
              h("div", { style: { paddingLeft: 26 } },
                h("div", { style: { marginBottom: 12, padding: "10px 12px", background: "#fafafa", borderRadius: R, border: "1px solid #eee" } },
                  h("div", { style: { fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 } }, "Girokonto"),
                  h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                    euroField("Kontostand", sparen.giroKontostand, function (v) { updateSparen("giroKontostand", v); }),
                    h("label", { style: { fontSize: 12, color: TEXT } }, "Bank",
                      h("input", { style: assign({}, inpSm, { marginTop: 2 }), value: sparen.giroBank, onChange: function (e) { updateSparen("giroBank", e.target.value); }, placeholder: "Bankname" }) ) ) ),
                sparBlock("Sparkonto", "sparMonatlich", "sparKontostand"),
                sparBlock("Bausparer", "bausparerMonatlich", "bausparerKontostand"),
                h("div", { style: { marginBottom: 12, padding: "10px 12px", background: "#fafafa", borderRadius: R, border: "1px solid #eee" } },
                  h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                    h("span", { style: { fontSize: 13, fontWeight: 600, color: TEXT } }, "Fonds / ETF"),
                    h("button", { type: "button", onClick: addFonds,
                      style: { padding: "3px 10px", borderRadius: R, fontSize: 12, fontWeight: 600, fontFamily: "inherit", border: "none", background: GOLD, color: TEXT, cursor: "pointer" } }, "+ Fonds") ),
                  sparen.fonds.length === 0 && h("div", { style: { fontSize: 12, color: "#999", padding: "4px 0" } }, "Noch keine Fonds angelegt."),
                  sparen.fonds.map(function (f, idx) {
                    return h("div", { key: idx, style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 6, marginBottom: 6, alignItems: "end" } },
                      h("label", { style: { fontSize: 12, color: TEXT } }, "Name",
                        h("input", { style: assign({}, inpSm, { marginTop: 2 }), value: f.name, onChange: function (e) { updateFonds(idx, "name", e.target.value); }, placeholder: "Fondsname" }) ),
                      h("label", { style: { fontSize: 12, color: TEXT } }, "ISIN",
                        h("input", { style: assign({}, inpSm, { marginTop: 2 }), value: f.isin, onChange: function (e) { updateFonds(idx, "isin", e.target.value); }, placeholder: "ISIN" }) ),
                      euroField("Mtl. Sparrate", f.monatlich, function (v) { updateFonds(idx, "monatlich", v); }),
                      euroField("Kontostand", f.kontostand, function (v) { updateFonds(idx, "kontostand", v); }),
                      h("button", { type: "button", onClick: function () { removeFonds(idx); },
                        style: { background: "none", border: "none", color: "#d44", cursor: "pointer", fontSize: 16, padding: "6px", marginBottom: 2 } }, "\u00d7") );
                  }) ),
                h("div", { style: { marginBottom: 12, padding: "10px 12px", background: "#fafafa", borderRadius: R, border: "1px solid #eee" } },
                  h("div", { style: { fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 } }, "Lebensversicherung"),
                  h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                    euroField("Mtl. Sparrate", sparen.lvMonatlich, function (v) { updateSparen("lvMonatlich", v); }),
                    h("label", { style: { fontSize: 12, color: TEXT } }, "Gesellschaft",
                      h("input", { style: assign({}, inpSm, { marginTop: 2 }), value: sparen.lvGesellschaft, onChange: function (e) { updateSparen("lvGesellschaft", e.target.value); }, placeholder: "Versicherung" }) ) ) ),
                sparBlock("Gold / Sonstiges", "goldMonatlich", "goldKontostand") ) ),
            /* Versicherungen */
            h("div", { style: { marginBottom: 14 } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } },
                h("span", { style: { fontSize: 18 } }, "\u{1F6E1}\uFE0F"), h("span", { style: { fontWeight: 600, color: TEXT } }, "Versicherungen"),
                h("span", { style: { fontSize: 12, color: "#999", marginLeft: "auto" } }, "Optimal: 10%") ),
              h("div", { style: { paddingLeft: 26 } },
                VERSICHERUNG_SPARTEN.map(function (sp) {
                  var v = versicherungen[sp.id];
                  return h("div", { key: sp.id, style: { marginBottom: 10, padding: "10px 12px", background: "#fafafa", borderRadius: R, border: "1px solid #eee" } },
                    h("div", { style: { fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 } }, sp.label),
                    h("div", { style: { display: "grid", gridTemplateColumns: sp.hasQm || sp.hasBm ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8 } },
                      euroField("Monatl. Pr\u00e4mie", v.betrag, function (val) { updateVers(sp.id, "betrag", val); }),
                      h("label", { style: { fontSize: 12, color: TEXT } }, "Gesellschaft",
                        h("input", { style: assign({}, inpSm, { marginTop: 2 }), value: v.gesellschaft, onChange: function (e) { updateVers(sp.id, "gesellschaft", e.target.value); }, placeholder: "Versicherung" }) ),
                      sp.hasQm && h("label", { style: { fontSize: 12, color: TEXT } }, "m\u00b2",
                        h("input", { style: assign({}, inpSm, { marginTop: 2 }), type: "number", value: v.qm, onChange: function (e) { updateVers(sp.id, "qm", e.target.value); }, placeholder: "m\u00b2" }) ),
                      sp.hasBm && h("label", { style: { fontSize: 12, color: TEXT } }, "BM-Stufe",
                        h("input", { style: assign({}, inpSm, { marginTop: 2 }), value: v.bmstufe, onChange: function (e) { updateVers(sp.id, "bmstufe", e.target.value); }, placeholder: "z.B. 0" }) ) ));
                }) ) ) );

        /* 12: Ergebnis */
        case 12:
          var chartData = getChartData(); var einkommenNum = (parseFloat(einkommenA) || 0) + (zweiPersonen ? (parseFloat(einkommenB) || 0) : 0);
          return h("div", null,
            totalCosts === 0
              ? h("div", { style: { textAlign: "center", padding: 32, color: "#999" } }, "Bitte gib im vorherigen Schritt deine monatlichen Ausgaben ein.")
              : h("div", null,
                  h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 24 } },
                    [{ label: "Einkommen", val: einkommenNum, bg: "#fdf8e8" }, { label: "Ausgaben gesamt", val: totalCosts, bg: "#fafafa" },
                     { label: "Differenz", val: einkommenNum - totalCosts, bg: einkommenNum - totalCosts >= 0 ? "#fdf8e8" : "#fef0f0" }
                    ].map(function (c, i) {
                      return h("div", { key: i, style: { background: c.bg, borderRadius: R, padding: 12, textAlign: "center", border: "1px solid #eee" } },
                        h("div", { style: { fontSize: 12, color: "#999" } }, c.label),
                        h("div", { style: { fontSize: 18, fontWeight: 700, color: TEXT } }, "\u20AC " + c.val.toLocaleString("de-AT")) );
                    }) ),
                  h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
                    h("h3", { style: assign({ fontSize: 16, fontWeight: 600, marginBottom: 4 }, hlStyle()) }, "Deine tats\u00e4chliche Verteilung"),
                    h("p", { style: { fontSize: 13, color: "#999", marginBottom: 8 } }, "Optimale Verteilung: 30 / 30 / 30 / 10"),
                    h(RC.ResponsiveContainer, { width: "100%", height: 310 },
                      h(RC.PieChart, null,
                        h(RC.Pie, { data: chartData, cx: "50%", cy: "52%", innerRadius: 55, outerRadius: 105, paddingAngle: 2, dataKey: "value",
                          label: function (p) { return p.value + "%"; }, labelLine: false },
                          chartData.map(function (entry, i) { return h(RC.Cell, { key: i, fill: entry.color, stroke: "#fff", strokeWidth: 2 }); }) ),
                        h(RC.Tooltip, { content: h(CustomTooltip) }),
                        h(RC.Legend, { formatter: function (v) { return h("span", { style: { fontSize: 13, color: "#666" } }, v); } }) ) ) ),
                  h("div", { style: { marginTop: 20 } },
                    h("h3", { style: assign({ fontSize: 16, fontWeight: 600, marginBottom: 12 }, hlStyle()) }, "Handlungsempfehlungen"),
                    CATEGORIES.map(function (cat) {
                      var rec = getRecommendation(cat); var pct = Math.round((getCategoryTotal(cat) / totalCosts) * 100);
                      if (!rec) return null;
                      var isOk = rec.type === "ok";
                      var s = isOk ? { bg: "#e8f5e9", brd: "#4caf50", cl: "#2e7d32" } : { bg: "#fef0f0", brd: "#d44", cl: "#c33" };
                      return h("div", { key: cat.key, style: { background: s.bg, borderRadius: R, padding: "12px 16px", marginBottom: 8, borderLeft: "3px solid " + s.brd } },
                        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 } },
                          h("span", { style: { fontWeight: 600, color: TEXT } }, cat.icon + " " + cat.label),
                          h("span", { style: { fontSize: 13, color: "#666" } }, pct + "% (\u20AC " + getCategoryTotal(cat).toLocaleString("de-AT") + ") \u00b7 Optimal: " + cat.optimal + "%") ),
                        h("div", { style: { fontSize: 13, color: s.cl, marginTop: 4 } }, rec.text) );
                    }) ) ) );

        /* 13: Vollmacht + Absenden */
        case 13:
          var gesellschaften = getGesellschaften();
          return h("div", null,
            h("div", { style: { background: "#fafafa", borderRadius: R, padding: 18, marginBottom: 18, border: "1px solid #eee" } },
              h("h3", { style: assign({ fontSize: 16, fontWeight: 600, marginBottom: 8 }, hlStyle()) }, "Sammelvollmacht zur Vertragsabfrage"),
              h("p", { style: { fontSize: 14, color: "#666", lineHeight: 1.6, marginBottom: 12 } },
                "Mit deiner Zustimmung erm\u00e4chtigst du uns, bestehende Vertr\u00e4ge bei deinen aktuellen Anbietern abzufragen, um dir ein optimales Angebot erstellen zu k\u00f6nnen." ),
              gesellschaften.length > 0 && h("div", { style: { background: "#fdf8e8", borderRadius: R, padding: "12px 16px", marginBottom: 14, border: "1px solid " + GOLD } },
                h("div", { style: { fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 } }, "Folgende Gesellschaften werden abgefragt:"),
                h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                  gesellschaften.map(function (g) {
                    return h("span", { key: g, style: { display: "inline-block", background: BG, border: "1px solid " + GOLD, borderRadius: 20, padding: "3px 12px", fontSize: 13, color: TEXT, fontWeight: 500 } }, g);
                  }) ) ),
              gesellschaften.length === 0 && h("div", { style: { fontSize: 13, color: "#999", marginBottom: 12 } },
                "Keine Gesellschaften erfasst. Du kannst die Versicherungsdaten im vorherigen Schritt erg\u00e4nzen." ),
              h("div", { style: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 } },
                h("input", { type: "checkbox", id: "vollmacht", checked: vollmachtChecked, onChange: function (e) { setVollmachtChecked(e.target.checked); }, style: { width: 18, height: 18, marginTop: 2, accentColor: GOLD_DARK, cursor: "pointer" } }),
           h("label", { htmlFor: "vollmacht", style: { fontSize: 14, color: TEXT, lineHeight: 1.5, cursor: "pointer" } },
  "Ich erteile hiermit die Sammelvollmacht, meine bestehenden Vertr\u00e4ge" + (gesellschaften.length > 0 ? " bei den oben genannten Gesellschaften" : "") + " abzufragen. Ich habe die",
  h("a", { href: "https://pro-finanz.at/wp-content/uploads/2026/03/Vollmacht-ProFinanz.pdf", target: "_blank", rel: "noopener noreferrer", style: { color: GOLD_DARK } }, " Vollmachtsbedingungen"), " gelesen und akzeptiere diese." ) ),
              vollmachtChecked && h("div", null,
                h("div", { style: { fontSize: 14, fontWeight: 500, color: TEXT, marginBottom: 8 } }, "Unterschrift"),
                h(SignaturePad, { onSave: setSignature }) ) ),
            partner && h("div", { style: { background: "#fdf8e8", borderRadius: R, padding: 14, marginBottom: 18, border: "1px solid " + GOLD } },
              h("div", { style: { fontSize: 13, color: "#999", marginBottom: 2 } }, "Deine Daten werden gesendet an:"),
              h("div", { style: { fontWeight: 600, color: TEXT } }, partner.name + " \u2013 " + partner.role),
              h("div", { style: { fontSize: 13, color: "#666" } }, partner.email) ),
            !partner && h("div", { style: { background: "#fef8e8", borderRadius: R, padding: 14, marginBottom: 18, borderLeft: "3px solid " + GOLD_DARK } },
              h("div", { style: { fontSize: 14, color: "#666" } }, "\u26A0\uFE0F Kein Vertriebspartner zugewiesen. Bitte verwende den Link, den dir dein Berater geschickt hat.") ),
            submitError && h("div", { style: { background: "#fef0f0", borderRadius: R, padding: 12, marginBottom: 12, border: "1px solid #f5c6c6", color: "#c33", fontSize: 14 } }, "\u26A0\uFE0F " + submitError) );

        default: return null;
      }
    }

    /* Layout */
    return h("div", { style: { fontFamily: FONT, background: BG, color: TEXT } },
      h("div", { style: { maxWidth: 720, margin: "0 auto", padding: "24px 20px 80px" } },
        h(ProgressBar, { current: step, total: totalSteps }),
        h("div", { style: { background: BG, borderRadius: R, padding: "24px 20px", border: "1px solid #e5e5e5" } },
          h("h2", { style: assign({ fontSize: 20, fontWeight: 700, marginBottom: 2 }, hlStyle()) }, STEPS[step].title),
          h("p", { style: { fontSize: 14, color: "#999", marginBottom: 18 } }, STEPS[step].sub),
          renderStep() ),
        h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 16, gap: 12 } },
          h("button", { onClick: function () { setStep(function (s) { return Math.max(0, s - 1); }); }, disabled: step === 0,
            style: { padding: "10px 22px", borderRadius: R, fontSize: 15, fontWeight: 600, fontFamily: "inherit",
              border: "1px solid #ddd", background: BG, color: step === 0 ? "#ccc" : TEXT, opacity: step === 0 ? 0.5 : 1, cursor: step === 0 ? "default" : "pointer" } }, "\u2190 Zur\u00fcck"),
          step < totalSteps - 1
            ? h("button", { onClick: function () { setStep(function (s) { return s + 1; }); }, disabled: !canNext(),
                style: { padding: "10px 28px", borderRadius: R, fontSize: 15, fontWeight: 600, fontFamily: "inherit",
                  border: "none", background: canNext() ? GOLD : "#e5e5e5", color: canNext() ? TEXT : "#999", cursor: canNext() ? "pointer" : "default" } }, "Weiter \u2192")
            : h("button", { onClick: handleSubmit, disabled: submitting,
                style: { padding: "10px 28px", borderRadius: R, fontSize: 15, fontWeight: 600, fontFamily: "inherit",
                  border: "none", background: submitting ? "#e5e5e5" : GOLD, color: submitting ? "#999" : TEXT, cursor: submitting ? "wait" : "pointer" } },
              submitting ? "\u23F3 Wird gesendet\u2026" : "\u2709\uFE0F Absenden") ) ) );
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
      if (attempts > 0) setTimeout(function () { tryMount(attempts - 1); }, 200);
      else console.error("Quickcheck: Dependencies nicht geladen (React/ReactDOM/Recharts).");
      return;
    }
    RC = window.Recharts; mount();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { tryMount(30); });
  else tryMount(30);
})();
