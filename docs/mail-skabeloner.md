# Danske mail-skabeloner til Supabase

Indsæt i Supabase under **Authentication → Emails → Templates**. Kopiér *Subject* og *Body* (HTML) for hver skabelon.

## Confirm signup

**Subject:** `Bekræft din konto hos Just Nails by AK`

```html
<div style="background:#0b0a09;padding:32px 20px;font-family:Helvetica,Arial,sans-serif;color:#f4efe6">
  <div style="max-width:460px;margin:0 auto;text-align:center">
    <p style="font-family:Georgia,serif;font-size:28px;color:#d4af6a;margin:0 0 4px">Just nails ♥</p>
    <p style="letter-spacing:6px;font-size:11px;color:#d4af6a;margin:0 0 28px">BY AK</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 24px">Tak fordi du har oprettet en konto. Tryk på knappen for at bekræfte din e-mail, så kan du booke tid.</p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#d4af6a;color:#1a1408;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:bold">Bekræft min e-mail</a>
    <p style="font-size:12px;color:#a39a8b;margin:28px 0 0">Har du ikke oprettet en konto, kan du se bort fra denne mail.</p>
  </div>
</div>
```

## Reset password

**Subject:** `Vælg en ny adgangskode`

```html
<div style="background:#0b0a09;padding:32px 20px;font-family:Helvetica,Arial,sans-serif;color:#f4efe6">
  <div style="max-width:460px;margin:0 auto;text-align:center">
    <p style="font-family:Georgia,serif;font-size:28px;color:#d4af6a;margin:0 0 4px">Just nails ♥</p>
    <p style="letter-spacing:6px;font-size:11px;color:#d4af6a;margin:0 0 28px">BY AK</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 24px">Du har bedt om at nulstille din adgangskode. Tryk på knappen for at vælge en ny.</p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#d4af6a;color:#1a1408;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:bold">Vælg ny adgangskode</a>
    <p style="font-size:12px;color:#a39a8b;margin:28px 0 0">Har du ikke bedt om det, kan du se bort fra denne mail. Din adgangskode er ikke ændret.</p>
  </div>
</div>
```

## Change email address (valgfri)

**Subject:** `Bekræft din nye e-mail`

```html
<div style="background:#0b0a09;padding:32px 20px;font-family:Helvetica,Arial,sans-serif;color:#f4efe6">
  <div style="max-width:460px;margin:0 auto;text-align:center">
    <p style="font-family:Georgia,serif;font-size:28px;color:#d4af6a;margin:0 0 28px">Just nails ♥</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 24px">Tryk på knappen for at bekræfte din nye e-mail.</p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#d4af6a;color:#1a1408;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:bold">Bekræft e-mail</a>
  </div>
</div>
```
