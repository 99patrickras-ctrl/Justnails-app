# Opsætning af Just Nails by AK-appen

Denne vejledning tager dig fra kode til en app, som din mor og kunderne bruger på deres telefoner. Regn med 1–2 timer første gang. Følg trinene i rækkefølge.

**Hvem ejer hvad:** Alle konti oprettes af fellowup med en fellowup-mail (fx `it@fellowup.dk`), så adgangen ikke hænger på én persons private mail. Slå to-trins-login til overalt, hvor det tilbydes. Gem alle adgangskoder i en adgangskodemanager.

| Tjeneste | Bruges til | Pris |
|---|---|---|
| GitHub | Opbevarer koden og holder databasen vågen | Gratis |
| Supabase | Database, login og billeder (EU) | Gratis plan |
| Cloudflare | Lægger appen på nettet og styrer domænets DNS | Gratis |
| Resend | Sender login-mails fra salonens domæne | Gratis op til 100 mails om dagen |
| justnailsbyak.dk | Adressen kunderne bruger | Det årlige domænegebyr |

---

## Trin 1 – Læg koden på GitHub

1. Opret en GitHub-konto med fellowup-mailen på github.com.
2. Tryk **New repository**. Navn: `justnails-app`. Vælg **Private**. Opret.
3. Tryk **uploading an existing file**, og træk alt indholdet fra den udpakkede mappe ind (ikke selve mappen, men det der ligger i den, inklusive mapperne `.github`, `src`, `supabase` osv.). Tryk **Commit changes**.

   Vil du hellere have, at Claude lægger koden op for dig, så skriv navnet på repoet i chatten.

## Trin 2 – Opret databasen i Supabase

1. Gå til supabase.com, opret en konto med fellowup-mailen, og opret en organisation, der hedder **Fellowup**.
2. **New project**:
   - Navn: `justnails`
   - Database password: Lav en lang adgangskode og gem den.
   - Region: **Central EU (Frankfurt)**. Det er vigtigt af hensyn til GDPR.
   - Plan: Free
3. Når projektet er klar: Åbn **SQL Editor** → **New query**. Åbn filen `supabase/migrations/0001_init.sql`, kopiér hele indholdet ind, og tryk **Run**. Der skal stå *Success*.
4. **Authentication → Sign In / Providers → Email**:
   - *Enable Email provider*: til
   - *Confirm email*: **til**. Det skal være slået til, for det sikrer, at ingen kan oprette sig med en andens e-mail.
   - *Minimum password length*: 8
5. Find nøglerne under **Project Settings → API Keys** og skriv to ting ned:
   - **Project URL** (fx `https://abcd1234.supabase.co`)
   - **Publishable key** (starter med `sb_publishable_`). Står den der ikke, så brug **anon public**-nøglen under *Legacy API keys*.

   Brug aldrig *secret*- eller *service_role*-nøglen i appen.

Menuernes navne i Supabase ændrer sig en gang imellem. Kan du ikke finde et punkt, så søg efter navnet i Supabase-dashboardet.

## Trin 3 – Domænet justnailsbyak.dk

1. Køb `justnailsbyak.dk` hos en dansk domæneudbyder (fx Simply.com, One.com eller Punktum dk's egne forhandlere). Registrér det i salonens eller fellowups navn, så det ejes af firmaet.
2. Opret en gratis konto på cloudflare.com med fellowup-mailen → **Add a domain** → skriv `justnailsbyak.dk` → vælg **Free**.
3. Cloudflare viser to *nameservere*. Gå ind hos domæneudbyderen og skift domænets nameservere til de to fra Cloudflare. Det kan tage fra få minutter til et døgn, før Cloudflare skriver, at domænet er aktivt.

## Trin 4 – Mails fra salonens domæne (Resend)

Supabases indbyggede mailsystem kan kun sende 2 mails i timen. Derfor sender vi gennem Resend.

1. Opret en konto på resend.com med fellowup-mailen.
2. **Domains → Add domain** → `justnailsbyak.dk` → region **EU**.
3. Resend viser nogle DNS-poster (typisk MX, TXT/SPF og DKIM). Tilføj dem én for én i Cloudflare under **DNS → Records**. Sæt *Proxy status* til **DNS only** (grå sky) på dem. Tryk **Verify** i Resend, når alle er tilføjet.
4. **API Keys → Create API key**. Vælg *Sending access*. Kopiér nøglen, for den vises kun én gang.
5. I Supabase: **Authentication → Emails → SMTP Settings** → slå *Custom SMTP* til:

   | Felt | Værdi |
   |---|---|
   | Sender email | `booking@justnailsbyak.dk` |
   | Sender name | `Just Nails by AK` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | API-nøglen fra Resend |

6. **Authentication → Rate Limits**: Sæt *emails sent per hour* op til fx 30.
7. **Authentication → Emails → Templates**: Indsæt de danske tekster fra [mail-skabeloner.md](mail-skabeloner.md) for *Confirm signup* og *Reset password*.

## Trin 5 – Læg appen på nettet (Cloudflare Pages)

1. I Cloudflare: **Workers & Pages → Create** → vælg **Pages** → **Import an existing Git repository** → forbind GitHub og vælg `justnails-app`.
2. Byggeindstillinger:

   | Felt | Værdi |
   |---|---|
   | Framework preset | Vite (eller None) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

3. Under **Environment variables** tilføjer du:

   | Navn | Værdi |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL fra trin 2 |
   | `VITE_SUPABASE_KEY` | Publishable key fra trin 2 |
   | `NODE_VERSION` | `22` |

4. Tryk **Save and Deploy**. Efter et par minutter får du en adresse som `justnails-app.pages.dev`. Åbn den. Du skal se login-skærmen med logoet.
5. Under projektet: **Custom domains → Set up a custom domain** → `justnailsbyak.dk`. Cloudflare sætter DNS op af sig selv, fordi domænet allerede ligger der.
6. Tilbage i Supabase: **Authentication → URL Configuration**:
   - *Site URL*: `https://justnailsbyak.dk`
   - *Redirect URLs*: Tilføj `https://justnailsbyak.dk/**`, `https://justnails-app.pages.dev/**` og `http://localhost:5173/**`

Hvis Cloudflare kun tilbyder *Workers* og ikke *Pages*, når du opretter projektet, så sig det i chatten. Så tilføjer Claude den lille konfigurationsfil, som Workers skal bruge.

Ændrer du variablerne senere, skal du lave en ny deploy (**Deployments → Retry deployment**), før ændringen virker.

## Trin 6 – Gør din mor og dig selv til admin

1. Åbn `https://justnailsbyak.dk` og tryk **Opret konto** med din mors e-mail. Bekræft via mailen. Gør det samme med din egen e-mail.
2. I Supabase → **SQL Editor** → kør (med de rigtige mails):

   ```sql
   select public.make_admin('mor@eksempel.dk');
   select public.make_admin('patrick@fellowup.dk');
   ```

3. Log ud og ind igen i appen. Nu ser I admin-menuen: Overblik, Kalender, Kunder, Lager og Økonomi.

## Trin 7 – Klargør appen sammen med din mor

1. Tryk på **tandhjulet** øverst til højre:
   - Udfyld salonens telefonnummer. Det vises for kunder, der vil aflyse med kort varsel.
   - Opret ydelserne med navn, pris og varighed.
   - Tjek bookingreglerne. Standard er: aflysning indtil 24 timer før, booking senest 12 timer før, 60 dage frem og tider hvert 15. minut.
2. **Kalender → Åbn flere dage**: Tryk på de dage, hun arbejder, vælg tidsrum og gem. Kun de dage kan kunderne booke.
3. Læg appen på hendes iPhone: Åbn `justnailsbyak.dk` i **Safari** → tryk på **Del** → **Føj til hjemmeskærm**. Gør det samme på din egen telefon.
4. Ret de felter i privatlivspolitikken, der står i [KANTEDE PARENTESER] (filen `src/pages/Privacy.jsx`), eller bed Claude om det.

**Sådan bruger hun den til daglig:**
- Nye bookinger kommer under **Overblik → Venter på svar**. Hun trykker **Godkend** eller **Afvis**. Kunden ser svaret i appen.
- Når en kunde har været der: Åbn tiden i kalenderen, tjek prisen, og tryk **Marker som gennemført**. Så tæller beløbet med i indtjeningen. Billeder af sættet tilføjes samme sted.
- Indkøb registreres under **Økonomi → Registrér udgift**. Sæt flueben i *Læg varerne på lager*, så kommer de direkte på lager.

Appen sender ikke selv besked til din mor om nye bookinger i denne version. Hun ser dem, når hun åbner appen. Det kan tilføjes senere (fase 2: mail eller push-besked).

## Trin 8 – Få kunderne med

- Læg `justnailsbyak.dk` i Instagram-bioen, og skriv et opslag om, at man nu kan booke i appen.
- Kunderne trykker **Opret konto**, bekræfter deres mail, og kan derefter booke.
- Har din mor oprettet en kunde selv (fx en telefonbooking) med kundens e-mail, kobles historikken automatisk på, når kunden opretter login med samme e-mail.

## Trin 9 – Hold databasen vågen (2 minutter)

Supabase sætter gratis projekter på pause efter en uge uden aktivitet. GitHub-filen `.github/workflows/keep-alive.yml` kalder databasen hver morgen, men den skal have nøglerne:

1. GitHub → repoet → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_KEY` = Publishable key
2. Fanen **Actions** → *Hold databasen vågen* → **Run workflow**. Den skal blive grøn.

## Trin 10 – Opdateringer fremover

- **Ændringer i appen:** Ret koden (fx sammen med Claude), og læg de ændrede filer op på GitHub. Cloudflare bygger og udgiver automatisk på 1–2 minutter. Telefonerne henter den nye version, næste gang appen åbnes.
- **Ændringer i databasen:** De kommer som nye filer i `supabase/migrations/` (fx `0002_….sql`). De køres i Supabase SQL Editor ligesom i trin 2. Kør aldrig `0001_init.sql` igen på en database med data i.
- **Test på din egen computer:** `npm install`, kopiér `.env.example` til `.env` og udfyld, kør `npm run dev`. `npm run test:db` tester databasereglerne uden at røre den rigtige database.
- **Det rigtige logo:** Læg logoet i `public/logo.png` og ret `LOGO_IMAGE` i `src/components/Logo.jsx` til `'/logo.png'`. App-ikonerne er filerne `public/pwa-*.png`, `apple-touch-icon.png` og `favicon.png`.

## Trin 11 – Data og GDPR

- Din mor (salonen) er *dataansvarlig*, og fellowup er *databehandler*. Lav en kort databehandleraftale mellem salonen og fellowup. Supabase og Resend har hver deres databehandleraftale (DPA), som kan accepteres i deres dashboards.
- Kunderne giver samtykke til privatlivspolitikken og (frivilligt) til billeder, når de opretter sig. På kundekortet kan din mor se, om en kunde har sagt ja til billeder.
- **Backup:** Tjek under **Database → Backups** i Supabase, hvad gratis-planen giver. Eksportér indtil videre tabellerne `customers`, `bookings`, `expenses` og `products` som CSV en gang om måneden (**Table Editor → Export**). Når salonen er afhængig af appen, er Supabase Pro værd at overveje, fordi den har daglige backups.

Dette er ikke juridisk rådgivning. Er I i tvivl, så spørg en revisor eller jurist.

---

## Fejlsøgning

| Problem | Løsning |
|---|---|
| Appen skriver "mangler sin database" | Variablerne i trin 5 mangler eller er stavet forkert. Ret dem og lav en ny deploy. |
| Bekræftelsesmailen kommer ikke | Tjek spam. Tjek at domænet står som *Verified* i Resend, og at SMTP-felterne i trin 4 er rigtige. Se også **Authentication → Logs** i Supabase. |
| Linket i mailen går til en forkert adresse | Ret *Site URL* og *Redirect URLs* i trin 5.6. |
| Kunden ser ingen ledige tider | Er dagen åbnet i kalenderen? Er ydelsen slået til? Er ydelsen længere end dagens åbningstid? Tider tidligere end 12 timer frem vises ikke (kan ændres under tandhjulet). |
| Login virker, men admin-menuen vises ikke | Kør `make_admin` (trin 6) og log ud og ind igen. |
| Supabase skriver "Project paused" | Tryk **Restore** i Supabase og tjek, at trin 9 kører grønt. |
| Kunden vil slettes | Slet kunden på kundekortet i appen. Slet også kundens login i Supabase under **Authentication → Users**. |
