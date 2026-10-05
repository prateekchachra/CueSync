# MySync

React Native (Expo) prototype for musicians who pitch to sync licensors. It stores catalog metadata only: song fields, moods, and saved metadata-check runs.

## Setup

1. In the [Supabase SQL editor](https://supabase.com/dashboard/project/agvzhsqzbgqmcyftoask/sql), run `supabase/schema.sql`.
2. Auth → Providers → Email: turn **Confirm email** off for this prototype.
3. Project Settings → API: copy the **anon public** key into `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://agvzhsqzbgqmcyftoask.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=paste-anon-key-here
```

4. `npm start` then open iOS, Android, or web.

## Darzini demo

On the login screen, tap **Continue as Darzini**. That creates (or signs into):

- Email: `darzini@mysync.app`
- Password: `DarziniSync1!`
- Artist name: Darzini

The first login seeds three sample tracks so you can run a metadata check immediately. `Glass Cathedral` is intentionally missing ISRC/publisher so the check returns warnings.
