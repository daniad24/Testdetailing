# Sanitas CAR — dosarul complet al proiectului

Tot ce s-a construit, tot ce s-a decis și de ce, tot ce s-a reparat și tot ce a
rămas deschis. `README.md` este manualul tehnic (cum pornești, cum personalizezi);
documentul de față este istoricul și raționamentul din spatele fiecărei decizii.

**Ultima actualizare:** 20 octombrie 2026 · commit `190730f`

---

## 1. Ce este

O platformă web pentru **Casa de Ajutor Reciproc Sanitas București**, fond de
întrajutorare al angajaților din sistemul sanitar.

Pornită de la `Caiet_Sarcini_Sanitas_CAR.pdf` plus logo-ul Sanitas, trimise la
începutul lunii septembrie 2026.

Pagina face trei lucruri:

1. **Simulează** împrumutul — suma, perioada, rata lunară, calculate live.
2. **Colectează** datele cererii, verificate la tastare.
3. **Generează** cererea oficială în PDF și o trimite pe e-mail, la client și la
   societate.

Rolul real al paginii, așa cum a fost clarificat pe parcurs: **este formularul din
care societatea pregătește contractul.** Nu este un contract și nu se semnează.
Clientul introduce datele o dată, societatea le primește gata verificate și le
toarnă în contractul-cadru.

### Unde este

| | |
|---|---|
| Live | https://sanitas.husanudaniel.ro |
| Repozitoriu | `daniad24/Testdetailing` |
| Branch de lucru | `claude/project-pdf-logo-k06v0k` |
| GitHub Pages publică din | `claude/project-pdf-logo-k06v0k` ⚠️ *vezi secțiunea 11* |

---

## 2. Fluxul complet, de la client la bani

```
   CLIENT (telefon)                SOCIETATE                  SEMNARE
   ─────────────────               ──────────                 ───────
   simulează suma
   și perioada
         │
         ▼
   ⚠ pop-up: pregătește-ți
     actele înainte
         │
         ▼
   completează formularul  ──────▶ primește e-mail cu:
   (validare la tastare)           · subiect [CU/FĂRĂ GIRANT]
         │                         · PDF-ul cererii
         ▼                         · JSON cu toate datele
   ⚠ pop-up: ești sigur                   │
     că datele sunt corecte?               ▼
         │                         completează contractul-cadru
         ▼                         (unul din două șabloane)
   primește PDF-ul                         │
   pe e-mail                                ▼
                                   încarcă în aplicația de semnare
                                            │
                                            ▼
                                   ┌────────────────────────────┐
                                   │ semnătură calificată +     │
                                   │ identificare video         │
                                   │                            │
                                   │ CU girant:  3 semnături    │
                                   │   titular, girant, Sanitas │
                                   │ FĂRĂ girant: 2 semnături   │
                                   │   titular, Sanitas         │
                                   └────────────────────────────┘
                                            │
                                            ▼
                                     clientul primește banii
```

---

## 3. Cronologia a ceea ce s-a construit

| Commit | Data | Ce aduce |
|---|---|---|
| `45eb260` | 07.09 | Platforma inițială: simulator, cerere online, PDF automat |
| `4a4eb91` | 07.09 | Alternativă la previzualizarea PDF, schemă de culori fixată |
| `380ede2` | 07.09 | Merge pull request #1 |
| `0b6423d` | 07.09 | Fișierele vechi din repo mutate în `detailing/` |
| `fd9fdc7` | 07.09 | Comportament corect pe găzduire statică |
| `7599b17` | 07.09 | `CNAME` — domeniul propriu |
| `a16a28f` | 10.09 | Etichetele glisorului aliniate + salariul net |
| `41a39bf` | 22.09 | Girant opțional, recomandat automat peste prag |
| `6ce1b14` | 22.09 | Datele pregătite pentru completarea contractului-cadru |
| `8bcf84b` | 22.09 | E-mail girant, semnături scoase din PDF, două atenționări |
| `1b9baaf` | 22.09 | Mesaj de eroare corect + servire pe Pages |
| `ae4b16a` | 22.09 | „Salariu net de bază" + antetul paginilor următoare |
| `70b9bac` | 23.09 | Toate datele pe care le tipărește contractul |
| `190730f` | 16.10 | Datele de pe buletin nu mai pierd o zi |

---

## 4. Deciziile luate și motivul fiecăreia

### 4.1 Formula ratei — anuitate clasică

```
R = P · i / (1 − (1 + i)^−n)        i = 0,12 / 12 = 0,01
```

Rezultatele se potrivesc exact cu tabelul din caietul de sarcini la **6, 12 și 24
de luni**. La **18 luni** tabelul din caiet dădea altceva. Întrebat ce fac,
răspunsul a fost „Cum vrei tu", așa că am **păstrat formula** și am lăsat tabelul
să se recalculeze din ea. Motivul: o formulă corectă care dă un rând diferit e
preferabilă unei excepții codate manual, care ar fi trebuit întreținută la fiecare
schimbare de dobândă.

### 4.2 Girantul — opțional, dar recomandat de sistem

Secțiune pliabilă (`<details>`) la finalul formularului. **Deschisă = cerere cu
girant.** Închisă = fără girant, iar câmpurile din ea nu se trimit deloc.

Când rata depășește **o treime din salariul net** (`COMFORT_RATIO = 1/3`),
secțiunea se colorează, textul devine „Sistemul recomandă un girant pentru această
cerere" și se deschide singură — o singură dată, ca să nu lupte cu utilizatorul
care a închis-o intenționat.

Pragul **nu blochează** depunerea cererii. Decizia de acordare aparține comisiei
C.A.R., nu formularului.

### 4.3 Nimeni nu poate gira pentru sine

Dacă CNP-ul girantului este identic cu al solicitantului, cererea se oprește cu
mesaj explicit pe câmpul CNP.

### 4.4 Documentul nu se semnează

Inițial PDF-ul avea casete de semnătură. Au fost **scoase complet**, pentru că
documentul este fișa de date din care societatea pregătește contractul, nu
contractul însuși. În locul lor, o casetă care spune răspicat:

> **ACEST DOCUMENT NU SE SEMNEAZĂ**
> Este fișa de date depusă online la [data], din care Sanitas CAR pregătește
> contractul. Contractul se semnează electronic, cu semnătură calificată și
> identificare video, de către titular, girant și Sanitas CAR.

Altfel cineva l-ar fi printat și semnat degeaba.

### 4.5 Două atenționări, în două momente diferite

| Când | Ce spune |
|---|---|
| La primul clic într-un câmp din buletin | Ce acte să-ți pregătești: CI (cu ambele date și emitentul), datele de la locul de muncă, IBAN-ul, salariul de bază |
| La apăsarea pe „Trimite" | Recapitulare a datelor introduse + „Da, sunt corecte" / „Mă întorc să verific" |

A doua nu este un simplu „ești sigur?" — arată efectiv numele, CNP-ul, IBAN-ul,
e-mailul, locul de muncă, suma și rata, ca omul să **vadă** ce confirmă.

### 4.6 „Salariu net de bază", nu „ultimul fluturaș"

Formularea inițială cerea venitul „exact cum îl încasezi". Problema semnalată:
personalul medical are sporuri care diferă de la lună la lună, deci întrebarea
**nu are un răspuns stabil** — doi oameni cu același contract ar fi răspuns
diferit în funcție de luna completării. Iar din cifra aceea se calculează gradul
de îndatorare.

Peste tot acum se cere **salariul net de bază**: suma fixă din contract, fără
sporuri și fără ore suplimentare. S-a adăugat și „Nu trebuie să fie exactă la
leu", ca omul să nu se blocheze căutând documente.

### 4.7 Nu cerem ce putem deduce

| Dedus | Din ce |
|---|---|
| Data nașterii | Din CNP — e deja codificată acolo, cifră cu cifră |
| Sumele în litere | Generate de `numbers-ro.js` |
| Suma garantată de girant | Este suma împrumutului |
| Numele și adresa debitorului din Anexa 1 | Din secțiunea solicitantului |
| Data cererii | Ziua depunerii |

Raționamentul pentru data nașterii: dacă o cer separat, creez o **a doua sursă de
adevăr** care poate contrazice CNP-ul — și atunci cineva trebuie să decidă care e
bună. Din formular se cere doar localitatea nașterii.

### 4.8 Sumele în litere, generate corect

Contractul cere fiecare sumă și în cuvinte. Scrisă de mână, la ora 17:00, e exact
genul de greșeală care întoarce un contract. Regulile de acord ale limbii române
nu sunt banale:

```
      1  →  un leu
      2  →  doi lei                    (masculin)
     12  →  doisprezece lei
    101  →  o sută unu lei             (fără „de")
    120  →  o sută douăzeci de lei     (cu „de")
  3.500  →  trei mii cinci sute de lei
 12.000  →  douăsprezece mii de lei    (feminin înaintea lui „mii")
 20.000  →  douăzeci de mii de lei
3.198,60 →  trei mii o sută nouăzeci și opt de lei și șaizeci de bani
```

Regula pentru „de": se pune când ultimele două cifre sunt **00 sau între 20 și
99**. Genul se schimbă după substantiv: „două **mii**" (feminin), dar „doi
**lei**" (masculin).

### 4.9 Fără poză de buletin — recomandarea mea

Întrebat dacă formularul ar trebui să ceară și o fotografie a CI pentru
verificare, am recomandat **să începeți fără ea**:

- Verificarea cu valoare juridică este **identificarea video acreditată** din
  procesul de semnare, nu o poză trimisă printr-un formular web.
- Stocarea de scanuri de acte de identitate este prelucrare de date cu risc
  ridicat sub GDPR și aduce obligații pe care nu le aveți acum.

Dacă în practică apar greșeli de transcriere, varianta mai sigură este o poză
trimisă **doar pe e-mail, niciodată stocată** de platformă.

### 4.10 PDF pe două pagini

După adăugarea tuturor rubricilor din contract, documentul nu mai încape pe o
pagină. Compactarea ar fi cerut ~48 mm recuperați, adică un document înghesuit și
mai greu de citit — iar cu nume și denumiri de spital lungi ar fi depășit oricum.

Decizia: **se acceptă două pagini**, dar blocul de declarații se mută **întreg** pe
pagina următoare, ca să nu rămână un paragraf orfan. Pagina 1 = datele, pagina 2 =
declarațiile și spațiul rezervat. Așa se citește ca o structură intenționată, nu ca
o scăpare de paginare.

---

## 5. Ce colectează formularul

**21 de câmpuri pentru solicitant, 21 pentru girant.** Fiecare există pentru că
îl tipărește contractul-cadru sau Anexa 1.

### Solicitant

| Secțiune | Câmpuri |
|---|---|
| **A. Identificare** | nume și prenume, serie CI, număr CI, data eliberării, data expirării, eliberat de, CNP, locul nașterii |
| **B. Domiciliu** | județ, localitate, stradă, număr / bloc / ap. |
| **C. Loc de muncă** | unitatea angajatoare, sediul unității, funcția, secția*, marca* |
| **D. Contact și bancar** | IBAN, e-mail, telefon |
| **E. Venit** | salariu net de bază |

### Girant (secțiune pliabilă)

Aceleași rubrici, plus **calitatea față de solicitant** (coleg, soț/soție, rudă
gr. I, rudă gr. II, prieten, altă situație) și propria adresă de e-mail — pentru
că girantul semnează și el contractul electronic, deci are nevoie să-l primească.

\* opțional

### De unde vin câmpurile adăugate în septembrie

Comparate rubrică cu rubrică cu **Anexa 1 — Angajament girant (fideiusor)**:

| Rubrica din Anexa 1 | Aveam? |
|---|---|
| Nume, CNP, serie și număr CI, telefon | da |
| eliberat la data de ___ de ___ | **nu** → adăugat |
| născut în localitatea ___ județul ___ | **nu** → adăugat (data din CNP) |
| încadrat în unitatea ___ | **nu** → adăugat |
| secția ___ marca ___ | **nu** → adăugat |
| cu sediul în str. ___ nr. ___ | **nu** → adăugat |
| în funcție de ___ | **nu** → adăugat |
| domiciliat str./nr./bl./sc./ap. | doar text liber → defalcat |
| venit lunar net ___ lei (___) | cifra da, litera **nu** → generată |
| suma garantată ___ lei (___) | **nu** → dedusă din împrumut |

---

## 6. Validările

| Câmp | Regula |
|---|---|
| Nume și prenume | minim 3 caractere, minim două cuvinte |
| Serie buletin | 2 litere mari, normalizate automat |
| Număr buletin | exact 6 cifre |
| Data eliberării | în trecut, după 1990 |
| Data expirării | în viitor — actele expirate se resping |
| Eliberat de | text liber, minim 3 caractere |
| **CNP** | 13 cifre + **cifra de control** (cheia `279146358279`, mod 11, 10→1), secolul din prima cifră, data nașterii trebuie să existe, codul de județ 1–52 sau 70 |
| **IBAN** | 24 de caractere, începe cu RO, **control mod-97** (primele 4 mutate la final, literele devin cifre A=10…Z=35, restul trebuie să fie 1), afișat grupat `RO49 AAAA …` |
| E-mail | format valid |
| Telefon | 10 cifre, acceptă și `+40…` și îl normalizează |
| Salariu net de bază | între 100 și 100.000 lei; acceptă `3500`, `3.500`, `3 500` |
| Unitate, sediu, funcție | obligatorii; secția și marca opționale |
| Acord GDPR | obligatoriu |
| CNP girant | în plus: trebuie să difere de al solicitantului |

Câmpul devine **verde** la confirmare, **roșu cu mesaj explicativ** la eroare.

**Aceleași validări rulează și pe server.** Cele din browser sunt pentru confortul
utilizatorului; cele din `server/index.js` sunt cele care decid. Termenii
împrumutului se **recalculează** pe server — nu se preiau niciodată de la client.

---

## 7. Documentul PDF

Construit în browser cu **jsPDF 2.5.2**, servit local din `assets/vendor/`.

**Diacriticele** cer un font propriu: fonturile standard PDF folosesc codificarea
WinAnsi, care nu are ă, â, î, ș, ț. Soluția: un subset de Liberation Sans redus la
alfabetul latin plus codepoint-urile românești, încorporat în base64 în
`assets/js/pdf-assets.js`.

### Structura documentului

```
Pagina 1
  antet cu logo, denumire, contact
  nr. înregistrare CAR/AAAALLZZ/HHMMSS   ·   data emiterii
  CERERE DE ÎNSCRIERE ȘI ACORDARE ÎMPRUMUT — FOND SANITAS CAR
  A. DATE DE IDENTIFICARE MEMBRU
  B. LOC DE MUNCĂ
  C. TERMENII ÎMPRUMUTULUI SOLICITAT        (rata lunară evidențiată)
  D. GIRANT                                  (doar dacă există)
       rubricile în ordinea din Anexa 1
       „Sumă garantată solidar" evidențiată, cifră și literă
       declarația de fideiusor solidar, art. 2300 Cod Civil

Pagina 2
  E. DECLARAȚII ȘI CONSIMȚĂMÂNT              (bloc indivizibil)
  caseta „ACEST DOCUMENT NU SE SEMNEAZĂ"
  caseta „SPAȚIU REZERVAT SANITAS CAR"
  antet redus + „Pagina N din M" pe fiecare pagină
```

Paginarea este dinamică: fiecare bloc verifică singur dacă mai încape și, când nu,
deschide pagină nouă cu antet redus. Numerotarea se aplică la final, când se știe
totalul.

**Verificat** pe patru scenarii — cu și fără girant, cu date normale și cu nume,
adrese și denumiri de spital foarte lungi. Niciunul nu depășește.

---

## 8. Ce primește societatea

Trei atașamente, la fiecare cerere:

**1. E-mail cu subiect care spune ce șablon se deschide**

```
[Cerere nouă · CU GIRANT] Popescu Maria-Elena — 3.000,00 lei / 12 luni — CAR/.../...
```

sau `[Cerere nouă · FĂRĂ GIRANT]`. Corpul conține toate datele în text, cu sumele
și în litere, și un marcaj `<-- peste o treime din venit` acolo unde e cazul.

**2. Cererea în PDF**, ca document de referință.

**3. `Date_Sanitas_CAR_[Nume].json`** — aceleași date, structurate, pentru
completarea automată a contractului. Chei în română, stabile, în ordinea
rubricilor din contract:

```json
{
  "contractCadru": "CU GIRANT",
  "solicitant": {
    "numeComplet": "…", "cnp": "…", "loculNasterii": "…",
    "serieCI": "…", "numarCI": "…",
    "dataEliberariiCI": "…", "eliberatDe": "…", "valabilitateCI": "…",
    "judet": "…", "localitate": "…", "strada": "…", "numarStrada": "…",
    "telefon": "…", "email": "…", "iban": "…",
    "unitatea": "…", "sediulUnitatii": "…", "functia": "…",
    "sectia": "…", "marca": "…",
    "salariuNetDeBaza": 3500,
    "salariuNetDeBazaInLitere": "trei mii cinci sute de lei"
  },
  "imprumut": {
    "suma": 3000, "sumaInLitere": "trei mii de lei",
    "luni": 12, "dobandaAnualaPct": 12,
    "rataLunara": 266.55, "totalDeRambursat": 3198.6,
    "costTotal": 198.6, "rataInVenitPct": 7.6
  },
  "girant": { "…": "…", "sumaGarantata": 3000,
              "sumaGarantataInLitere": "trei mii de lei" },
  "semnatari": [
    { "rol": "Titular",     "nume": "…", "email": "…", "telefon": "…" },
    { "rol": "Girant",      "nume": "…", "email": "…", "telefon": "…" },
    { "rol": "Sanitas CAR", "nume": "…", "email": null, "telefon": null }
  ]
}
```

Lista `semnatari` este exact ce cere aplicația de semnare electronică: **trei
semnatari** la contract cu girant, **doi** fără.

Retastarea unui CNP sau a unui IBAN este exact locul în care apar greșelile care
invalidează un contract — de aceea datele ajung structurate, nu doar tipărite.

---

## 9. Infrastructura — domeniul și publicarea

### 9.1 Autentificarea Git

Prima problemă: *„password authentication is not supported for git operations"*.
GitHub a eliminat autentificarea cu parolă. Rezolvat cu **cheie SSH**: generată cu
`ssh-keygen`, cheia **publică** (`~/.ssh/id_ed25519.pub`, cea cu `.pub`) adăugată
în GitHub → Settings → SSH and GPG keys.

### 9.2 Curățenia în repo

Cele 12 fișiere care existau deja în repozitoriu (logo-uri și poze de detailing) au
fost mutate cu `git mv` în folderul `detailing/`, ca rădăcina să rămână a
proiectului nou. Istoricul lor s-a păstrat.

### 9.3 Domeniul propriu — diagnosticul DNS

GitHub Pages refuza `sanitas.husanudaniel.ro` cu „DNS check unsuccessful".
Diagnosticul, pas cu pas:

1. **Interogare directă a serverelor** registrului `.ro` (ROTLD): toate șase
   răspundeau **SERVFAIL** pentru `husanudaniel.ro`, dar răspundeau corect pentru
   domenii de control. Deci problema era la delegare, nu la configurație.
2. **Serverele Hostlayer** (`ns1-4.layer.ro`) **nu aveau zona** pentru domeniu.
3. **DNSSEC exclus** — interogare cu flagul `CD=1` (checking disabled) dădea
   același rezultat, deci nu era o eroare de validare criptografică.
4. După apăsarea butonului **„Modificare nameservere"** din Hostlayer, delegarea
   s-a propagat (`ns4.layer.ro`).
5. A apărut a doua problemă: un **wildcard** `*.husanudaniel.ro A 185.151.30.222`
   ducea `sanitas` la Hostlayer. Un **CNAME specific are prioritate** față de
   wildcard, deci soluția a fost o înregistrare explicită.
6. Final confirmat: `sanitas.husanudaniel.ro CNAME daniad24.github.io` →
   `185.199.108.153`.

### 9.4 Capcana fișierului CNAME

GitHub a comis singur un fișier `CNAME` în branch-ul de publicare. Efectul: adresa
`daniad24.github.io` redirecta către domeniul care încă nu funcționa — deci
**ambele** adrese păreau stricate în același timp. Util de știut: fișierul e
normal, dar face adresa veche inutilizabilă cât timp domeniul nou nu merge.

### 9.5 `.nojekyll`

Fișier gol în rădăcină. Oprește pipeline-ul Jekyll al GitHub Pages, care altfel
poate exclude din publicare fișiere și foldere după reguli proprii.

---

## 10. Erorile găsite și reparate

Lista completă, cu **cauza reală**, nu doar simptomul.

| # | Simptom | Cauza | Reparație |
|---|---|---|---|
| 1 | Fereastra modală mereu vizibilă | `.modal{display:flex}` scris de autor bate regula `[hidden]{display:none}` a browserului | `.modal[hidden]{display:none}` |
| 2 | jsPDF nu se încărca | CDN-ul cdnjs blocat de proxy | jsPDF adus local în `assets/vendor/` |
| 3 | 33 px de derulare laterală pe telefon | În CSS grid, `1fr` înseamnă `minmax(auto,1fr)` și respectă `min-content`; `input[type=date]` lățea coloana | `minmax(0,1fr)` + `.form-field{min-width:0}` |
| 4 | Butonul de trimitere ieșea din card | `white-space: nowrap` pe `.btn` | `white-space: normal; min-width: 0` |
| 5 | PDF-ul depășea pagina (de două ori) | Rânduri adăugate fără recalcularea rezervei | Rânduri și casete compactate |
| 6 | „nr. nr. 1218" | Se adăuga „nr." chiar dacă omul îl scrisese deja | Test `/^nr\b\.?/i` |
| 7 | Antetul pe trei rânduri pe telefon | Subtitlul nu încăpea | `@media (max-width: 560px)` ascunde subtitlul |
| 8 | Etichetele glisorului toate la 141 px | `--thumb` era declarat pe `input[type=range]`, dar etichetele sunt **frați**, nu descendenți — `var(--thumb)` nu se rezolva și `calc()` devenea invalid | `--thumb` mutat în `:root` |
| 9 | Logo-ul intra în linia roșie pe pagina 2 | Înălțimea logo-ului scrisă de mână, nu din raportul real al imaginii (478×522) | Înălțime = lățime × 1,092 |
| 10 | „Biblioteca jsPDF nu a putut fi încărcată" | Preview-ul încărca jsPDF de pe cdnjs, deși site-ul îl avea local | jsPDF încorporat în preview; mesajul rescris să nu mai dea vina pe conexiune |
| 11 | Câmpuri noi nu ajungeau la server | Lista câmpurilor trimise era scrisă de mână | Se compune din chiar lista de câmpuri validate |
| 12 | „Act valabil până la **13**.08.2031" pentru 14.08.2031 | Data citită ca miezul nopții **locale**, formatată în **UTC**; România e la est de Greenwich, deci ziua aluneca înapoi | Datele se țin la miezul nopții UTC, ca data din CNP |

### Despre eroarea 12

Nu se vedea în teste pentru că serverul rulează pe UTC. Se vedea la **fiecare
utilizator real din România.** Găsită întâmplător, în timp ce făceam capturile
pentru imaginile de prezentare.

Verificată după reparație în patru fusuri orare, inclusiv cazul limită „actul
expiră chiar azi":

```
Europe/Bucharest   14.08.2031   azi acceptat: true
UTC                14.08.2031   azi acceptat: true
America/Sao_Paulo  14.08.2031   azi acceptat: true
Pacific/Kiritimati 14.08.2031   azi acceptat: true
```

### Cum au fost testate

- **Playwright + Chromium** pentru fluxul real în browser, pe telefon și desktop
- **pdftoppm / pdf.js** pentru randarea PDF-ului în imagini și verificare vizuală
- Decupaje la **17 px/mm** pentru măsurarea exactă a antetului
- Alinierea etichetelor glisorului măsurată numeric — potrivire sub 0,01 px
- Încadrarea PDF-ului testată pe patru scenarii
- Preview-ul testat **cu toate cererile de rețea blocate**, ca să dovedesc că e
  complet autonom

---

## 11. Structura fișierelor

```
index.html                  pagina completă (hero, simulator, tabel, formular, modale)
assets/
  css/styles.css            stilurile paginii
  js/loan-math.js           calculul anuității (folosit și de server)
  js/numbers-ro.js          sumele scrise în litere
  js/validation.js          validări CNP, IBAN, CI, e-mail, telefon
  js/pdf-doc.js             construcția documentului PDF oficial
  js/pdf-assets.js          fontul cu diacritice + logo-ul, în base64
  js/app.js                 logica paginii (simulator, formular, trimitere)
  vendor/jspdf.umd.min.js   jsPDF servit local, fără dependență de CDN
  fonts/                    subsetul Liberation Sans cu diacritice
  img/                      logo-urile Sanitas
server/
  index.js                  Express: re-validare + trimitere e-mail
  .env.example              șablonul de configurare SMTP
detailing/                  fișierele vechi din repo, mutate aici
CNAME                       sanitas.husanudaniel.ro
.nojekyll                   oprește pipeline-ul Jekyll pe GitHub Pages
README.md                   manualul tehnic
PROIECT.md                  documentul de față
```

Aproximativ **5.100 de linii**, din care 1.346 sunt fontul în base64.

---

## 12. Cum îl pornești

### Doar ca să vezi pagina

```bash
cd Testdetailing
python3 -m http.server 3000
# deschide http://localhost:3000
```

Simulatorul, validările și generarea PDF-ului funcționează complet. Doar
trimiterea pe e-mail are nevoie de server.

### Cu trimitere pe e-mail

```bash
cd server
npm install
cp .env.example .env     # completează datele SMTP și CAR_INBOX
node index.js
# http://localhost:3000
```

Pentru probe fără e-mailuri reale:

```bash
DRY_RUN=1 node index.js   # cererile se salvează în server/cereri/
```

---

## 13. Imaginile de prezentare pentru portofoliu

Trei formate, generate pe 16 octombrie din **capturi reale ale aplicației**, nu din
mockup-uri desenate:

| Format | Dimensiune | Destinație |
|---|---|---|
| 16:10 | 1920 × 1200 | cardul de proiect din portofoliu |
| Pătrat | 1080 × 1080 | Instagram, LinkedIn |
| 9:16 | 1080 × 1920 | story |

Conțin simulatorul cu rata de 266,55 lei, recapitularea cu „rata din salariul net
7,6%" și prima pagină a PDF-ului generat. Fundal închis, ca ecranele deschise ale
aplicației să iasă în față; roșul e cel din logo.

⚠️ **Imaginile nu sunt în repozitoriu.** Au fost livrate direct în conversație.
Dacă se schimbă ceva în aplicație, se pot regenera.

---

## 14. Ce a rămas deschis

### Decizii de luat

| Subiect | Starea |
|---|---|
| **Poza de buletin** | Recomandarea mea: începeți fără ea (vezi 4.9). Fără răspuns. |
| **Caseta „SPAȚIU REZERVAT SANITAS CAR"** | Aprobat/Respins, nr. hotărâre, semnătură și ștampilă. Păstrată ca spațiu intern al comisiei. Mai are sens în fluxul electronic? |
| **Pragul pentru girant** | La ce raport cere comisia girant în practică? Acum e o treime, orientativ. |
| **Girantul trebuie să fie membru CAR?** | Dacă da, se adaugă „Nr. carnet de membru". |

### Pentru cererea fără girant — analiza din 28 septembrie

Fără girant, **singura garanție e venitul clientului**, iar despre el întrebăm un
singur număr. Lipsesc, în ordinea importanței:

1. **Cum se plătește rata** — reținere pe statul de plată sau plată directă. Nu e
   un câmp, e o clauză de contract pe care nu o avem deloc. Reținerea pe stat e
   cea mai puternică garanție fără girant: banii nu ajung la client. (Asta
   justifică și de ce se cer secția și marca — fără ele, salarizarea nu are pe
   cine să caute.)
2. **Stabilitatea locului de muncă** — contract pe perioadă nedeterminată sau
   determinată și până când, plus vechimea. Un împrumut pe 24 de luni dat cuiva cu
   contract care expiră în 6 e alt risc.
3. **Ce mai are de plată** — împrumut în derulare la CAR, girant pentru altcineva,
   rate la bănci. Plăcuța care scrie „rata ta e 7,6% din salariu" este **falsă**
   dacă omul are deja 40% angajat.
4. **Fondul social și calitatea de membru** — la un CAR suma se acordă în raport
   cu fondul acumulat. Nr. carnet dacă e membru; acordul de cotizație dacă e nou.
5. **Beneficiarul în caz de deces** — statutele CAR cer de regulă persoana
   desemnată să încaseze fondul social.

Ce **nu** aș adăuga: starea civilă și scopul împrumutului. Nu schimbă nicio
decizie și lungesc formularul degeaba.

Punctele 2 și 3 sunt aceleași la orice CAR și pot fi făcute oricând. Punctele 1, 4
și 5 depind de statutul Sanitas CAR. **Cel mai rapid mod de a le rezolva: trimite
contractul de împrumut fără girant, așa cum ai trimis Anexa 1.**

### Două lucruri tehnice de făcut

1. **Merge în `main`.** Modificările sunt pe `claude/project-pdf-logo-k06v0k` și
   nu ajung pe site până la merge:
   https://github.com/daniad24/Testdetailing/compare/main...claude/project-pdf-logo-k06v0k

2. **Mută sursa GitHub Pages pe `main`.** Acum publică din branch-ul de lucru —
   dacă branch-ul e șters vreodată, **site-ul moare**.

---

## 15. Unde se schimbă lucrurile

| Vrei să schimbi | Fișier |
|---|---|
| Sumele, perioada maximă, dobânda | `assets/js/loan-math.js` |
| Pragul de îndatorare (`COMFORT_RATIO`) | `assets/js/loan-math.js` |
| Textele formularului | `index.html` |
| Mesajele de validare | `assets/js/validation.js` |
| Datele de contact din antetul PDF | obiectul `ORG` din `assets/js/pdf-doc.js` |
| Textele declarațiilor din PDF | secțiunea „DECLARAȚII" din `assets/js/pdf-doc.js` |
| Regulile de acord pentru sumele în litere | `assets/js/numbers-ro.js` |
| Adresa de e-mail a societății | `CAR_INBOX` în `server/.env` |
