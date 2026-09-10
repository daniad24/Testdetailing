/* ============================================================
   Sanitas CAR — validări formular
   Fiecare validator întoarce { ok: boolean, msg: string, value?: string }
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------------- Nume ---------------- */
  function fullName(raw) {
    var v = String(raw || "").trim().replace(/\s+/g, " ");
    if (v.length < 3) return { ok: false, msg: "Introdu numele complet (minim 3 caractere)." };
    if (!/^[A-Za-zĂÂÎȘȚăâîșțĢ'\-\s.]+$/.test(v)) {
      return { ok: false, msg: "Numele poate conține doar litere, spații, cratimă sau apostrof." };
    }
    if (v.split(" ").length < 2) return { ok: false, msg: "Introdu atât numele, cât și prenumele." };
    return { ok: true, msg: "Nume valid.", value: v };
  }

  /* ---------------- Serie buletin: 2 litere mari ---------------- */
  function idSeries(raw) {
    var v = String(raw || "").trim().toUpperCase();
    if (!v) return { ok: false, msg: "Completează seria (2 litere)." };
    if (!/^[A-Z]{2}$/.test(v)) return { ok: false, msg: "Seria are exact 2 litere mari (ex: RK)." };
    return { ok: true, msg: "Serie validă.", value: v };
  }

  /* ---------------- Număr buletin: 6 cifre ---------------- */
  function idNumber(raw) {
    var v = String(raw || "").trim();
    if (!v) return { ok: false, msg: "Completează numărul (6 cifre)." };
    if (!/^\d{6}$/.test(v)) return { ok: false, msg: "Numărul are exact 6 cifre (ex: 123456)." };
    return { ok: true, msg: "Număr valid.", value: v };
  }

  /* ---------------- Expirare buletin: nu poate fi în trecut ---------------- */
  function idExpiry(raw) {
    var v = String(raw || "").trim();
    if (!v) return { ok: false, msg: "Selectează data expirării." };
    var d = new Date(v + "T00:00:00");
    if (isNaN(d.getTime())) return { ok: false, msg: "Dată invalidă." };
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return { ok: false, msg: "Actul de identitate este expirat. Reînnoiește-l înainte de a depune cererea." };
    var maxYear = today.getFullYear() + 30;
    if (d.getFullYear() > maxYear) return { ok: false, msg: "Verifică anul expirării." };
    return { ok: true, msg: "Act valabil până la " + formatDateRo(d) + ".", value: v };
  }

  /* ---------------- CNP: 13 cifre + cifră de control ---------------- */
  var CNP_KEY = "279146358279";

  function cnp(raw) {
    var v = String(raw || "").replace(/\s/g, "");
    if (!v) return { ok: false, msg: "Completează CNP-ul (13 cifre)." };
    if (!/^\d+$/.test(v)) return { ok: false, msg: "CNP-ul conține doar cifre." };
    if (v.length !== 13) {
      return { ok: false, msg: "CNP-ul are exact 13 cifre (ai introdus " + v.length + ")." };
    }

    var s = Number(v[0]);
    if (s === 0) return { ok: false, msg: "CNP invalid: prima cifră nu poate fi 0." };

    // Secolul nașterii, dat de prima cifră
    var century;
    if (s === 1 || s === 2) century = 1900;
    else if (s === 3 || s === 4) century = 1800;
    else if (s === 5 || s === 6) century = 2000;
    else century = 1900; // 7, 8 (rezidenți) și 9 (străini)

    var year = century + Number(v.slice(1, 3));
    var month = Number(v.slice(3, 5));
    var day = Number(v.slice(5, 7));
    if (!isRealDate(year, month, day)) {
      return { ok: false, msg: "CNP invalid: data nașterii din CNP nu există." };
    }

    var countyCode = Number(v.slice(7, 9));
    var countyOk = (countyCode >= 1 && countyCode <= 52) || countyCode === 70;
    if (!countyOk) return { ok: false, msg: "CNP invalid: codul de județ nu este recunoscut." };

    // Cifra de control
    var sum = 0;
    for (var i = 0; i < 12; i++) sum += Number(v[i]) * Number(CNP_KEY[i]);
    var check = sum % 11;
    if (check === 10) check = 1;
    if (check !== Number(v[12])) {
      return { ok: false, msg: "CNP invalid: cifra de control nu corespunde. Verifică cifrele introduse." };
    }

    var birth = new Date(Date.UTC(year, month - 1, day));
    return {
      ok: true,
      msg: "CNP validat (născut/ă la " + formatDateRo(birth) + ").",
      value: v,
      birthDate: birth
    };
  }

  function isRealDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  /* ---------------- IBAN: RO + 22 caractere, control mod-97 ---------------- */
  function iban(raw) {
    var v = String(raw || "").replace(/[\s\-]/g, "").toUpperCase();
    if (!v) return { ok: false, msg: "Completează contul IBAN." };
    if (!/^[A-Z0-9]+$/.test(v)) return { ok: false, msg: "IBAN-ul conține doar litere și cifre." };
    if (!/^RO/.test(v)) return { ok: false, msg: "IBAN-ul trebuie să înceapă cu RO." };
    if (v.length !== 24) {
      return { ok: false, msg: "IBAN-ul românesc are 24 de caractere (ai introdus " + v.length + ")." };
    }
    if (!/^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(v)) {
      return { ok: false, msg: "Format IBAN incorect: RO + 2 cifre + 4 litere (banca) + 16 caractere." };
    }
    if (mod97(v) !== 1) {
      return { ok: false, msg: "IBAN invalid: cifrele de control nu corespund. Verifică din nou contul." };
    }
    return { ok: true, msg: "IBAN validat.", value: v, formatted: groupIban(v) };
  }

  function mod97(input) {
    // Mută primele 4 caractere la final, apoi transformă literele în cifre (A=10 … Z=35)
    var rearranged = input.slice(4) + input.slice(0, 4);
    var remainder = 0;
    for (var i = 0; i < rearranged.length; i++) {
      var ch = rearranged[i];
      var chunk = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
      for (var j = 0; j < chunk.length; j++) {
        remainder = (remainder * 10 + Number(chunk[j])) % 97;
      }
    }
    return remainder;
  }

  function groupIban(v) {
    return String(v).replace(/(.{4})/g, "$1 ").trim();
  }

  /* ---------------- E-mail ---------------- */
  function email(raw) {
    var v = String(raw || "").trim();
    if (!v) return { ok: false, msg: "Completează adresa de e-mail." };
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v)) {
      return { ok: false, msg: "Adresă de e-mail invalidă (ex: nume@exemplu.ro)." };
    }
    return { ok: true, msg: "Aici vei primi cererea în PDF.", value: v.toLowerCase() };
  }

  /* ---------------- Telefon: 10 cifre ---------------- */
  function phone(raw) {
    var v = String(raw || "").replace(/[\s\-().]/g, "");
    if (v.indexOf("+40") === 0) v = "0" + v.slice(3);
    if (!v) return { ok: false, msg: "Completează numărul de telefon." };
    if (!/^\d{10}$/.test(v)) {
      return { ok: false, msg: "Numărul are exact 10 cifre (ex: 0721234567)." };
    }
    if (v[0] !== "0") return { ok: false, msg: "Numărul începe cu 0." };
    return { ok: true, msg: "Număr valid.", value: v };
  }

  /* ---------------- Salariu net lunar ---------------- */
  var MIN_SALARY = 100;
  var MAX_SALARY = 100000;

  function netSalary(raw) {
    // Acceptăm „3500”, „3.500”, „3 500” și „3500,50”.
    var v = String(raw || "").trim().replace(/[\s.]/g, "").replace(",", ".");
    if (!v) return { ok: false, msg: "Completează salariul net lunar." };
    if (!/^\d+(\.\d{1,2})?$/.test(v)) {
      return { ok: false, msg: "Introdu doar cifre (ex: 3500)." };
    }
    var n = Number(v);
    if (!isFinite(n) || n < MIN_SALARY) {
      return { ok: false, msg: "Suma pare prea mică. Introdu venitul net lunar, în lei." };
    }
    if (n > MAX_SALARY) {
      return { ok: false, msg: "Suma pare prea mare. Verifică valoarea introdusă." };
    }
    return { ok: true, msg: "", value: Math.round(n * 100) / 100 };
  }

  /* ---------------- Câmp text obligatoriu ---------------- */
  function required(raw, label, min) {
    var v = String(raw || "").trim().replace(/\s+/g, " ");
    var minLen = min || 2;
    if (v.length < minLen) return { ok: false, msg: "Completează " + label + "." };
    return { ok: true, msg: "", value: v };
  }

  /* ---------------- Utilitare de dată ---------------- */
  function formatDateRo(date) {
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("ro-RO", {
      day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"
    }).format(d);
  }

  global.Validators = {
    fullName: fullName,
    idSeries: idSeries,
    idNumber: idNumber,
    idExpiry: idExpiry,
    cnp: cnp,
    iban: iban,
    email: email,
    phone: phone,
    netSalary: netSalary,
    required: required,
    groupIban: groupIban,
    formatDateRo: formatDateRo
  };
})(typeof window !== "undefined" ? window : globalThis);

/* Reutilizat de server (Node) pentru re-validarea datelor primite. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).Validators;
}

