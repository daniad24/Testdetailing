/* ============================================================
   Sanitas CAR — generarea documentului oficial PDF
   „Cerere de Înscriere și Acordare Împrumut Fond Sanitas CAR”

   Documentul este construit cu jsPDF, în format A4, cu font
   propriu (subset Liberation Sans) pentru a reda corect
   diacriticele românești: ă â î ș ț.

   Layoutul curge pe câte pagini are nevoie: fiecare bloc verifică
   întâi dacă mai încape, iar când nu, deschide o pagină nouă cu
   antet redus. Numerotarea se aplică la final, când se știe totalul.
   ============================================================ */
(function (global) {
  "use strict";

  var ORG = {
    name: "CASA DE AJUTOR RECIPROC SANITAS BUCUREȘTI",
    subtitle: "Fond de întrajutorare al membrilor din sistemul sanitar",
    contact: "sediu@sanitascar.ro · www.sanitascar.ro"
  };

  var PAGE = { w: 210, h: 297, margin: 18 };
  var FOOTER_Y = PAGE.h - 14;        // linia de deasupra footerului
  var CONTENT_BOTTOM = FOOTER_Y - 6; // conținutul nu coboară sub ea

  var RED = [234, 27, 35];
  var INK = [22, 24, 29];
  var MUTED = [107, 114, 128];
  var LINE = [214, 218, 224];
  var SOFT = [248, 249, 251];

  var FONT = "RomanianSans";

  function registerFonts(doc) {
    var a = global.SANITAS_ASSETS;
    if (!a || !a.fontRegular) return false;
    doc.addFileToVFS("RomanianSans-Regular.ttf", a.fontRegular);
    doc.addFont("RomanianSans-Regular.ttf", FONT, "normal");
    doc.addFileToVFS("RomanianSans-Bold.ttf", a.fontBold);
    doc.addFont("RomanianSans-Bold.ttf", FONT, "bold");
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
       loan: { principal, months, monthlyPayment, totalRepayment,
               annualRatePct, netSalary, debtRatio },
       guarantor: { fullName, cnp, idSeries, idNumber, phone,
                    address, netSalary, relation } | null
     }
     ============================================================ */
  function build(data) {
    if (!global.jspdf || !global.jspdf.jsPDF) {
      throw new Error(
        "Generatorul de documente nu s-a încărcat. Reîncarcă pagina și încearcă din nou " +
        "— datele completate se păstrează dacă nu închizi fila."
      );
    }
    var doc = new global.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });

    var hasFont = registerFonts(doc);
    var T = hasFont ? function (s) { return String(s); } : stripDiacritics;

    var issuedAt = new Date();
    var regNo = data.regNo || registrationNumber(issuedAt);
    var loan = data.loan;
    var guarantor = data.guarantor || null;

    var M = PAGE.margin;
    var contentW = PAGE.w - M * 2;
    var y = M;

    /* ---------- litere de secțiune, atribuite în ordinea apariției ---------- */
    var letterIndex = 0;
    function nextLetter() {
      return "ABCDEFGH".charAt(letterIndex++);
    }

    /* ---------- primitive ---------- */
    function setFont(style, size, color) {
      doc.setFont(hasFont ? FONT : "helvetica", style);
      doc.setFontSize(size);
      var c = color || INK;
      doc.setTextColor(c[0], c[1], c[2]);
    }

    /* Antet redus, pentru paginile 2 și următoarele. */
    /* Antet redus, pentru paginile 2 și următoarele.
       Logo-ul are raportul 478x522, deci înălțimea e lățimea x 1.092.
       Linia trebuie să treacă sub el, nu prin el: la 9.5mm lățime, logo-ul
       se termină la M + 8.4, iar linia stă la M + 11. */
    var SLIM_LOGO_W = 9.5;
    var SLIM_LOGO_H = SLIM_LOGO_W * 1.092;
    var SLIM_RULE_Y = M + 11;

    function slimHeader() {
      var logo = global.SANITAS_ASSETS && global.SANITAS_ASSETS.logoPng;
      if (logo) {
        doc.addImage("data:image/png;base64," + logo, "PNG",
          M, M - 2, SLIM_LOGO_W, SLIM_LOGO_H);
      }
      setFont("bold", 9.5);
      doc.text(T(ORG.name), M + SLIM_LOGO_W + 3.5, M + 4.5);
      setFont("normal", 7.6, MUTED);
      doc.text(T("Cerere " + regNo), PAGE.w - M, M + 4.5, { align: "right" });
      doc.setDrawColor(RED[0], RED[1], RED[2]);
      doc.setLineWidth(0.7);
      doc.line(M, SLIM_RULE_Y, PAGE.w - M, SLIM_RULE_Y);
      return SLIM_RULE_Y + 6;
    }

    /** Deschide o pagină nouă dacă blocul care urmează nu mai încape. */
    function need(height) {
      if (y + height > CONTENT_BOTTOM) {
        doc.addPage();
        y = slimHeader();
      }
    }

    function sectionTitle(label) {
      doc.setFillColor(RED[0], RED[1], RED[2]);
      doc.rect(M, y - 3.6, 2.4, 5.4, "F");
      setFont("bold", 9.8, INK);
      doc.text(T(label), M + 5, y);
      y += 4;
    }

    /**
     * Tabel etichetă/valoare. Fiecare rând verifică singur dacă încape,
     * deci un tabel lung se rupe curat între pagini.
     */
    function dataTable(rows, opts) {
      var options = opts || {};
      var labelW = contentW * 0.42;
      var padX = 3.4;
      var lineH = 3.6;

      rows.forEach(function (row, index) {
        var label = T(String(row[0]));
        var value = T(String(row[1] == null || row[1] === "" ? "—" : row[1]));
        var isKey = (options.highlightRows || []).indexOf(index) !== -1;

        setFont("normal", 8.4, MUTED);
        var labelLines = doc.splitTextToSize(label, labelW - padX * 2);
        setFont(isKey ? "bold" : "normal", isKey ? 9.2 : 8.7, INK);
        var valueLines = doc.splitTextToSize(value, contentW - labelW - padX * 2);

        var rowH = Math.max(labelLines.length, valueLines.length) * lineH + 2.7;
        need(rowH);

        if (index % 2 === 0) {
          doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]);
          doc.rect(M, y, contentW, rowH, "F");
        }
        if (isKey) {
          doc.setFillColor(253, 236, 236);
          doc.rect(M, y, contentW, rowH, "F");
        }
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        doc.setLineWidth(0.2);
        doc.rect(M, y, contentW, rowH);
        doc.line(M + labelW, y, M + labelW, y + rowH);

        setFont("normal", 8.4, MUTED);
        doc.text(labelLines, M + padX, y + 3.55);
        setFont(isKey ? "bold" : "normal", isKey ? 9.2 : 8.7, isKey ? RED : INK);
        doc.text(valueLines, M + labelW + padX, y + 3.55);

        y += rowH;
      });
    }

    /** Cât ar ocupa un bloc de bulinte, fără a-l desena. Îl folosim ca să
        cerem spațiu pentru tot blocul deodată, nu paragraf cu paragraf —
        altfel ultima declarație rămâne singură pe pagina următoare. */
    function bulletsHeight(list, size) {
      setFont("normal", size, INK);
      return list.reduce(function (total, paragraph) {
        return total + doc.splitTextToSize(T("• " + paragraph), contentW - 2).length * 3.5 + 1.4;
      }, 0);
    }

    /** Paragrafe cu bulină, folosite pentru declarații. */
    function bullets(list, size, color) {
      setFont("normal", size, color);
      list.forEach(function (paragraph) {
        var lines = doc.splitTextToSize(T("• " + paragraph), contentW - 2);
        need(lines.length * 3.5 + 1.4);
        setFont("normal", size, color);
        doc.text(lines, M + 1, y);
        y += lines.length * 3.5 + 1.4;
      });
    }

    /* ================= ANTETUL PRIMEI PAGINI ================= */
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

    y += 6.6;
    setFont("normal", 8.8, MUTED);
    doc.text(T("Nr. înregistrare: ") + regNo, M, y);
    doc.text(T("Data emiterii: ") + formatDate(issuedAt), PAGE.w - M, y, { align: "right" });

    /* ================= TITLU ================= */
    y += 9.5;
    setFont("bold", 13.5);
    var title = doc.splitTextToSize(T("CERERE DE ÎNSCRIERE ȘI ACORDARE ÎMPRUMUT"), contentW);
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

    /* ================= DATE DE IDENTIFICARE ================= */
    sectionTitle(nextLetter() + ". DATE DE IDENTIFICARE MEMBRU");
    dataTable([
      ["Nume și prenume", data.fullName],
      ["Cod Numeric Personal (CNP)", spaced(data.cnp)],
      ["Data și locul nașterii", birthLine(data.cnp, data.birthPlace)],
      ["Carte de identitate", "Seria " + data.idSeries + ", Nr. " + data.idNumber],
      ["Eliberată la data de / de către", issuedLine(data, "id")],
      ["Valabilitate act de identitate", formatDate(data.idExpiry)],
      ["Adresă de domiciliu", addressLine(data)],
      ["Telefon de contact", data.phone],
      ["Adresă de e-mail", data.email],
      ["Cont bancar (IBAN)", data.ibanFormatted || data.iban]
    ]);

    /* ================= LOC DE MUNCĂ ================= */
    y += 5.4;
    need(12);
    sectionTitle(nextLetter() + ". LOC DE MUNCĂ");
    dataTable([
      ["Unitatea angajatoare", data.employer],
      ["Sediul unității", data.employerAddress],
      ["Funcția", data.jobTitle],
      ["Secția / compartimentul", data.department],
      ["Marca", data.badgeNo]
    ]);

    /* ================= TERMENII ÎMPRUMUTULUI ================= */
    y += 5.4;
    need(12);
    sectionTitle(nextLetter() + ". TERMENII ÎMPRUMUTULUI SOLICITAT");
    var termRows = [
      ["Suma solicitată", moneyWords(loan.principal)],
      ["Perioada de rambursare", loan.months === 1 ? "1 lună" : loan.months + " luni"],
      ["Dobândă fixă aplicată", fmt(loan.annualRatePct, 0) + "% pe an"],
      ["Rata lunară estimată", money(loan.monthlyPayment)],
      ["Total de rambursat", money(loan.totalRepayment)]
    ];
    if (loan.netSalary) {
      termRows.push(["Salariu net de bază declarat", moneyWords(loan.netSalary)]);
      if (loan.debtRatio != null) {
        termRows.push(["Rata în venitul net", fmt(loan.debtRatio, 1) + "%"]);
      }
    }
    dataTable(termRows, { highlightRows: [3] });

    /* ================= GIRANT (doar dacă există) ================= */
    if (guarantor) {
      y += 5.4;
      need(20);
      sectionTitle(nextLetter() + ". GIRANT");

      /* Aceleași rubrici pe care le cere „Angajamentul de fideiusor” din
         anexa contractului, în aceeași ordine, ca să se copieze direct. */
      var gRows = [
        ["Nume și prenume", guarantor.fullName],
        ["Cod Numeric Personal (CNP)", spaced(guarantor.cnp)],
        ["Data și locul nașterii", birthLine(guarantor.cnp, guarantor.birthPlace)],
        ["Carte de identitate", "Seria " + guarantor.idSeries + ", Nr. " + guarantor.idNumber],
        ["Eliberată la data de / de către", issuedLine(guarantor, "id")],
        ["Valabilitate act de identitate", formatDate(guarantor.idExpiry)],
        ["Adresă de domiciliu", addressLine(guarantor)],
        ["Telefon de contact", guarantor.phone],
        ["Adresă de e-mail", guarantor.email],
        ["Unitatea angajatoare", guarantor.employer],
        ["Sediul unității", guarantor.employerAddress],
        ["Funcția", guarantor.jobTitle],
        ["Secția / compartimentul", guarantor.department],
        ["Marca", guarantor.badgeNo],
        ["Calitatea față de solicitant", guarantor.relation]
      ];
      if (guarantor.netSalary) {
        gRows.push(["Venit lunar net de bază", moneyWords(guarantor.netSalary)]);
        if (guarantor.debtRatio != null) {
          gRows.push(["Rata în venitul girantului", fmt(guarantor.debtRatio, 1) + "%"]);
        }
      }
      gRows.push(["Sumă garantată solidar", moneyWords(loan.principal)]);
      dataTable(gRows, { highlightRows: [gRows.length - 1] });

      y += 3.4;
      var gDeclarations = [
        "Subsemnatul/Subsemnata, în calitate de fideiusor solidar în condițiile art. 2300 " +
          "Cod Civil, mă angajez față de Casa de Ajutor Reciproc Sanitas București să plătesc " +
          "suma de " + moneyWords(loan.principal) + ", reprezentând împrumutul la care se adaugă " +
          "dobânzile și eventualele penalități de întârziere, în cazul în care titularul nu " +
          "achită împrumutul la termenele și în condițiile din contract.",
        "Declar că înțeleg noțiunea de fideiusor solidar și efectele ei juridice: C.A.R. se " +
          "poate îndrepta direct împotriva mea, fără să urmărească mai întâi bunurile " +
          "titularului, și poate urmări oricare dintre fideiusori pentru întreaga sumă."
      ];
      need(bulletsHeight(gDeclarations, 7.9));
      bullets(gDeclarations, 7.9, [60, 66, 78]);
    }

    /* ================= DECLARAȚII ================= */
    var declarations = [
      "Declar pe propria răspundere că datele înscrise în prezenta cerere, inclusiv salariul " +
        "net de bază declarat, sunt complete și conforme cu realitatea și cu actul de identitate prezentat.",
      "Mă oblig să restitui împrumutul acordat în ratele lunare stabilite, împreună cu dobânda " +
        "fixă de " + fmt(loan.annualRatePct, 0) + "% pe an, conform statutului C.A.R. Sanitas București.",
      "Îmi exprim consimțământul pentru prelucrarea datelor cu caracter personal cuprinse în " +
        "prezenta cerere, în scopul analizării și administrării împrumutului, în conformitate cu " +
        "Regulamentul (UE) 2016/679 (GDPR)."
    ];

    y += 5.4;
    need(4.4 + bulletsHeight(declarations, 7.9));
    setFont("bold", 9.4);
    doc.text(T(nextLetter() + ". DECLARAȚII ȘI CONSIMȚĂMÂNT"), M, y);
    y += 4.4;
    bullets(declarations, 7.9, [60, 66, 78]);

    /* ================= CUM SE SEMNEAZĂ ================= */
    /* Documentul nu se semnează: e fișa de date din care societatea
       completează contractul-cadru. Semnarea are loc ulterior, electronic,
       pe contract. Spunem asta explicit, ca nimeni să nu-l printeze degeaba. */
    y += 4.6;
    need(20);

    doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(M, y, contentW, 16, 2, 2, "FD");
    setFont("bold", 8, INK);
    doc.text(T("ACEST DOCUMENT NU SE SEMNEAZĂ"), M + 4, y + 5.6);
    setFont("normal", 7.8, MUTED);
    var signNote = doc.splitTextToSize(T(
      "Este fișa de date depusă online la " + formatDate(issuedAt) + ", din care Sanitas CAR " +
      "pregătește contractul. Contractul se semnează electronic, cu semnătură calificată și " +
      "identificare video, de către " + (guarantor ? "titular, girant și Sanitas CAR." : "titular și Sanitas CAR.")
    ), contentW - 8);
    doc.text(signNote, M + 4, y + 10.4);
    y += 16 + 5;

    /* ---------- Zonă rezervată CAR ---------- */
    need(14);
    doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.roundedRect(M, y, contentW, 14, 2, 2, "FD");
    setFont("bold", 7.8, MUTED);
    doc.text(T("SPAȚIU REZERVAT SANITAS CAR"), M + 4, y + 5.2);
    setFont("normal", 7.8, MUTED);
    doc.text(T("Aprobat / Respins:  ...........................        Nr. hotărâre:  ...........................        " +
      "Semnătura și ștampila:  ..........................."), M + 4, y + 10.6);

    var contentBottom = y + 14;

    /* ================= FOOTER, pe toate paginile ================= */
    var pages = doc.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.25);
      doc.line(M, FOOTER_Y, PAGE.w - M, FOOTER_Y);
      setFont("normal", 7.4, MUTED);
      doc.text(T("Document generat automat de platforma Sanitas CAR · " + regNo), M, FOOTER_Y + 5);
      doc.text(T("Pagina " + i + " din " + pages), PAGE.w - M, FOOTER_Y + 5, { align: "right" });
    }

    return {
      doc: doc, regNo: regNo, issuedAt: issuedAt,
      fileName: fileName(data.fullName),
      pages: pages, contentBottom: contentBottom, footerTop: FOOTER_Y
    };
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

  /* Data nașterii nu se cere în formular: o scoatem din CNP, unde e deja
     codificată. Rămâne de completat doar localitatea. */
  function birthLine(cnpValue, place) {
    var V = global.Validators;
    var res = V && V.cnp ? V.cnp(cnpValue) : null;
    var when = res && res.ok && res.birthDate ? V.formatDateRo(res.birthDate) : "";
    return [when, place].filter(Boolean).join(", ") || "";
  }

  /* Contractul cere fiecare sumă și în litere. */
  function moneyWords(value) {
    var N = global.NumbersRo;
    var words = N && N.lei ? N.lei(value) : "";
    return words ? money(value) + " (" + words + ")" : money(value);
  }

  function issuedLine(d, prefix) {
    var on = d[prefix + "IssuedOn"];
    var by = d[prefix + "IssuedBy"];
    return [on ? formatDate(on) : "", by].filter(Boolean).join(", ");
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
