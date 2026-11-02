# Just Nails by AK – booking-app

Web-app til neglesalonen Just Nails by AK. Den installeres på hjemmeskærmen på iPhone og Android.

- **Admin (salonen):** overblik over indtjening, udgifter og overskud, kalender med åbne dage, godkendelse af bookinger, kundekort med noter og billeder, lager og ydelser.
- **Kunder:** opretter login, booker en ledig tid på de dage salonen har åbnet, ser egne tider, historik og billeder, aflyser indtil 24 timer før og retter egne oplysninger.

**Opsætning trin for trin:** [docs/OPSAETNING.md](docs/OPSAETNING.md)

## Teknik

| Del | Valg |
|---|---|
| App | React 18 + Vite, installérbar web-app (PWA) |
| Database, login, billeder | Supabase (Postgres med Row Level Security, Auth, Storage), EU-region |
| Hosting | Cloudflare Pages, deploy automatisk fra GitHub |
| Mail | Resend som SMTP for Supabase Auth |

```
src/
  pages/admin/      Overblik, Kalender, Kunder, Lager, Økonomi, Indstillinger
  pages/customer/   Mine tider, Book tid, Profil
  pages/auth/       Log ind / opret / glemt adgangskode
  components/       Logo, bundark, booking- og billedkomponenter
  lib/              Supabase-klient, login, datoer i dansk tid, billed-upload
supabase/
  migrations/       Hele databasen (tabeller, sikkerhedsregler, booking-funktioner)
  test/             Tests af databasen (kører uden Supabase)
```

## Kommandoer

```bash
npm install
cp .env.example .env     # udfyld med Supabase-værdierne
npm run dev              # kør lokalt på http://localhost:5173
npm run build            # byg til dist/
npm run test:db          # test databasen (42 tests)
npm run icons            # lav app-ikoner igen (kræver python3 med pillow og fonttools)
```

## Sikkerhed i korte træk

Alle regler håndhæves i databasen, ikke kun i appen:

- En kunde kan kun læse sine egne bookinger, sit eget kundekort og sine egne billeder.
- Kunder kan ikke se salonens noter, lager, udgifter eller andre kunder.
- Bookinger oprettes kun gennem `request_booking`, som tjekker åben dag, varighed og ledighed. Databasen afviser overlappende bookinger, også ved samtidige tryk.
- Aflysning gennem `cancel_my_booking` håndhæver fristen (standard 24 timer).
- Admin-rollen kan kun gives fra Supabase SQL Editor med `select public.make_admin('mail');`.
