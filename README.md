# Sanitas CAR — Landing Page & Simulator de Împrumut

Platformă web pentru Casa de Ajutor Reciproc Sanitas București, realizată după
caietul de sarcini „Platformă Web & Simulator Credite: Sanitas CAR”.

Include simulator interactiv, formular cu validare în timp real, generarea
automată a cererii oficiale în PDF și trimiterea ei pe e-mail.

---

## Cum îl pornești

### Varianta rapidă (doar ca să vezi pagina)

Deschide `index.html` direct în browser (dublu-click). Funcționează tot:
simulatorul, validările, generarea și descărcarea PDF-ului. Singurul lucru care
nu merge fără server este **trimiterea automată pe e-mail** — în acest caz
pagina îți spune clar asta și îți oferă PDF-ul la descărcare.

### Varianta completă (cu trimitere pe e-mail)

```bash
cd server
npm install
cp .env.example .env      # completează datele SMTP
npm start
```

Apoi deschide <http://localhost:3000>.

Pentru a testa fluxul fără SMTP configurat, pune `DRY_RUN=1` în `server/.env`:
cererile se salvează în `server/cereri/` (PDF + JSON) în loc să fie trimise.

---

## Cum îl pui online

### Link public, fără server (GitHub Pages)

Depozitul conține un fișier `.nojekyll`. Fără el, GitHub Pages trece site-ul
prin Jekyll, care aplică propriile reguli de excludere a fișierelor — un motiv
obișnuit pentru care un fișier existent în depozit ajunge să dea 404 pe site.

Pagina generează PDF-ul direct în browser, deci o găzduire statică e suficientă
pentru tot, mai puțin trimiterea automată pe e-mail.

În depozit: **Settings → Pages**, la *Source* alegi `Deploy from a branch`,
apoi branch-ul dorit și folderul `/ (root)`. După un minut pagina e la
`https://<utilizator>.github.io/<depozit>/`.

Pe o astfel de găzduire, la trimiterea cererii pagina generează documentul și
anunță clar că expedierea automată nu este activă, oferindu-l la descărcare.
Nu e nevoie de nicio modificare în cod — căile sunt relative, deci funcționează
și dintr-un subfolder.

### Link public, cu trimitere pe e-mail

Aici e nevoie de o găzduire care rulează Node (Render, Railway, Fly.io, un VPS).
Se pornește `server/index.js`, cu variabilele din `.env` setate în panoul
găzduirii. Serverul servește și pagina, deci nu ai nevoie de două găzduiri.

Dacă pagina stă pe o altă adresă decât serverul, îi spui unde e endpoint-ul,
printr-o singură linie în `<head>`:

```html
<meta name="sanitas-api" content="https://api.exemplu.ro/api/cerere">
```

În acest caz, adaugă și CORS pe server pentru domeniul paginii.

---

## Structura proiectului

```
index.html                  pagina completă (hero, simulator, tabel, formular)
assets/
  css/styles.css            stilurile paginii
  js/loan-math.js           calculul anuității (folosit și de server)
  js/validation.js          validări CNP, IBAN, CI, e-mail, telefon
  js/pdf-doc.js             construcția documentului PDF oficial
  js/pdf-assets.js          fontul cu diacritice + logo-ul, în base64
  js/app.js                 logica paginii (simulator, formular, trimitere)
  vendor/jspdf.umd.min.js   jsPDF servit local (fără dependență de CDN)
.nojekyll                   oprește pipeline-ul Jekyll pe GitHub Pages, ca
                            fișierele să fie servite exact cum sunt în depozit
  img/logo-sanitas.png      logo-ul Sanitas, folosit în pagină și în PDF
  fonts/                    fonturile decupate (sursa pentru pdf-assets.js)
server/
  index.js                  serverul: servește pagina + POST /api/cerere
  .env.example              configurarea SMTP
detailing/                  fișierele care erau în depozit înainte de acest
                            proiect (logo și poze de detailing), mutate aici
                            ca să rămână rădăcina curată
```

---

## Ce face fiecare parte

### 1. Simulatorul

- 5 butoane rapide de sumă: 1.000 / 2.000 / 3.000 / 4.000 / 5.000 lei
- glisor pentru perioadă, între **1 și 24 de luni**, cu marcaje la 6, 12, 18, 24

  Etichetele de sub glisor sunt poziționate din JS (`positionFor()` în `app.js`),
  nu întinse uniform: centrul butonului nu ajunge la marginile barei, ci pleacă de
  la jumătate de buton și se oprește cu jumătate înainte de capăt. Aceeași formulă
  poziționează și umplerea barei, deci eticheta „6” stă exact sub locul în care
  glisorul arată 6 luni.
- dobândă fixă **12% pe an**, anuitate cu rate lunare egale:

  ```
  R = P · i / (1 − (1 + i)^−n)          i = 0,12 / 12 = 0,01
  ```

- rata, totalul de rambursat și costul creditului se recalculează live, fără
  reîncărcarea paginii
- rândul corespunzător din tabelul de referință se evidențiază automat

### 2. Validările formularului

| Câmp | Regulă |
|---|---|
| Nume și prenume | minim 3 caractere, minim două cuvinte |
| Serie buletin | 2 litere mari (se normalizează automat) |
| Număr buletin | exact 6 cifre |
| Expirare buletin | data trebuie să fie în viitor — actele expirate se resping |
| CNP | 13 cifre + **cifra de control** (cheia `279146358279`), data nașterii și codul de județ verificate |
| IBAN | 24 de caractere, începe cu RO, **control mod-97**, afișat grupat `RO49 AAAA …` |
| E-mail | format valid |
| Telefon | 10 cifre (acceptă și `+40…`, îl normalizează) |
| Salariu net de bază | între 100 și 100.000 lei; acceptă `3500`, `3.500`, `3 500` |
| Câmpurile girantului | aceleași reguli ca la solicitant, inclusiv e-mail, dar **doar când secțiunea e deschisă**; CNP-ul trebuie să difere de al solicitantului |
| Acord GDPR | obligatoriu |

Câmpul devine verde la confirmare și roșu cu mesaj explicativ la eroare.
Aceleași validări rulează și pe server — cele din browser sunt pentru confortul
utilizatorului, cele din `server/index.js` sunt cele care decid.

### 3. Venitul și gradul de îndatorare

Solicitantul își trece **salariul net de bază** — suma fixă din contract, fără
sporuri. În sistemul sanitar sporurile diferă de la lună la lună, deci „cât
încasezi” ar fi o întrebare fără un răspuns stabil; baza e o valoare pe care
oricine o știe. Pagina arată imediat ce parte din ea ia rata: procentul, o bară
colorată și un mesaj explicativ. Valoarea se
actualizează și când se schimbă suma sau perioada din simulator.

Pragul orientativ este **o treime din venitul net** (`COMFORT_RATIO` în
`assets/js/loan-math.js`). Peste el, mesajul devine roșu și sugerează o sumă mai
mică sau o perioadă mai lungă — dar **nu blochează depunerea cererii**, pentru că
decizia de acordare aparține comisiei C.A.R. Raportul apare în documentul PDF și
în e-mailul către sediu, unde e marcat explicit când depășește pragul.

Ca și termenii împrumutului, raportul se recalculează pe server; valoarea trimisă
de client nu este preluată ca atare.

### 4. Girantul (opțional)

Secțiunea de girant e pliabilă și stă la finalul formularului, după datele
solicitantului. **Starea ei decide totul**: deschisă înseamnă „depun cererea cu
girant”, iar câmpurile devin obligatorii; închisă înseamnă fără girant, iar ce e
scris acolo nu se trimite și nu blochează depunerea.

Sistemul îl **recomandă** — antet roșu și secțiune deschisă automat — când rata
depășește pragul de confort din venitul solicitantului, adică același
`COMFORT_RATIO`. Dacă utilizatorul o închide la loc, nu i se mai redeschide
singură.

Datele cerute: nume, CNP, serie și număr CI, adresă, telefon, **e-mail**,
calitatea față de solicitant (listă derulantă) și venitul net. E-mailul e
obligatoriu pentru că girantul semnează contractul electronic ca semnatar
distinct, deci aplicația de semnare trebuie să îl poată contacta. Ultimul e folosit ca să arate ce
parte din rată ar acoperi girantul, dacă ar ajunge să plătească el.

Girantul nu poate avea același CNP ca solicitantul — nimeni nu girează pentru
sine. Verificarea rulează și în pagină, și pe server.

> Datele și pragul de mai sus sunt o propunere de pornire, nu o regulă preluată
> din statut. Înainte de punerea în producție, ele trebuie confirmate de comisia
> Sanitas CAR; se modifică din `GUARANTOR_FIELDS` (`assets/js/app.js`) și
> `COMFORT_RATIO` (`assets/js/loan-math.js`).

### 5. Documentul PDF

Generat cu jsPDF, A4, cu:

- logo-ul Sanitas, antetul organizației, **număr de înregistrare** și dată emitere
- secțiunea A — date de identificare membru (nume, CNP, CI, adresă, contact, IBAN)
- secțiunea B — termenii împrumutului (sumă, perioadă, dobândă, rată, total,
  venit net declarat și rata raportată la el)
- secțiunea C — declarații și consimțământ GDPR
- secțiunea de girant și angajamentul lui de garanție, când cererea are girant
- o notă explicită că **documentul nu se semnează**: e fișa de date din care
  societatea pregătește contractul, iar semnarea are loc ulterior, electronic
- casetă rezervată aprobării CAR
- diacritice românești corecte (font propriu decupat, inclus în `pdf-assets.js`)

Numele fișierului: `Cerere_Sanitas_CAR_[Nume].pdf`

Layoutul curge pe câte pagini are nevoie: fiecare bloc verifică întâi dacă mai
încape, iar când nu, deschide o pagină nouă cu antet redus. Numerotarea
(„Pagina 1 din 2”) se aplică la final, când se știe totalul. O cerere fără girant
rămâne pe o pagină; una cu girant ocupă două.

### 6. Cele două atenționări

**La început.** Când utilizatorul atinge primul câmp din actul de identitate, o
fereastră îi spune ce să pregătească: cartea de identitate, IBAN-ul și salariul
net de bază. Apare o singură dată pe sesiune, ca să nu devină obositoare.

**Înainte de trimitere.** Butonul de trimitere nu mai trimite direct: deschide o
recapitulare a datelor care ajung în contract — nume, CNP, CI, IBAN, e-mail,
telefon, termenii împrumutului și girantul, dacă există. Utilizatorul confirmă cu
*„Da, datele sunt corecte”* sau se întoarce cu *„Nu, mai verific o dată”*.

E o recapitulare, nu un simplu „ești sigur?”: întrebarea abstractă primește
întotdeauna „da”, pe când datele afișate alături de acte chiar se verifică.

### 7. Ce primește societatea

Pagina este **formularul din care se pregătește contractul**, nu contractul în
sine. Documentul PDF generat este cererea semnată de solicitant; contractul
propriu-zis se completează de societate, dintr-unul din cele două contracte-cadru.

De aceea e-mailul administrativ conține trei lucruri:

1. **Tipul de contract-cadru**, chiar în subiect: `[Cerere nouă · CU GIRANT]`
   sau `[Cerere nouă · FĂRĂ GIRANT]` — se știe din subiect ce șablon se deschide.
2. **Cererea în PDF**, ca document de referință.
3. **`Date_Sanitas_CAR_[Nume].json`** — aceleași date, structurate, pentru
   completarea automată a contractului. Retastarea unui CNP sau a unui IBAN este
   exact locul în care apar greșelile care invalidează un contract.

Cheile din JSON sunt în română și stabile (`solicitant.cnp`, `imprumut.rataLunara`,
`girant.numeComplet`…), ca să poată fi legate direct la câmpurile din șablon.

Fișierul conține și lista `semnatari`, cu rolul, numele, e-mailul și telefonul
fiecăruia — exact ce cere aplicația de semnare electronică: **trei semnatari** la
un contract cu girant (titular, girant, Sanitas CAR) și **doi** fără.

### 8. Fluxul de trimitere

1. Utilizatorul alege suma și perioada din simulator
2. Completează formularul; CNP-ul și IBAN-ul se validează la tastare
3. Apasă **Trimite cererea**
4. PDF-ul se generează instant în browser
5. Serverul îl trimite pe e-mailul solicitantului **și** în inbox-ul
   administrativ (`CAR_INBOX`), apoi pagina afișează documentul pentru
   verificare și descărcare

Butonul **Doar previzualizează PDF-ul** generează documentul fără să trimită
nimic — util pentru verificare înainte de depunere.

---

## Observație despre tabelul din caietul de sarcini

Coloana **„Rată / 18 luni”** din documentul primit diferă cu câțiva bani de
formula de anuitate:

| Sumă | 6 luni | 12 luni | 18 luni | 24 luni |
|---|---|---|---|---|
| Caiet de sarcini | 172,55 | 88,85 | **61,00** | 47,07 |
| Formula de anuitate | 172,55 ✓ | 88,85 ✓ | **60,98** | 47,07 ✓ |

Coloanele de 6, 12 și 24 de luni corespund exact. Implementarea folosește
formula matematică de anuitate (deci 60,98 lei), pentru ca rata afișată,
totalul de rambursat și documentul PDF să fie coerente între ele.
Dacă valoarea contractuală trebuie să fie 61,00 lei, se modifică într-un singur
loc: `monthlyPayment()` din `assets/js/loan-math.js`.

---

## Personalizare

| Ce vrei să schimbi | Unde |
|---|---|
| Sumele disponibile, perioada maximă, dobânda | `assets/js/loan-math.js` |
| Pragul de îndatorare (`COMFORT_RATIO`) | `assets/js/loan-math.js` |
| Culoarea de brand, spațierile, fonturile | variabilele din `:root`, `assets/css/styles.css` |
| Datele de contact din antetul PDF-ului | obiectul `ORG` din `assets/js/pdf-doc.js` |
| Textele declarațiilor din PDF | secțiunea „DECLARAȚII” din `assets/js/pdf-doc.js` |
| Conținutul e-mailurilor | `applicantMail()` / `officeMail()` din `server/index.js` |
| Logo | înlocuiește `assets/img/logo-sanitas.png` și regenerează `pdf-assets.js` |

---

## Licențe pentru resursele incluse

- **jsPDF** (`assets/vendor/`) — licență MIT, vezi `jspdf-LICENSE.txt`
- **Fonturile** din `assets/fonts/` și din `pdf-assets.js` sunt un subset din
  familia Liberation Sans, distribuită sub SIL Open Font License 1.1
