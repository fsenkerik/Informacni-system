# DataFirma

Výuková webová aplikace pro **informační systémy** na střední škole.

Žáci ve dvojicích navrhnou ER diagram vlastní firmy a pak do ní pustí zákazníky.
Simulace běží nad *jejich* schématem — když chybí vazba mezi objednávkou
a zákazníkem, systém se viditelně zasekne a řekne proč:

> „Objednávka č. 47 — nevím, komu patří.“

To je celý smysl aplikace. V Accessu je databáze neviditelná a mrtvá; tady žák
vidí, k čemu ten cizí klíč vlastně je.

---

## Co aplikace umí

| Karta | Co se tam děje |
|---|---|
| **Návrh** | ER editor — tabulky, datové typy, klíče, vazby 1:1 / 1:N / M:N. Dvojice pracuje současně a vidí změny toho druhého. |
| **Provoz** | Simulace v zrychleném čase. Zákazníci chodí, zapisují se řádky, chyby se ukazují i s tlačítkem **Oprav to**. |
| **Data** | Řádky, které simulace vygenerovala. Cizí klíče jsou označené — je vidět, že to je obyčejný sloupec s číslem. |
| **Úspěchy** | Mise, XP a odznaky za správné návyky (primární klíč, rozklad M:N, čistá data). |
| **SQL** | Návrh přeložený do `CREATE TABLE` včetně dopočítaných cizích klíčů. |
| **/ucitel** | Třídy, generování kódů pro skupiny, živý přehled pokroku. |

Čtyři obory: **E-shop**, **Kavárna**, **Autoservis**, **Půjčovna**.
Velikost firmy určuje provoz: 20 / 50 / 100 zákazníků denně.

---

## Zprovoznění

Potřebuješ Node.js 20.9+ a bezplatný účet na [supabase.com](https://supabase.com).

### 1. Databáze

Založ nový projekt v Supabase a v **SQL Editoru** spusť postupně:

1. `supabase/migrations/0001_init.sql` — tabulky, funkce, triggery
2. `supabase/migrations/0002_rls.sql` — oprávnění a Realtime

Pak v **Authentication → Sign In / Providers**:

- zapni **Anonymous sign-ins** — bez toho se žáci nepřipojí kódem,
- u **Email** vypni **Confirm email** — jinak se učitel nepřihlásí, dokud
  Supabase nemá nastavené SMTP.

### 2. Aplikace

```bash
npm install
cp .env.local.example .env.local
```

Do `.env.local` doplň `NEXT_PUBLIC_SUPABASE_URL` a `NEXT_PUBLIC_SUPABASE_ANON_KEY`
ze **Supabase → Project Settings → API**.

```bash
npm run dev
```

Aplikace běží na <http://localhost:3000>.

### 3. Nasazení na Vercel

Naimportuj repozitář na [vercel.com](https://vercel.com), doplň stejné dvě env
proměnné a nasaď. Tarif Hobby je pro školní projekt zdarma.

Volitelně přidej `KEEP_ALIVE_SECRET` — `vercel.json` spouští jednou denně
`/api/keep-alive`, aby se bezplatný projekt Supabase neuspal o prázdninách.

---

## Jak to použít v hodině

1. Přihlas se na `/ucitel`, založ třídu a v ní tolik projektů, kolik máš skupin.
2. Napiš kódy na tabuli. Kódy neobsahují znaky, které se pletou (0/O, 1/I/L).
3. Žáci jdou na `/pripojit`, zadají kód a přezdívku. **Žádné e-maily, žádná hesla.**
   Když zadá stejný kód celá dvojice, pracují na stejné firmě v reálném čase.
4. Nech je nejdřív navrhnout schéma podle zadání na kartě Návrh.
5. Pak Provoz → **Spustit**. Tady se to láme.

**Tip do hodiny:** nech je schválně spustit provoz s nedodělaným schématem.
Zákazníci se začnou zasekávat a chyba se pojmenuje sama. Oprava za běhu se
projeví okamžitě — simulaci není potřeba restartovat.

---

## Vývoj

```bash
npm run dev        # vývojový server
npm test           # testy simulačního enginu
npm run typecheck  # kontrola typů
npm run lint       # ESLint
npm run build      # produkční build
```

### Struktura

```
src/
  app/                    stránky (App Router)
  components/
    er/                   ER editor (React Flow)
    sim/                  scéna provozu, metriky, deník
  lib/
    er/                   stav diagramu, validace návrhu, generování SQL
    sim/                  simulační engine — bez Reactu a bez databáze
      scenarios/          obory a cesta zákazníka
    game/                 mise a odznaky
supabase/migrations/      SQL migrace
```

### Dvě rozhodnutí, která stojí za vysvětlení

**Schéma žáka není skutečné SQL.** Ukládá se jako metadata (entity, atributy,
vazby), data simulace do `jsonb`. Žádné `CREATE TABLE` z prohlížeče, žádné
migrace za běhu — a schéma jde měnit uprostřed simulace. Karta SQL ukazuje, jak
by návrh vypadal doopravdy.

**Simulaci točí prohlížeč, ne server.** Kdo zmáčkne Spustit, stává se hostem:
běží mu smyčka, výsledky dávkuje do databáze a lehký stav posílá spolužákovi
přes Realtime Broadcast. Díky tomu není potřeba placený běžící worker.

Engine v `src/lib/sim/engine.ts` je čistý TypeScript — stejný seed dá vždy
stejný běh, takže se dá testovat z příkazové řádky.

### Známá omezení

- Odznaky se vyhodnocují na klientovi. Žák, který si otevře konzoli, si je umí
  podstrčit — ale to už se naučil víc, než ten odznak měří.
- Do databáze se z jednoho běhu uloží prvních 300 řádků, aby projekt nepřerostl
  bezplatný tarif. Zbytek žije v paměti prohlížeče po dobu simulace.
- Volný režim s vlastními pravidly pro tabulky nad rámec scénáře zatím není
  hotový — tabulku navíc si žák vytvořit může, ale simulace do ní nezapisuje.
