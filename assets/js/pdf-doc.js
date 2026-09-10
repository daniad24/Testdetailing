/* ============================================================
   Sanitas CAR — generarea documentului oficial PDF
   „Cerere de Înscriere și Acordare Împrumut Fond Sanitas CAR”

   Documentul este construit cu jsPDF, în format A4, cu font
   propriu (subset Liberation Sans) pentru a reda corect
   diacriticele românești: ă â î ș ț.
   ============================================================ */
(function (global) {
  "use strict";

  var ORG = {
    name: "CASA DE AJUTOR RECIPROC SANITAS BUCUREȘTI",
    subtitle: "Fond de întrajutorare al membrilor din sistemul sanitar",
    contact: "sediu@sanitascar.ro · www.sanitascar.ro"
  };

  var PAGE = { w: 210, h: 297, margin: 18 };
  var RED = [234, 27, 35];
  var INK = [22, 24, 29];
  var MUTED = [107, 114, 128];
  var LINE = [214, 218, 224];
  var SOFT = [248, 249, 251];

  var FONT = "RomanianSans";
  var fontsRegistered = false;

  function registerFonts(doc) {
    var a = global.SANITAS_ASSETS;
    if (!a || !a.fontRegular) return false;
    doc.addFileToVFS("RomanianSans-Regular.ttf", a.fontRegular);
    doc.addFont("RomanianSans-Regular.ttf", FONT, "normal");
    doc.addFileToVFS("RomanianSans-Bold.ttf", a.fontBold);
    doc.addFont("RomanianSans-Bold.ttf", FONT, "bold");
    fontsRegistered = true;
    return true;
  }

  /* Fără fontul propriu, jsPDF ar înlocui diacriticele cu semne greșite. */
  function stripDiacritics(text) {
    var map = {
      "ă": "a", "â": "a", "î": "i", "ș": "s", "ț": "t", "ş": "s", "ţ": "t",
      "Ă": "A", "Â": "A", "Î": "I", "Ș": "S", "Ț": "T", "Ş": "S", "Ţ": "T"
    };
    return String(text).replace(/[ăâîșțşţĂÂÎȘȚŞŢ]/g, function (c) { return map[c]; });
  }

  /* ---------------- Număr de înregistrare ---------------- */
  function registrationNumber(date) {
    var d = date || new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var stamp = "" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    var seq = pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    return "CAR/" + stamp + "/" + seq;
  }

  function fileName(fullName) {
    var slug = stripDiacritics(String(fullName || "Solicitant"))
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return "Cerere_Sanitas_CAR_" + (slug || "Solicitant") + ".pdf";
  }

  /* ============================================================
     Construirea documentului
     data = {
       fullName, cnp, idSeries, idNumber, idExpiry,
       county, city, street, streetNo, iban, email, phone,
       loan: { principal, months, monthlyPayment, totalRepayment, annualRatePct }
     }
     ============================================================ */
  function build(data) {
    if (!global.jspdf || !global.jspdf.jsPDF) {
      throw new Error("Biblioteca jsPDF nu a putut fi încărcată. Verifică conexiunea la internet.");
    }
    var doc = new global.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });

    var hasFont = registerFonts(doc);
    var T = hasFont ? function (s) { return String(s); } : stripDiacritics;

    var issuedAt = new Date();
    var regNo = data.regNo || registrationNumber(issuedAt);
    var loan = data.loan;
    var M = PAGE.margin;
    var contentW = PAGE.w - M * 2;

    /* ---------- helpers ---------- */
    function setFont(style, size, color) {
      doc.setFont(hasFont ? FONT : "helvetica", style);
      doc.setFontSize(size);
      var c = color || INK;
      doc.setTextColor(c[0], c[1], c[2]);
    }

    /* ================= ANTET ================= */
    var y = M;

    var logo = global.SANITAS_ASSETS && global.SANITAS_ASSETS.logoPng;
    if (logo) {
      // Spațiu dedicat identității vizuale (logo Sanitas CAR)
      doc.addImage("data:image/png;base64," + logo, "PNG", M, y, 19, 20.8);
    }

    setFont("bold", 12);
    doc.text(T(ORG.name), M + 24, y + 5.6);
    setFont("normal", 8.6, MUTED);
    doc.text(T(ORG.subtitle), M + 24, y + 10.6);
    doc.text(T(ORG.contact), M + 24, y + 15);

    y += 23.5;
    doc.setDrawColor(RED[0], RED[1], RED[2]);
    doc.setLineWidth(0.9);
    doc.line(M, y, PAGE.w - M, y);
    doc.setLineWidth(0.25);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.line(M, y + 1.3, PAGE.w - M, y + 1.3);

    /* ---------- Nr. înregistrare / dată ---------- */
    y += 6.6;
    setFont("normal", 8.8, MUTED);
    doc.text(T("Nr. înregistrare: ") + regNo, M, y);
    doc.text(T("Data emiterii: ") + formatDate(issuedAt), PAGE.w - M, y, { align: "right" });

    /* ================= TITLU ================= */
    y += 9.5;
    setFont("bold", 13.5);
    var title = doc.splitTextToSize(
      T("CERERE DE ÎNSCRIERE ȘI ACORDARE ÎMPRUMUT"), contentW
    );
    doc.text(title, PAGE.w / 2, y, { align: "center" });
    y += title.length * 6;
    setFont("bold", 10.5, RED);
    doc.text(T("FOND SANITAS CAR"), PAGE.w / 2, y, { align: "center" });

    y += 6.8;
    setFont("normal", 8.6, MUTED);
    var intro = doc.splitTextToSize(T(
      "Subsemnatul/Subsemnata, identificat/ă cu datele de mai jos, solicit înscrierea în " +
      "Casa de Ajutor Reciproc Sanitas București și acordarea unui împrumut din fondul social, " +
      "în condițiile prevăzute în prezenta cerere și în statutul C.A.R."
    ), contentW);
    doc.text(intro, M, y);
    y += intro.length * 3.9 + 4.4;

    /* ================= SECȚIUNEA A ================= */
    y = sectionTitle(doc, T, setFont, "A. DATE DE IDENTIFICARE MEMBRU", M, y, contentW);
    y = dataTable(doc, T, setFont, M, y, contentW, [
      ["Nume și prenume", data.fullName],
      ["Cod Numeric Personal (CNP)", spaced(data.cnp)],
      ["Carte de identitate", "Seria " + data.idSeries + ", Nr. " + data.idNumber],
      ["Valabilitate act de identitate", formatDate(data.idExpiry)],
      ["Adresă de domiciliu", addressLine(data)],
      ["Telefon de contact", data.phone],
      ["Adresă de e-mail", data.email],
      ["Cont bancar (IBAN)", data.ibanFormatted || data.iban]
    ]);

    /* ================= SECȚIUNEA B ================= */
    y += 5.4;
    y = sectionTitle(doc, T, setFont, "B. TERMENII ÎMPRUMUTULUI SOLICITAT", M, y, contentW);
    var termRows = [
      ["Suma solicitată", money(loan.principal)],
      ["Perioada de rambursare", loan.months === 1 ? "1 lună" : loan.months + " luni"],
      ["Dobândă fixă aplicată", fmt(loan.annualRatePct, 0) + "% pe an"],
      ["Rata lunară estimată", money(loan.monthlyPayment)],
      ["Total de rambursat", money(loan.totalRepayment)]
    ];
    if (loan.netSalary) {
      termRows.push(["Venit net lunar declarat", money(loan.netSalary)]);
      if (loan.debtRatio != null) {
        termRows.push(["Rata în venitul net", fmt(loan.debtRatio, 1) + "%"]);
      }
    }
    y = dataTable(doc, T, setFont, M, y, contentW, termRows, { highlightRows: [3] });

    /* ================= DECLARAȚII ================= */
    y += 5.4;
    setFont("bold", 9.4);
    doc.text(T("C. DECLARAȚII ȘI CONSIMȚĂMÂNT"), M, y);
    y += 4.4;
    setFont("normal", 7.9, [60, 66, 78]);
    var decl = [
      "Declar pe propria răspundere că datele înscrise în prezenta cerere, inclusiv venitul " +
        "net declarat, sunt complete și conforme cu realitatea și cu actul de identitate prezentat.",
      "Mă oblig să restitui împrumutul acordat în ratele lunare stabilite, împreună cu dobânda " +
        "fixă de " + fmt(loan.annualRatePct, 0) + "% pe an, conform statutului C.A.R. Sanitas București.",
      "Îmi exprim consimțământul pentru prelucrarea datelor cu caracter personal cuprinse în " +
        "prezenta cerere, în scopul analizării și administrării împrumutului, în conformitate cu " +
        "Regulamentul (UE) 2016/679 (GDPR)."
    ];
    decl.forEach(function (paragraph) {
      var lines = doc.splitTextToSize(T("• " + paragraph), contentW - 2);
      doc.text(lines, M + 1, y);
      y += lines.length * 3.5 + 1.4;
    });

    /* ================= SEMNĂTURĂ ================= */
    y += 4.6;
    var boxH = 19;
    var half = (contentW - 6) / 2;

    signatureBox(doc, T, setFont, M, y, half, boxH, "Data completării", formatDate(issuedAt));
    signatureBox(doc, T, setFont, M + half + 6, y, half, boxH, "Semnătura solicitantului", "");
    y += boxH + 5;

    /* ---------- Zonă rezervată CAR ---------- */
    doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.roundedRect(M, y, contentW, 14, 2, 2, "FD");
    setFont("bold", 7.8, MUTED);
    doc.text(T("SPAȚIU REZERVAT SANITAS CAR"), M + 4, y + 5.2);
    setFont("normal", 7.8, MUTED);
    doc.text(T("Aprobat / Respins:  ...........................        Nr. hotărâre:  ...........................        " +
      "Semnătura și ștampila:  ..........................."), M + 4, y + 10.6);

    var contentBottom = y + 14;

    /* ================= FOOTER ================= */
    var fy = PAGE.h - 14;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.25);
    doc.line(M, fy, PAGE.w - M, fy);
    setFont("normal", 7.4, MUTED);
    doc.text(T("Document generat automat de platforma Sanitas CAR · " + regNo), M, fy + 5);
    doc.text(T("Pagina 1 din 1"), PAGE.w - M, fy + 5, { align: "right" });

    return {
      doc: doc, regNo: regNo, issuedAt: issuedAt,
      fileName: fileName(data.fullName),
      contentBottom: contentBottom, footerTop: fy
    };
  }

  /* ---------------- componente de desen ---------------- */

  function sectionTitle(doc, T, setFont, label, x, y, w) {
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(x, y - 3.6, 2.4, 5.4, "F");
    setFont("bold", 9.8, INK);
    doc.text(T(label), x + 5, y);
    return y + 4;
  }

  function dataTable(doc, T, setFont, x, y, w, rows, opts) {
    var options = opts || {};
    var labelW = w * 0.42;
    var padX = 3.4;
    var lineH = 3.6;

    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.2);

    rows.forEach(function (row, index) {
      var label = T(String(row[0]));
      var value = T(String(row[1] == null || row[1] === "" ? "—" : row[1]));

      setFont("normal", 8.4, MUTED);
      var labelLines = doc.splitTextToSize(label, labelW - padX * 2);
      var isKey = (options.highlightRows || []).indexOf(index) !== -1;
      setFont(isKey ? "bold" : "normal", isKey ? 9.2 : 8.7, INK);
      var valueLines = doc.splitTextToSize(value, w - labelW - padX * 2);

      var rowH = Math.max(labelLines.length, valueLines.length) * lineH + 2.7;

      if (index % 2 === 0) {
        doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]);
        doc.rect(x, y, w, rowH, "F");
      }
      if (isKey) {
        doc.setFillColor(253, 236, 236);
        doc.rect(x, y, w, rowH, "F");
      }
      doc.rect(x, y, w, rowH); // contur
      doc.line(x + labelW, y, x + labelW, y + rowH);

      setFont("normal", 8.4, MUTED);
      doc.text(labelLines, x + padX, y + 3.55);
      setFont(isKey ? "bold" : "normal", isKey ? 9.2 : 8.7, isKey ? RED : INK);
      doc.text(valueLines, x + labelW + padX, y + 3.55);

      y += rowH;
    });

    return y;
  }

  function signatureBox(doc, T, setFont, x, y, w, h, label, value) {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, 2, 2, "S");
    setFont("bold", 7.8, MUTED);
    doc.text(T(label), x + 4, y + 5.2);
    if (value) {
      setFont("bold", 10, INK);
      doc.text(T(value), x + 4, y + 11.8);
    }
    doc.setDrawColor(180, 186, 196);
    doc.line(x + 4, y + h - 6, x + w - 4, y + h - 6);
  }

  /* ---------------- formatare ---------------- */

  function fmt(value, decimals) {
    return new Intl.NumberFormat("ro-RO", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  }

  function money(value) { return fmt(value, 2) + " lei"; }

  function spaced(cnp) {
    var v = String(cnp || "");
    return v.length === 13 ? v.slice(0, 1) + " " + v.slice(1, 7) + " " + v.slice(7) : v;
  }

  function addressLine(d) {
    var no = String(d.streetNo || "").trim();
    // Nu dublăm „nr.” dacă solicitantul l-a scris deja în câmp.
    var noPart = no ? (/^nr\b\.?/i.test(no) ? no : "nr. " + no) : "";
    return [
      d.street && noPart ? d.street + " " + noPart : d.street || noPart,
      d.city,
      d.county ? "jud./mun. " + d.county : ""
    ].filter(Boolean).join(", ");
  }

  function formatDate(value) {
    if (!value) return "";
    var d = value instanceof Date ? value : new Date(String(value) + "T00:00:00");
    if (isNaN(d.getTime())) return String(value);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear();
  }

  global.SanitasPdf = {
    build: build,
    fileName: fileName,
    registrationNumber: registrationNumber,
    stripDiacritics: stripDiacritics
  };
})(window);
