# Tienda Mabel (Base Full-Stack)

Base de tienda online para bazar mayorista con productos unicos y stock semanal. Stack: React + Vite, Node.js + Express, SQLite + Prisma, JWT.

## Estructura
- `backend/` API REST, Prisma, SQLite
- `frontend/` Vite + React

## Requisitos
- Node.js 18+

## Configuracion rapida
1) Backend
```bash
cd backend
npm install
cp .env .env.local # opcional
npx prisma migrate dev --name init
npm run dev
```

2) Frontend
```bash
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:5173`.

## Credenciales Admin (default)
- `mabel` / `1234`
- `elima` / `1234`

Se pueden cambiar en `backend/.env` con `ADMIN_USERS`.

## Variables de entorno
Backend (`backend/.env`):
- `DATABASE_URL="file:./dev.db"`
- `JWT_SECRET="change-this-secret"`
- `ADMIN_USERS="mabel:1234,elima:1234"`
- `PORT=4000`

Frontend (`frontend/.env`):
- `VITE_API_URL="http://localhost:4000"`

## Notas
- Los productos con stock 0 se eliminan automaticamente.
- Checkout sin registro.
- Mercado Pago y Correo Argentino quedan preparados como servicios separados.

## Diagnostico de entorno (produccion)
- Configurar `DIAG_KEY` en las variables de entorno de Hostinger.
- Probar:
```bash
curl -H "x-diag-key: <valor>" https://traviesa.shop/api/_diag/env
```
