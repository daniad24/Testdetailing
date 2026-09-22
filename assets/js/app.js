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
  var API_URL = (apiMeta && apiMeta.content) || "api/cerere";

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
    renderDebtRatio();
    updateGuarantorState();
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

  /**
   * Poziția orizontală a unei valori pe cursa glisorului.
   * Centrul butonului nu ajunge niciodată la marginile barei: pleacă de la
   * jumătate de buton și se oprește cu jumătate de buton înainte de capăt.
   * Aceeași formulă e folosită și pentru umplerea barei, și pentru etichete,
   * ca eticheta „6” să stea fix sub poziția în care glisorul arată 6 luni.
   */
  function positionFor(months) {
    var fraction = (months - LM.MIN_MONTHS) / (LM.MAX_MONTHS - LM.MIN_MONTHS);
    return "calc(var(--thumb) / 2 + " + fraction.toFixed(5) + " * (100% - var(--thumb)))";
  }

  /* Umple bara pe partea deja parcursă (Chrome/Safari). */
  function updateSliderFill() {
    monthsInput.style.setProperty("--fill", positionFor(state.months));
  }

  /* Așază etichetele de sub glisor la poziția reală a lunii pe care o marchează. */
  function placeTicks() {
    $$(".tick").forEach(function (tick) {
      tick.style.setProperty("--pos", positionFor(Number(tick.dataset.months)));
    });
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
    phone: function (v) { return V.phone(v); },
    netSalary: function (v) { return V.netSalary(v); }
  };

  /* Câmpurile girantului. Se validează doar când secțiunea e deschisă —
     altfel cererea se depune fără girant, iar ce e scris aici se ignoră. */
  var GUARANTOR_FIELDS = {
    gFullName: function (v) { return V.fullName(v); },
    gIdSeries: function (v) { return V.idSeries(v); },
    gIdNumber: function (v) { return V.idNumber(v); },
    gCnp: function (v) { return V.cnp(v); },
    gPhone: function (v) { return V.phone(v); },
    gAddress: function (v) { return V.required(v, "adresa girantului", 8); },
    gRelation: function (v) { return V.required(v, "calitatea față de solicitant", 3); },
    gNetSalary: function (v) { return V.netSalary(v); }
  };

  var ALL_FIELDS = {};
  Object.keys(FIELDS).forEach(function (k) { ALL_FIELDS[k] = FIELDS[k]; });
  Object.keys(GUARANTOR_FIELDS).forEach(function (k) { ALL_FIELDS[k] = GUARANTOR_FIELDS[k]; });

  var DEFAULT_HINTS = {};
  Object.keys(ALL_FIELDS).forEach(function (name) {
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
    var result = ALL_FIELDS[name](input.value);
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
  digitsOnly($("#netSalary"), 6);
  digitsOnly($("#cnp"), 13);
  digitsOnly($("#phone"), 10);
  digitsOnly($("#gIdNumber"), 6);
  digitsOnly($("#gNetSalary"), 6);
  digitsOnly($("#gCnp"), 13);
  digitsOnly($("#gPhone"), 10);

  [$("#idSeries"), $("#gIdSeries")].forEach(function (input) {
    input.addEventListener("input", function () {
      var v = this.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
      if (v !== this.value) this.value = v;
    });
  });

  $("#iban").addEventListener("input", function () {
    var raw = this.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 24);
    var caretAtEnd = this.selectionStart === this.value.length;
    this.value = V.groupIban(raw);
    if (caretAtEnd) this.setSelectionRange(this.value.length, this.value.length);
  });

  Object.keys(ALL_FIELDS).forEach(function (name) {
    var input = document.getElementById(name);
    if (!input) return;
    var event = input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(event, function () { validateField(name, false); });
    input.addEventListener("blur", function () { validateField(name, true); });
  });

  $("#netSalary").addEventListener("input", function () {
    renderDebtRatio();
    updateGuarantorState();
  });

  /**
   * Arată ce parte din venitul net ia rata lunară.
   * Este o informație orientativă: nu blochează depunerea cererii, pentru că
   * decizia de acordare aparține comisiei C.A.R.
   */
  function renderDebtRatio() {
    var tile = $("#ratioTile");
    var note = $("#ratioNote");
    var salary = V.netSalary($("#netSalary").value);
    var payment = LM.simulate(state.principal, state.months).monthlyPayment;

    if (!salary.ok) {
      $("#sumRatio").textContent = "—";
      $("#ratioFill").style.width = "0";
      tile.classList.remove("is-over");
      note.hidden = true;
      return;
    }

    var ratio = LM.debtRatio(payment, salary.value);
    var over = ratio > LM.COMFORT_RATIO * 100;

    $("#sumRatio").textContent = ratio.toFixed(1).replace(".", ",") + "%";
    $("#ratioFill").style.width = Math.min(ratio, 100) + "%";
    tile.classList.toggle("is-over", over);

    note.hidden = false;
    note.classList.toggle("is-over", over);
    note.textContent = over
      ? "Rata depășește o treime din venitul tău net. Poți depune cererea, dar ia în calcul " +
        "o sumă mai mică sau o perioadă mai lungă — comisia C.A.R. analizează și acest raport."
      : "Rata se încadrează confortabil în venitul tău net, sub o treime din el.";
  }

  var gdpr = $("#gdpr");
  gdpr.addEventListener("change", function () {
    var wrapper = gdpr.closest(".consent");
    wrapper.classList.toggle("is-invalid", !gdpr.checked);
    document.querySelector('[data-msg-for="gdpr"]').textContent =
      gdpr.checked ? "" : "Acordul este obligatoriu pentru depunerea cererii.";
  });

  /* ============================================================
     4. GIRANT
     ============================================================ */
  var gDetails = $("#guarantorDetails");
  var autoOpened = false;

  function guarantorActive() { return gDetails.open; }

  /**
   * Girantul e recomandat când rata depășește pragul de confort din venitul
   * solicitantului — același prag care colorează avertismentul de mai sus.
   * Recomandarea deschide secțiunea o singură dată; dacă utilizatorul o
   * închide la loc, nu i-o mai redeschidem.
   */
  function updateGuarantorState() {
    var salary = V.netSalary($("#netSalary").value);
    var payment = LM.simulate(state.principal, state.months).monthlyPayment;
    var recommended = salary.ok && !LM.isComfortable(payment, salary.value);

    gDetails.classList.toggle("is-recommended", recommended);
    $("#guarantorState").textContent = recommended
      ? "Sistemul recomandă un girant pentru această cerere"
      : salary.ok
        ? "Opțional — rata ta se încadrează în venit"
        : "Opțional — îl poți adăuga dacă vrei";

    if (recommended && !autoOpened && !gDetails.open) {
      gDetails.open = true;
      autoOpened = true;
    }
    renderGuarantorRatio();
  }

  /* Ce parte din venitul girantului ar lua rata, dacă ar trebui să o acopere. */
  function renderGuarantorRatio() {
    var note = $("#gRatioNote");
    var salary = V.netSalary($("#gNetSalary").value);
    if (!guarantorActive() || !salary.ok) { note.hidden = true; return; }

    var payment = LM.simulate(state.principal, state.months).monthlyPayment;
    var ratio = LM.debtRatio(payment, salary.value);
    var over = ratio > LM.COMFORT_RATIO * 100;

    note.hidden = false;
    note.classList.toggle("is-over", over);
    note.textContent = over
      ? "Rata ar lua " + ratio.toFixed(1).replace(".", ",") + "% din venitul girantului. " +
        "Garanția rămâne valabilă, dar comisia C.A.R. va cântări și acest raport."
      : "Rata ar lua " + ratio.toFixed(1).replace(".", ",") + "% din venitul girantului — " +
        "o garanție solidă.";
  }

  $("#gNetSalary").addEventListener("input", renderGuarantorRatio);

  gDetails.addEventListener("toggle", function () {
    if (!gDetails.open) {
      // Secțiunea închisă = cerere fără girant: curățăm stările, ca formularul
      // să nu rămână cu erori dintr-o completare abandonată.
      Object.keys(GUARANTOR_FIELDS).forEach(function (name) { clearFieldState(name); });
      $("#gRatioNote").hidden = true;
    } else {
      autoOpened = true;
      renderGuarantorRatio();
    }
  });

  function clearFieldState(name) {
    var input = document.getElementById(name);
    if (!input) return;
    fieldWrapper(input).classList.remove("is-valid", "is-invalid");
    var msg = document.querySelector('[data-msg-for="' + name + '"]');
    if (msg) msg.textContent = DEFAULT_HINTS[name] || "";
  }

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

    if (guarantorActive()) {
      var g = {};
      Object.keys(GUARANTOR_FIELDS).forEach(function (name) {
        var result = validateField(name, true);
        if (!result.ok) {
          if (!firstInvalid) firstInvalid = document.getElementById(name);
        } else {
          g[name.charAt(1).toLowerCase() + name.slice(2)] = result.value;
        }
      });

      // Nimeni nu poate gira pentru sine.
      if (g.cnp && g.cnp === values.cnp) {
        var cnpInput = $("#gCnp");
        fieldWrapper(cnpInput).classList.remove("is-valid");
        fieldWrapper(cnpInput).classList.add("is-invalid");
        $('[data-msg-for="gCnp"]').textContent =
          "Girantul nu poate fi aceeași persoană cu solicitantul.";
        if (!firstInvalid) firstInvalid = cnpInput;
      } else {
        values.guarantor = g;
      }
    }

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
    values.loan.netSalary = values.netSalary;
    values.loan.debtRatio = LM.debtRatio(values.loan.monthlyPayment, values.netSalary);
    if (values.guarantor) {
      values.guarantor.debtRatio =
        LM.debtRatio(values.loan.monthlyPayment, values.guarantor.netSalary);
    }
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
        if (err.noBackend) {
          // Pagină statică: documentul e corect, doar expedierea automată lipsește.
          openModal(pdf, "Cererea a fost generată cu numărul " + pdf.regNo + ". Pe această " +
            "găzduire trimiterea automată pe e-mail nu este activă — descarcă documentul și " +
            "trimite-l la sediul Sanitas CAR.");
          setStatus("Cerere generată. Descarcă documentul: trimiterea automată nu este activă aici.", "ok");
          return;
        }
        openModal(pdf, "Documentul a fost generat (nr. " + pdf.regNo + "), dar trimiterea automată " +
          "pe e-mail nu a funcționat: " + err.message + ". Descarcă PDF-ul și trimite-l manual.");
        setStatus("PDF generat, dar trimiterea pe e-mail a eșuat: " + err.message, "err");
      })
      .then(function () { submitBtn.disabled = false; });
  });

  function resetFieldStates() {
    Object.keys(FIELDS).forEach(clearFieldState);
    gdpr.closest(".consent").classList.remove("is-invalid");
    Object.keys(GUARANTOR_FIELDS).forEach(clearFieldState);
    gDetails.open = false;
    autoOpened = false;
    $("#gRatioNote").hidden = true;
    setAmount(state.principal);
    renderDebtRatio();
  }

  function noBackendError() {
    var err = new Error("trimiterea automată pe e-mail nu este activă pe această găzduire");
    err.noBackend = true;
    return err;
  }

  function sendToServer(data, pdf) {
    if (location.protocol === "file:") {
      return Promise.reject(noBackendError());
    }
    var payload = {
      applicant: {
        fullName: data.fullName, cnp: data.cnp,
        idSeries: data.idSeries, idNumber: data.idNumber, idExpiry: data.idExpiry,
        county: data.county, city: data.city, street: data.street, streetNo: data.streetNo,
        iban: data.iban, email: data.email, phone: data.phone,
        netSalary: data.netSalary, gdpr: true
      },
      loan: data.loan,
      guarantor: data.guarantor || null,
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
        // 404/405 = pagina e servită static, fără endpoint-ul de trimitere.
        if (res.status === 404 || res.status === 405) throw noBackendError();
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
  placeTicks();
  setAmount(state.principal);
  setMonths(state.months);
  renderDebtRatio();
  updateGuarantorState();

  // Data minimă pentru expirarea buletinului: mâine
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  $("#idExpiry").min = tomorrow.toISOString().slice(0, 10);
})();
