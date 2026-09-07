/* ============================================================
   Sanitas CAR — calculul împrumutului
   Dobândă fixă 12% pe an, anuitate bancară cu rate lunare egale.
   ============================================================ */
(function (global) {
  "use strict";

  var ANNUAL_RATE = 0.12;         // 12% pe an, fix
  var MONTHLY_RATE = ANNUAL_RATE / 12;

  var AMOUNTS = [1000, 2000, 3000, 4000, 5000];
  var TABLE_TERMS = [6, 12, 18, 24];
  var MIN_MONTHS = 1;
  var MAX_MONTHS = 24;

  /**
   * Rata lunară pentru o anuitate cu rate egale:
   *   R = P * i / (1 - (1 + i)^-n)
   * Rezultatul e rotunjit la 2 zecimale (bani).
   */
  function monthlyPayment(principal, months) {
    if (!(principal > 0) || !(months > 0)) return 0;
    var i = MONTHLY_RATE;
    var raw = principal * i / (1 - Math.pow(1 + i, -months));
    return Math.round(raw * 100) / 100;
  }

  /** Sumarul complet al simulării, folosit atât în pagină, cât și în PDF. */
  function simulate(principal, months) {
    var rate = monthlyPayment(principal, months);
    var total = Math.round(rate * months * 100) / 100;
    return {
      principal: principal,
      months: months,
      annualRatePct: ANNUAL_RATE * 100,
      monthlyPayment: rate,
      totalRepayment: total,
      totalInterest: Math.round((total - principal) * 100) / 100
    };
  }

  /* ---------- formatare românească: 3.198,60 lei ---------- */

  var nfMoney = new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  var nfInt = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

  function money(value) { return nfMoney.format(value) + " lei"; }
  function whole(value) { return nfInt.format(value) + " lei"; }
  function monthsLabel(n) { return n === 1 ? "1 lună" : n + " luni"; }

  global.LoanMath = {
    ANNUAL_RATE: ANNUAL_RATE,
    MONTHLY_RATE: MONTHLY_RATE,
    AMOUNTS: AMOUNTS,
    TABLE_TERMS: TABLE_TERMS,
    MIN_MONTHS: MIN_MONTHS,
    MAX_MONTHS: MAX_MONTHS,
    monthlyPayment: monthlyPayment,
    simulate: simulate,
    money: money,
    whole: whole,
    monthsLabel: monthsLabel
  };
})(typeof window !== "undefined" ? window : globalThis);

/* Reutilizat de server (Node) pentru re-validarea datelor primite. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).LoanMath;
}

