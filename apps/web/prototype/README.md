# Learning studio local preview

This is a standalone React + Vite prototype. It starts without Next.js, authentication, middleware, or API calls.

From the repository root:

```sh
pnpm dev:prototype
```

Open `http://127.0.0.1:3400`. The preview uses the UI primitives and semantic theme from `apps/web/src` through the Vite `@/` alias. Build with `pnpm --filter @graphmind/web prototype:build`; typecheck with `pnpm --filter @graphmind/web prototype:typecheck`; run focused journey/state checks with `pnpm --filter @graphmind/web prototype:test`.

The Python curriculum and tutor replies are fixed local sample content. Renaming the path changes only its local label. Lesson completion is a learner choice and does not imply measured mastery. Conversations are held in memory per lesson and clear when the demo is reset or the page reloads. Source links identify official external documentation; other notes are marked as local sample content. No service or backend API is contacted.
