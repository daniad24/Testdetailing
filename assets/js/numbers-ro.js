/* ============================================================
   Sanitas CAR — sume în litere

   Anexa 1 (angajament girant) cere fiecare sumă scrisă și în
   cuvinte: „20.000 lei (douăzeci de mii de lei)”. O generăm noi,
   ca funcționarul să o copieze, nu să o scrie de mână.
   ============================================================ */
(function (global) {
  "use strict";

  /* Româna acordă numeralul cu genul substantivului:
     „două mii”, dar „doi lei”. De aceea ținem ambele forme. */
  var UNITS_M = ["zero", "unu", "doi", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă"];
  var UNITS_F = ["zero", "una", "două", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă"];
  var TEENS_M = ["zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece",
                 "cincisprezece", "șaisprezece", "șaptesprezece", "optsprezece", "nouăsprezece"];
  var TEENS_F = ["zece", "unsprezece", "douăsprezece", "treisprezece", "paisprezece",
                 "cincisprezece", "șaisprezece", "șaptesprezece", "optsprezece", "nouăsprezece"];
  var TENS = ["", "", "douăzeci", "treizeci", "patruzeci", "cincizeci",
              "șaizeci", "șaptezeci", "optzeci", "nouăzeci"];

  function under100(n, feminine) {
    var units = feminine ? UNITS_F : UNITS_M;
    if (n < 10) return units[n];
    if (n < 20) return (feminine ? TEENS_F : TEENS_M)[n - 10];
    var t = Math.floor(n / 10);
    var u = n % 10;
    return u ? TENS[t] + " și " + units[u] : TENS[t];
  }

  /* Sutele sunt întotdeauna feminine: „două sute”, nu „doi sute”. */
  function under1000(n, feminine) {
    if (n < 100) return under100(n, feminine);
    var h = Math.floor(n / 100);
    var rest = n % 100;
    var head = h === 1 ? "o sută" : UNITS_F[h] + " sute";
    return rest ? head + " " + under100(rest, feminine) : head;
  }

  /* Româna cere „de” între numeral și substantiv când ultimele două
     cifre sunt 00 sau între 20 și 99: „douăzeci de lei”, „o sută de lei”,
     dar „douăsprezece mii” și „o sută nouăsprezece lei”. */
  function needsDe(n) {
    var last = n % 100;
    return last === 0 || last >= 20;
  }

  function thousands(n) {
    if (n === 1) return "o mie";
    return under1000(n, true) + (needsDe(n) ? " de mii" : " mii");
  }

  function integerWords(n) {
    if (n === 0) return "zero";
    var th = Math.floor(n / 1000);
    var rest = n % 1000;
    var parts = [];
    if (th) parts.push(thousands(th));
    if (rest) parts.push(under1000(rest, false));
    return parts.join(" ");
  }

  function withNoun(n, one, few, many) {
    if (n === 1) return one;
    return integerWords(n) + " " + (n !== 0 && needsDe(n) ? "de " + many : few);
  }

  /** 3500 → „trei mii cinci sute de lei”. */
  function lei(amount) {
    var n = Math.round(Number(amount) * 100) / 100;
    if (!isFinite(n) || n < 0) return "";
    var whole = Math.floor(n);
    var cents = Math.round((n - whole) * 100);

    var text = withNoun(whole, "un leu", "lei", "lei");
    if (!cents) return text;
    return text + " și " + withNoun(cents, "un ban", "bani", "bani");
  }

  /** „3.500 lei (trei mii cinci sute de lei)” — forma din contract. */
  function leiWithWords(amount) {
    var digits = new Intl.NumberFormat("ro-RO", {
      minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(Number(amount));
    return digits + " lei (" + lei(amount) + ")";
  }

  global.NumbersRo = {
    integerWords: integerWords,
    lei: lei,
    leiWithWords: leiWithWords
  };
})(typeof window !== "undefined" ? window : globalThis);

/* Reutilizat de server (Node) la compunerea e-mailului către societate. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).NumbersRo;
}
