# Hogar

Control de gastos para dos personas. Supermercado, otros gastos, duración de productos e ingresos del mes.

Moneda inicial: peso dominicano (RD$). Fechas en día/mes/año. Zona horaria: America/Santo_Domingo.

## En el teléfono

La dirección del proyecto en Vercel es:

https://control-adl25.vercel.app

## Primera vez en Supabase

1. Abre la app. Si faltan las tablas, la pantalla **Falta un paso** copia el SQL.
2. También puedes pegar `supabase/schema.sql` en el [editor SQL](https://supabase.com/dashboard/project/poaidcwtljycppnekvsr/sql/new) y pulsar Run.
3. En Authentication → URL configuration:
   - Site URL: `https://control-adl25.vercel.app`
   - Redirect URLs: `https://control-adl25.vercel.app/**` y `http://localhost:3000/**`
4. En el proyecto `control` de Vercel, Settings → Deployment Protection: desactiva Vercel Authentication en Production. Si sigue activo, el teléfono pide cuenta de Vercel antes de abrir la app.

La app ya incluye la URL y la clave pública de este proyecto. Si más adelante rotas la clave, define en Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

y vuelve a desplegar. No uses la clave secret en el navegador.

## Local

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

```bash
npm test
npm run lint
```
