This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase authentication and coffee queue

The web app uses Supabase Auth for email/password registration and login. Supabase stores authentication credentials in its managed `auth.users` table; passwords are not stored in the app's public tables. Customers create coffee turns, and admins advance each turn through preparation and delivery.

1. In Supabase, open **SQL Editor** and run these migrations in order: `supabase/migrations/20261114000000_perfiles_usuario.sql`, `supabase/migrations/20261117000000_roles_y_mensajes.sql`, `supabase/migrations/20261118000000_turnos_cafe.sql`, `supabase/migrations/20261118010000_historial_cliente.sql`, then `supabase/migrations/20261118020000_historial_admin.sql`. The second migration creates `public.profiles` with the `user`/`admin` role and configures the shared `mensajes` list. The third creates `public.turnos`, secures customer and admin access with RLS, and enables Realtime. The fourth lets customers hide delivered turns from their own dashboard, and the fifth lets admins hide delivered orders from the admin panel; both preserve the records and the other role's history. Existing `public.perfiles` and `public.mensajes` data is preserved.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `web/.env.local` for local development. Use the values from the Supabase project's API settings; `.env.example` shows the expected names.
3. Add the same variables to the Vercel project's environment variables and redeploy.
4. If email confirmation is enabled in Supabase Auth, configure the project's site URL and allowed redirect URLs for your local and Vercel domains. New users must confirm their email before signing in.
5. To promote an account, update its role from the Supabase SQL Editor: `update public.profiles set role = 'admin' where id = 'AUTH-USER-UUID';`. Admins can update order states; customers can read only their own turns.
6. Customers can opt into browser notifications from the app. In-app status updates use Realtime while the page is open; notifications after the browser is closed require a separate push-notification service.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
