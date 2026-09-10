/* ============================================================
   Sanitas CAR — server de livrare a cererilor
   - servește landing page-ul (rădăcina proiectului)
   - primește POST /api/cerere cu datele + PDF-ul generat în browser
   - re-validează datele pe server și trimite documentul pe e-mail
     (către solicitant și către inbox-ul administrativ)
   ============================================================ */
"use strict";

require("dotenv").config();

const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const nodemailer = require("nodemailer");

const V = require("../assets/js/validation.js");
const LM = require("../assets/js/loan-math.js");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;
const DRY_RUN = process.env.DRY_RUN === "1";
const CAR_INBOX = process.env.CAR_INBOX || "";
const MAIL_FROM = process.env.MAIL_FROM || "Sanitas CAR <no-reply@sanitascar.ro>";
const MAX_PDF_BYTES = 2 * 1024 * 1024;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "6mb" }));
/* Nu expunem niciodată folderul serverului (conține .env) sau fișiere ascunse. */
const BLOCKED = /^\/(server|\.|node_modules)/;
app.use((req, res, next) => {
  if (BLOCKED.test(decodeURIComponent(req.path))) return res.status(404).send("Not found");
  next();
});
app.use(express.static(ROOT, { extensions: ["html"], dotfiles: "deny" }));

/* ------------------------------------------------------------
   Re-validarea datelor primite. Validările din browser sunt
   pentru confortul utilizatorului; acestea sunt cele care contează.
   ------------------------------------------------------------ */
function validatePayload(body) {
  const a = (body && body.applicant) || {};
  const errors = [];
  const clean = {};

  const checks = {
    fullName: V.fullName(a.fullName),
    idSeries: V.idSeries(a.idSeries),
    idNumber: V.idNumber(a.idNumber),
    idExpiry: V.idExpiry(a.idExpiry),
    cnp: V.cnp(a.cnp),
    county: V.required(a.county, "județul"),
    city: V.required(a.city, "localitatea"),
    street: V.required(a.street, "strada"),
    streetNo: V.required(a.streetNo, "numărul", 1),
    iban: V.iban(a.iban),
    email: V.email(a.email),
    phone: V.phone(a.phone),
    netSalary: V.netSalary(a.netSalary)
  };

  for (const [field, result] of Object.entries(checks)) {
    if (result.ok) clean[field] = result.value;
    else errors.push(`${field}: ${result.msg}`);
  }

  if (a.gdpr !== true) errors.push("gdpr: acordul de prelucrare a datelor este obligatoriu.");

  // Termenii împrumutului se recalculează pe server, nu se preiau de la client.
  const principal = Number(body && body.loan && body.loan.principal);
  const months = Number(body && body.loan && body.loan.months);
  if (!LM.AMOUNTS.includes(principal)) {
    errors.push(`loan.principal: suma trebuie să fie una dintre ${LM.AMOUNTS.join(", ")} lei.`);
  }
  if (!Number.isInteger(months) || months < LM.MIN_MONTHS || months > LM.MAX_MONTHS) {
    errors.push(`loan.months: perioada trebuie să fie între ${LM.MIN_MONTHS} și ${LM.MAX_MONTHS} luni.`);
  }

  const pdfBase64 = String((body && body.pdfBase64) || "");
  if (!pdfBase64) errors.push("pdfBase64: documentul lipsește.");
  else if (!/^[A-Za-z0-9+/=\s]+$/.test(pdfBase64)) errors.push("pdfBase64: conținut invalid.");

  let pdfBuffer = null;
  if (pdfBase64 && errors.length === 0) {
    pdfBuffer = Buffer.from(pdfBase64, "base64");
    if (pdfBuffer.length > MAX_PDF_BYTES) errors.push("pdfBase64: documentul depășește 2 MB.");
    if (pdfBuffer.subarray(0, 4).toString("latin1") !== "%PDF") {
      errors.push("pdfBase64: fișierul primit nu este un PDF.");
    }
  }

  if (errors.length) return { ok: false, errors };

  const loan = LM.simulate(principal, months);
  loan.netSalary = clean.netSalary;
  loan.debtRatio = LM.debtRatio(loan.monthlyPayment, clean.netSalary);

  return {
    ok: true,
    applicant: clean,
    loan,
    regNo: sanitizeRegNo(body.regNo),
    fileName: safeFileName(body.fileName, clean.fullName),
    pdfBuffer
  };
}

function sanitizeRegNo(value) {
  const v = String(value || "").trim();
  return /^[A-Za-z0-9/\-]{5,40}$/.test(v) ? v : `CAR/${Date.now()}`;
}

/** Numele fișierului vine de la client: îl curățăm ca să nu poată ieși din folder. */
function safeFileName(value, fullName) {
  const base = path.basename(String(value || ""));
  if (/^[A-Za-z0-9._-]{5,120}\.pdf$/.test(base)) return base;
  const slug = String(fullName || "Solicitant")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `Cerere_Sanitas_CAR_${slug || "Solicitant"}.pdf`;
}

/* ------------------------------------------------------------
   Transport SMTP
   ------------------------------------------------------------ */
let transporter = null;
function getTransporter() {
  if (DRY_RUN) return null;
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP nu este configurat. Completează server/.env (sau pornește cu DRY_RUN=1).");
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
  return transporter;
}

/* ------------------------------------------------------------
   Conținutul e-mailurilor
   ------------------------------------------------------------ */
const money = (v) =>
  new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " lei";

const ratioText = (l) =>
  l.debtRatio == null ? "—" : `${l.debtRatio.toFixed(1).replace(".", ",")}%`;

function applicantMail(d) {
  const { applicant: a, loan: l, regNo } = d;
  return {
    subject: `Cererea ta de împrumut Sanitas CAR — ${regNo}`,
    text: [
      `Bună, ${a.fullName},`,
      ``,
      `Am înregistrat cererea ta de înscriere și acordare împrumut cu numărul ${regNo}.`,
      `Documentul oficial este atașat acestui e-mail, în format PDF.`,
      ``,
      `Rezumatul cererii:`,
      `  • Sumă solicitată: ${money(l.principal)}`,
      `  • Perioadă: ${l.months === 1 ? "1 lună" : l.months + " luni"}`,
      `  • Dobândă fixă: ${l.annualRatePct}% pe an`,
      `  • Rată lunară estimată: ${money(l.monthlyPayment)}`,
      `  • Total de rambursat: ${money(l.totalRepayment)}`,
      `  • Venit net declarat: ${money(l.netSalary)}`,
      `  • Rata în venitul net: ${ratioText(l)}`,
      `  • Cont pentru virament: ${a.iban}`,
      ``,
      `Cererea va fi analizată de comisia Sanitas CAR, iar rezultatul îți va fi comunicat`,
      `pe acest e-mail sau la numărul de telefon ${a.phone}.`,
      ``,
      `Cu stimă,`,
      `Casa de Ajutor Reciproc Sanitas București`
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#16181d;line-height:1.6">
        <p>Bună, <strong>${escapeHtml(a.fullName)}</strong>,</p>
        <p>Am înregistrat cererea ta de înscriere și acordare împrumut cu numărul
           <strong>${escapeHtml(regNo)}</strong>. Documentul oficial este atașat în format PDF.</p>
        <table cellpadding="8" style="border-collapse:collapse;font-size:14px;margin:18px 0">
          ${row("Sumă solicitată", money(l.principal))}
          ${row("Perioadă", l.months === 1 ? "1 lună" : `${l.months} luni`)}
          ${row("Dobândă fixă", `${l.annualRatePct}% pe an`)}
          ${row("Rată lunară estimată", `<strong style="color:#EA1B23">${money(l.monthlyPayment)}</strong>`)}
          ${row("Total de rambursat", money(l.totalRepayment))}
          ${row("Venit net declarat", money(l.netSalary))}
          ${row("Rata în venitul net", escapeHtml(ratioText(l)))}
          ${row("Cont pentru virament", escapeHtml(a.iban))}
        </table>
        <p>Cererea va fi analizată de comisia Sanitas CAR, iar rezultatul îți va fi comunicat
           pe acest e-mail sau la telefon ${escapeHtml(a.phone)}.</p>
        <p style="color:#6b7280;font-size:13px">Casa de Ajutor Reciproc Sanitas București</p>
      </div>`
  };
}

function officeMail(d) {
  const { applicant: a, loan: l, regNo } = d;
  return {
    subject: `[Cerere nouă] ${a.fullName} — ${money(l.principal)} / ${l.months} luni — ${regNo}`,
    text: [
      `Cerere nouă depusă online.`,
      ``,
      `Nr. înregistrare: ${regNo}`,
      `Nume: ${a.fullName}`,
      `CNP: ${a.cnp}`,
      `CI: seria ${a.idSeries}, nr. ${a.idNumber}, valabil până la ${a.idExpiry}`,
      `Domiciliu: ${a.street} nr. ${a.streetNo}, ${a.city}, ${a.county}`,
      `Telefon: ${a.phone}`,
      `E-mail: ${a.email}`,
      `IBAN: ${a.iban}`,
      ``,
      `Sumă: ${money(l.principal)}`,
      `Perioadă: ${l.months} luni`,
      `Dobândă: ${l.annualRatePct}% pe an`,
      `Rată lunară: ${money(l.monthlyPayment)}`,
      `Total de rambursat: ${money(l.totalRepayment)}`,
      ``,
      `Venit net declarat: ${money(l.netSalary)}`,
      `Rata în venitul net: ${ratioText(l)}${l.debtRatio > LM.COMFORT_RATIO * 100 ? "  <-- peste o treime din venit" : ""}`,
      ``,
      `Acord GDPR: bifat de solicitant la depunere.`
    ].join("\n")
  };
}

const row = (label, value) =>
  `<tr><td style="border-bottom:1px solid #e4e7ec;color:#6b7280">${label}</td>
       <td style="border-bottom:1px solid #e4e7ec;text-align:right">${value}</td></tr>`;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ------------------------------------------------------------
   Endpoint
   ------------------------------------------------------------ */
app.post("/api/cerere", async (req, res) => {
  const parsed = validatePayload(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ ok: false, error: "Date invalide.", details: parsed.errors });
  }

  const attachment = {
    filename: parsed.fileName,
    content: parsed.pdfBuffer,
    contentType: "application/pdf"
  };

  try {
    if (DRY_RUN) {
      const dir = path.join(__dirname, "cereri");
      await fs.mkdir(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await fs.writeFile(path.join(dir, `${stamp}_${parsed.fileName}`), parsed.pdfBuffer);
      await fs.writeFile(
        path.join(dir, `${stamp}_${parsed.fileName}.json`),
        JSON.stringify({ regNo: parsed.regNo, applicant: parsed.applicant, loan: parsed.loan }, null, 2)
      );
      console.log(`[DRY_RUN] Cerere salvată local: ${parsed.regNo} — ${parsed.applicant.fullName}`);
      return res.json({ ok: true, regNo: parsed.regNo, dryRun: true });
    }

    const tx = getTransporter();
    const toApplicant = applicantMail(parsed);
    await tx.sendMail({
      from: MAIL_FROM,
      to: parsed.applicant.email,
      subject: toApplicant.subject,
      text: toApplicant.text,
      html: toApplicant.html,
      attachments: [attachment]
    });

    if (CAR_INBOX) {
      const toOffice = officeMail(parsed);
      await tx.sendMail({
        from: MAIL_FROM,
        to: CAR_INBOX,
        replyTo: parsed.applicant.email,
        subject: toOffice.subject,
        text: toOffice.text,
        attachments: [attachment]
      });
    }

    console.log(`Cerere trimisă: ${parsed.regNo} — ${parsed.applicant.fullName} -> ${parsed.applicant.email}`);
    res.json({ ok: true, regNo: parsed.regNo });
  } catch (err) {
    console.error("Eroare la trimiterea cererii:", err);
    res.status(502).json({ ok: false, error: "Cererea nu a putut fi trimisă pe e-mail. Încearcă din nou." });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, dryRun: DRY_RUN, smtpConfigured: Boolean(process.env.SMTP_HOST) });
});

app.listen(PORT, () => {
  console.log(`Sanitas CAR pornit pe http://localhost:${PORT}`);
  if (DRY_RUN) console.log("Mod DRY_RUN: cererile se salvează în server/cereri/, fără e-mailuri.");
  else if (!process.env.SMTP_HOST) console.log("Atenție: SMTP neconfigurat — completează server/.env.");
});
