/* ============================================================
   Sanitas CAR — logica paginii
   - simulator (sume + glisor perioadă + calcul live)
   - tabel de referință
   - validare la tastare
   - generare PDF + trimitere pe e-mail
   ============================================================ */
(function () {
  "use strict";

  var LM = window.LoanMath;
  var V = window.Validators;

  /* Endpoint-ul care trimite e-mailurile (vezi folderul server/).
     Poate fi suprascris cu <meta name="sanitas-api" content="https://..."> */
  var apiMeta = document.querySelector('meta[name="sanitas-api"]');
  var API_URL = (apiMeta && apiMeta.content) || "/api/cerere";

  var state = { principal: 3000, months: 12 };

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  /* ============================================================
     1. SIMULATOR
     ============================================================ */
  var amountButtons = $$(".amount-btn");
  var monthsInput = $("#months");
  var monthsOut = $("#monthsOut");

  function renderSimulation() {
    var sim = LM.simulate(state.principal, state.months);

    $("#rateValue").textContent = new Intl.NumberFormat("ro-RO", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(sim.monthlyPayment);

    $("#resAmount").textContent = LM.whole(sim.principal);
    $("#resMonths").textContent = LM.monthsLabel(sim.months);
    $("#resTotal").textContent = LM.money(sim.totalRepayment);
    $("#resInterest").textContent = LM.money(sim.totalInterest);

    $("#sumAmount").textContent = LM.whole(sim.principal);
    $("#sumMonths").textContent = LM.monthsLabel(sim.months);
    $("#sumRate").textContent = LM.money(sim.monthlyPayment);
    $("#sumTotal").textContent = LM.money(sim.totalRepayment);

    monthsOut.textContent = LM.monthsLabel(sim.months);
    highlightTable();
  }

  function setAmount(value) {
    state.principal = value;
    amountButtons.forEach(function (btn) {
      var active = Number(btn.dataset.amount) === value;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderSimulation();
  }

  function setMonths(value) {
    var n = Math.min(LM.MAX_MONTHS, Math.max(LM.MIN_MONTHS, Math.round(Number(value) || 1)));
    state.months = n;
    if (Number(monthsInput.value) !== n) monthsInput.value = n;
    updateSliderFill();
    $$(".tick").forEach(function (tick) {
      tick.classList.toggle("is-active", Number(tick.dataset.months) === n);
    });
    renderSimulation();
  }

  /* Umple bara glisorului pe partea deja parcursă (Chrome/Safari). */
  function updateSliderFill() {
    var pct = (state.months - LM.MIN_MONTHS) / (LM.MAX_MONTHS - LM.MIN_MONTHS) * 100;
    monthsInput.style.setProperty("--fill", pct.toFixed(2) + "%");
  }

  amountButtons.forEach(function (btn) {
    btn.addEventListener("click", function () { setAmount(Number(btn.dataset.amount)); });
  });
  monthsInput.addEventListener("input", function () { setMonths(monthsInput.value); });
  $$(".tick").forEach(function (tick) {
    tick.addEventListener("click", function () { setMonths(Number(tick.dataset.months)); });
  });

  /* ============================================================
     2. TABEL DE REFERINȚĂ
     ============================================================ */
  function buildTable() {
    var body = $("#refTableBody");
    body.innerHTML = "";
    LM.AMOUNTS.forEach(function (amount) {
      var tr = document.createElement("tr");
      tr.dataset.amount = amount;

      var th = document.createElement("td");
      th.textContent = LM.whole(amount);
      tr.appendChild(th);

      LM.TABLE_TERMS.forEach(function (months) {
        var td = document.createElement("td");
        td.dataset.months = months;
        td.textContent = LM.money(LM.monthlyPayment(amount, months));
        tr.appendChild(td);
      });

      var last = document.createElement("td");
      last.textContent = "Fixă 12%";
      tr.appendChild(last);

      body.appendChild(tr);
    });
  }

  function highlightTable() {
    $$("#refTableBody tr").forEach(function (tr) {
      var isRow = Number(tr.dataset.amount) === state.principal;
      tr.classList.toggle("is-current", isRow);
      $$("td", tr).forEach(function (td) { td.classList.remove("is-current-cell"); });
      if (isRow) {
        var cell = tr.querySelector('td[data-months="' + state.months + '"]');
        if (cell) cell.classList.add("is-current-cell");
      }
    });
  }

  /* ============================================================
     3. VALIDARE FORMULAR
     ============================================================ */
  var FIELDS = {
    fullName: function (v) { return V.fullName(v); },
    idSeries: function (v) { return V.idSeries(v); },
    idNumber: function (v) { return V.idNumber(v); },
    idExpiry: function (v) { return V.idExpiry(v); },
    cnp: function (v) { return V.cnp(v); },
    county: function (v) { return V.required(v, "județul"); },
    city: function (v) { return V.required(v, "localitatea"); },
    street: function (v) { return V.required(v, "strada"); },
    streetNo: function (v) { return V.required(v, "numărul", 1); },
    iban: function (v) { return V.iban(v); },
    email: function (v) { return V.email(v); },
    phone: function (v) { return V.phone(v); }
  };

  var DEFAULT_HINTS = {};
  Object.keys(FIELDS).forEach(function (name) {
    var msg = document.querySelector('[data-msg-for="' + name + '"]');
    DEFAULT_HINTS[name] = msg ? msg.textContent : "";
  });

  function fieldWrapper(input) { return input.closest(".form-field"); }

  function showResult(name, result, touched) {
    var input = document.getElementById(name);
    if (!input) return;
    var wrapper = fieldWrapper(input);
    var msg = document.querySelector('[data-msg-for="' + name + '"]');
    var empty = !String(input.value).trim();

    wrapper.classList.remove("is-valid", "is-invalid");
    if (empty && !touched) {
      if (msg) msg.textContent = DEFAULT_HINTS[name] || "";
      return;
    }
    if (result.ok) {
      wrapper.classList.add("is-valid");
      if (msg) msg.textContent = result.msg || "Corect.";
    } else if (touched || !empty) {
      wrapper.classList.add("is-invalid");
      if (msg) msg.textContent = result.msg;
    }
  }

  function validateField(name, touched) {
    var input = document.getElementById(name);
    var result = FIELDS[name](input.value);
    showResult(name, result, touched);
    return result;
  }

  /* Filtre de tastare: doar ce are sens pentru fiecare câmp. */
  function digitsOnly(input, maxLen) {
    input.addEventListener("input", function () {
      var v = input.value.replace(/\D/g, "");
      if (maxLen) v = v.slice(0, maxLen);
      if (v !== input.value) input.value = v;
    });
  }

  digitsOnly($("#idNumber"), 6);
  digitsOnly($("#cnp"), 13);
  digitsOnly($("#phone"), 10);

  $("#idSeries").addEventListener("input", function () {
    var v = this.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
    if (v !== this.value) this.value = v;
  });

  $("#iban").addEventListener("input", function () {
    var raw = this.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 24);
    var caretAtEnd = this.selectionStart === this.value.length;
    this.value = V.groupIban(raw);
    if (caretAtEnd) this.setSelectionRange(this.value.length, this.value.length);
  });

  Object.keys(FIELDS).forEach(function (name) {
    var input = document.getElementById(name);
    if (!input) return;
    input.addEventListener("input", function () { validateField(name, false); });
    input.addEventListener("blur", function () { validateField(name, true); });
  });

  var gdpr = $("#gdpr");
  gdpr.addEventListener("change", function () {
    var wrapper = gdpr.closest(".consent");
    wrapper.classList.toggle("is-invalid", !gdpr.checked);
    document.querySelector('[data-msg-for="gdpr"]').textContent =
      gdpr.checked ? "" : "Acordul este obligatoriu pentru depunerea cererii.";
  });

  /** Validează tot formularul; întoarce datele curate sau null. */
  function collectData() {
    var values = {};
    var firstInvalid = null;

    Object.keys(FIELDS).forEach(function (name) {
      var result = validateField(name, true);
      if (!result.ok) {
        if (!firstInvalid) firstInvalid = document.getElementById(name);
      } else {
        values[name] = result.value;
        if (name === "iban") values.ibanFormatted = result.formatted;
      }
    });

    if (!gdpr.checked) {
      gdpr.closest(".consent").classList.add("is-invalid");
      document.querySelector('[data-msg-for="gdpr"]').textContent =
        "Acordul este obligatoriu pentru depunerea cererii.";
      if (!firstInvalid) firstInvalid = gdpr;
    }

    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      try { firstInvalid.focus({ preventScroll: true }); } catch (e) { firstInvalid.focus(); }
      return null;
    }

    values.loan = LM.simulate(state.principal, state.months);
    values.gdpr = true;
    return values;
  }

  /* ============================================================
     4. GENERARE PDF + TRIMITERE
     ============================================================ */
  var statusEl = $("#formStatus");
  var submitBtn = $("#submitBtn");
  var previewBtn = $("#previewBtn");
  var modal = $("#pdfModal");
  var lastBlobUrl = null;

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "form-status" + (kind ? " is-" + kind : "");
  }

  function generatePdf(data) {
    var built = window.SanitasPdf.build(data);
    var blob = built.doc.output("blob");
    return {
      blob: blob,
      fileName: built.fileName,
      regNo: built.regNo,
      base64: built.doc.output("datauristring").split(",")[1]
    };
  }

  /* Nu toate browserele afișează PDF-uri într-un iframe (iOS Safari, de exemplu),
     iar pe ecrane mici previzualizarea inline oricum nu ajută. În acele cazuri
     arătăm o casetă cu numele documentului și butoanele de descărcare. */
  function supportsInlinePdf() {
    var ua = navigator.userAgent || "";
    var isIos = /iPad|iPhone|iPod/.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    return !isIos && window.innerWidth >= 700;
  }

  function openModal(pdf, message) {
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = URL.createObjectURL(pdf.blob);

    $("#modalMsg").textContent = message;

    var frame = $("#pdfFrame");
    var fallback = $("#pdfFallback");
    if (supportsInlinePdf()) {
      frame.src = lastBlobUrl;
      frame.hidden = false;
      fallback.hidden = true;
    } else {
      frame.removeAttribute("src");
      frame.hidden = true;
      fallback.hidden = false;
      $("#fallbackName").textContent = pdf.fileName;
    }

    var dl = $("#downloadPdf");
    dl.href = lastBlobUrl;
    dl.setAttribute("download", pdf.fileName);
    $("#openPdf").href = lastBlobUrl;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  $$("[data-close-modal]").forEach(function (el) {
    el.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  /* --- doar previzualizare, fără trimitere --- */
  previewBtn.addEventListener("click", function () {
    var data = collectData();
    if (!data) { setStatus("Verifică câmpurile marcate în roșu.", "err"); return; }
    try {
      var pdf = generatePdf(data);
      openModal(pdf, "Previzualizare. Cererea NU a fost încă trimisă — folosește butonul de trimitere când ești gata.");
      setStatus("PDF generat pentru verificare. Cererea nu a fost trimisă.", "ok");
    } catch (err) {
      setStatus(err.message, "err");
    }
  });

  /* --- trimitere completă --- */
  $("#loanForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var data = collectData();
    if (!data) { setStatus("Verifică câmpurile marcate în roșu.", "err"); return; }

    var pdf;
    try {
      pdf = generatePdf(data);
    } catch (err) {
      setStatus(err.message, "err");
      return;
    }

    submitBtn.disabled = true;
    setStatus("Se generează și se trimite cererea…", "busy");

    sendToServer(data, pdf)
      .then(function () {
        openModal(pdf, "Cererea a fost înregistrată cu numărul " + pdf.regNo +
          " și trimisă pe " + data.email + ", precum și la sediul Sanitas CAR.");
        setStatus("Cerere trimisă. Verifică e-mailul " + data.email + ".", "ok");
        $("#loanForm").reset();
        resetFieldStates();
      })
      .catch(function (err) {
        // Fără server (pagină deschisă local) documentul rămâne oricum disponibil.
        openModal(pdf, "Documentul a fost generat (nr. " + pdf.regNo + "), dar trimiterea automată " +
          "pe e-mail nu a funcționat: " + err.message + " Descarcă PDF-ul și trimite-l manual.");
        setStatus("PDF generat, dar trimiterea pe e-mail a eșuat: " + err.message, "err");
      })
      .then(function () { submitBtn.disabled = false; });
  });

  function resetFieldStates() {
    Object.keys(FIELDS).forEach(function (name) {
      var input = document.getElementById(name);
      if (!input) return;
      fieldWrapper(input).classList.remove("is-valid", "is-invalid");
      var msg = document.querySelector('[data-msg-for="' + name + '"]');
      if (msg) msg.textContent = DEFAULT_HINTS[name] || "";
    });
    gdpr.closest(".consent").classList.remove("is-invalid");
    setAmount(state.principal);
  }

  function sendToServer(data, pdf) {
    if (location.protocol === "file:") {
      return Promise.reject(new Error("pagina este deschisă local, fără server."));
    }
    var payload = {
      applicant: {
        fullName: data.fullName, cnp: data.cnp,
        idSeries: data.idSeries, idNumber: data.idNumber, idExpiry: data.idExpiry,
        county: data.county, city: data.city, street: data.street, streetNo: data.streetNo,
        iban: data.iban, email: data.email, phone: data.phone, gdpr: true
      },
      loan: data.loan,
      regNo: pdf.regNo,
      fileName: pdf.fileName,
      pdfBase64: pdf.base64
    };

    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          throw new Error(body.error || ("serverul a răspuns cu " + res.status));
        });
      }
      return res.json().catch(function () { return {}; });
    });
  }

  /* ============================================================
     5. INIȚIALIZARE
     ============================================================ */
  buildTable();
  setAmount(state.principal);
  setMonths(state.months);

  // Data minimă pentru expirarea buletinului: mâine
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  $("#idExpiry").min = tomorrow.toISOString().slice(0, 10);
})();
