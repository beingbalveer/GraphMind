# GraphMind Authentication Flow — Design Specification

**Status:** Approved (incorporating security & architectural review)  
**Author:** Antigravity  
**Date:** 2026-09-08  
**Scope:** Identity, Google OAuth 2.0, Email/Password Auth, Workspace Ownership & Scoping, Token Revocation, RBAC, Next.js Route Guarding & Unified Client  

---

## 1. Executive Summary

GraphMind is evolving from unauthenticated global workspaces to an enterprise-grade, multi-tenant identity and access architecture. This specification incorporates critical architectural, concurrency, and security safeguards:
1. **Google OAuth 2.0 (Primary):** Google Identity Services (GIS) on Next.js, with non-blocking server verification offloaded via threadpools.
2. **Email & Password (Secondary):** Direct `bcrypt` hashing (avoiding deprecated `passlib`) with instant activation for local and production environments.
3. **Session Transport & Same-Origin Proxying:** All frontend calls route through Next.js relative paths (`/api/v1/...`) via `next.config.ts` rewrites with `credentials: "include"`. This makes cookies strictly same-origin/first-party, avoiding cross-origin credential rejection. FastAPI CORS explicitly restricts origins to configured frontends with `allow_credentials=True` (no wildcard `*`).
4. **Token Invalidation via `token_version`:** Refresh tokens contain a `token_version` claim. Logging out increments `user.token_version` in PostgreSQL, enabling immediate server-side revocation of stolen or abandoned refresh tokens.
5. **Multi-Tenancy, Invariants & RBAC:**
   - Invariant: `workspaces.owner_id` designates the creator. On workspace creation, a corresponding `WorkspaceMember(role="owner")` is automatically seeded.
   - Dual-layer dependencies: `require_workspace_read` (owner, editor, viewer) and `require_workspace_write` (owner, editor).
6. **Unified API Client & Transparent Refresh:** A centralized `@/lib/apiClient.ts` automatically attaches credentials, intercepts `401 Unauthorized`, calls `/api/v1/auth/refresh`, and seamlessly replays failed requests before redirecting to `/login`.

---

## 2. System Architecture & Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Next.js Frontend                              │
│                                                                         │
│  [ /login ]                                                             │
│    ├── Google One-Tap / Google Sign-In Button (GIS SDK)                 │
│    └── Email / Password Tabs (Sign In / Register)                       │
│                                                                         │
│  [ Middleware (middleware.ts) ]                                         │
│    └── Checks access_token / refresh_token cookie -> /login?next=...    │
│                                                                         │
│  [ Unified API Client (@/lib/apiClient.ts) ]                            │
│    ├── Relative URLs (/api/v1/...) via Next.js rewrites                 │
│    ├── credentials: "include" (Same-Origin Cookies)                     │
│    └── 401 Interceptor -> calls /auth/refresh -> replays request        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ (Same-Origin /api/v1/...)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Next.js Rewrite Proxy                              │
│         /api/v1/:path*  ───►  http://127.0.0.1:8300/api/v1/:path*       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ (Internal HTTP)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FastAPI Backend                                 │
│                                                                         │
│  [ CORS Configuration ]                                                 │
│    ├── allow_origins=[FRONTEND_URL, "http://localhost:3000", ...]      │
│    └── allow_credentials=True (NO wildcard "*")                         │
│                                                                         │
│  [ /api/v1/auth ]                                                       │
│    ├── POST /google   (run_in_threadpool verify_oauth2_token)           │
│    ├── POST /register (direct bcrypt hashpw, min 8 chars)               │
│    ├── POST /login    (direct bcrypt checkpw)                           │
│    ├── POST /refresh  (verifies JWT token_version == user.token_version)│
│    ├── POST /logout   (increments user.token_version + clears cookies)  │
│    └── GET  /me       (returns authenticated user profile)              │
│                                                                         │
│  [ RBAC Dependencies ]                                                  │
│    ├── get_current_user                                                 │
│    ├── require_workspace_read  (owner, editor, viewer)                  │
│    └── require_workspace_write (owner, editor only)                     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL Database                               │
│                                                                         │
│  • users: id, email, hashed_password, token_version, avatar_url, etc.   │
│  • workspace_members: id, workspace_id, user_id, role (owner/edit/view) │
│  • workspaces: ..., owner_id (FK -> users.id)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Data Models

### 3.1 `User` Model (`users` table)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String(64)` | PK, default `usr_<uuid12>` | Unique user identifier |
| `email` | `String(255)` | Unique, Indexed, Not Null | User email in lowercase |
| `hashed_password` | `String(255)` | Nullable | Null for Google OAuth users; bcrypt hash for email users |
| `full_name` | `String(255)` | Nullable | User display name |
| `avatar_url` | `String(512)` | Nullable | Profile picture URL |
| `provider` | `String(32)` | Not Null, default `"google"` | Source: `"google"` or `"local"` |
| `token_version` | `Integer` | Not Null, default `1` | Token version for server-side revocation |
| `is_active` | `Boolean` | Not Null, default `True` | Account status |
| `created_at` | `DateTime(tz=True)` | Not Null | Creation timestamp in UTC |
| `updated_at` | `DateTime(tz=True)` | Not Null | Last update timestamp in UTC |

### 3.2 `WorkspaceMember` Model (`workspace_members` table)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String(64)` | PK, default `wsm_<uuid12>` | Unique membership identifier |
| `workspace_id` | `String(64)` | FK (`workspaces.id`, ondelete `CASCADE`), Indexed | Workspace link |
| `user_id` | `String(64)` | FK (`users.id`, ondelete `CASCADE`), Indexed | User link |
| `role` | `String(32)` | Not Null, default `"owner"` | Access role: `"owner"`, `"editor"`, `"viewer"` |
| `created_at` | `DateTime(tz=True)` | Not Null | Join timestamp in UTC |

*Constraint:* `UniqueConstraint("workspace_id", "user_id", name="uq_workspace_user")`

### 3.3 `Workspace` Model Updates (`workspaces` table)
- `owner_id`: `String(64)`, `ForeignKey("users.id", ondelete="CASCADE")`, `nullable=False`, `index=True`
- Invariant: When creating a workspace, automatically create:
  ```python
  workspace = Workspace(..., owner_id=user.id)
  member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner")
  ```

### 3.4 Migration Strategy for Existing Databases
An Alembic migration script will execute the following sequence:
1. Create `users` table.
2. Create `workspace_members` table.
3. Seed a default system user if not present (`id="usr_default_admin"`, `email="dev@graphmind.local"`).
4. Add `owner_id` column to `workspaces` as nullable.
5. `UPDATE workspaces SET owner_id = 'usr_default_admin' WHERE owner_id IS NULL;`
6. Insert `WorkspaceMember(workspace_id=w.id, user_id='usr_default_admin', role='owner')` for each existing workspace.
7. Alter `workspaces.owner_id` to `nullable=False`.

---

## 4. Backend Authentication & API Endpoints

### 4.1 Security Services (`apps/api/src/services/auth_service.py`)

#### Direct `bcrypt` Password Hashing (No passlib)
```python
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
```

#### Non-Blocking Google ID Token Verification
Synchronous `google.oauth2.id_token.verify_oauth2_token` network calls are dispatched to a threadpool to prevent blocking the asyncio event loop:
```python
from starlette.concurrency import run_in_threadpool
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

async def verify_google_token(token: str, client_id: str) -> dict:
    return await run_in_threadpool(
        id_token.verify_oauth2_token,
        token,
        google_requests.Request(),
        client_id,
    )
```

#### JWT Issuance with `token_version`
- **Access Token:** Payload `{ "sub": user.id, "type": "access", "exp": now + 3600 }` (60 minutes).
- **Refresh Token:** Payload `{ "sub": user.id, "type": "refresh", "token_version": user.token_version, "exp": now + 2592000 }` (30 days).

#### Cookie Dispatch
```python
def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    is_prod = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=3600,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=30 * 86400,
        path="/",
    )
```

### 4.2 Auth Router Endpoints (`/api/v1/auth`)

1. **`POST /api/v1/auth/google`**
   - Body: `{ "id_token": "..." }`
   - Non-blocking Google verification.
   - Finds or creates user with `provider="google"`.
   - If new user, auto-provisions their initial workspace (with `WorkspaceMember(role="owner")`).
   - Sets cookies, returns user profile.

2. **`POST /api/v1/auth/register`**
   - Body: `{ "email": "...", "password": "...", "full_name": "..." }`
   - Validates email regex and password length ($\ge 8$).
   - Rejects existing emails with `409 Conflict`.
   - Hashes password via `bcrypt.hashpw`.
   - Auto-provisions initial workspace.
   - Sets cookies, returns user profile.

3. **`POST /api/v1/auth/login`**
   - Body: `{ "email": "...", "password": "..." }`
   - Looks up user. If `hashed_password` is `None`, returns `400 Bad Request` ("This account was created via Google Sign-In. Please continue with Google.").
   - Verifies via `bcrypt.checkpw`.
   - Sets cookies, returns user profile.

4. **`POST /api/v1/auth/refresh`**
   - Reads `refresh_token` from cookie.
   - Decodes JWT. Queries user from DB.
   - **Revocation Check:** Asserts `token_payload["token_version"] == user.token_version`. If mismatched, raises `401 Unauthorized`.
   - Rotates and sets new `access_token` cookie.

5. **`POST /api/v1/auth/logout`**
   - Increments `user.token_version += 1` in DB (invalidates all active refresh tokens for this user).
   - Deletes `access_token` and `refresh_token` cookies with `max_age=0`.

6. **`GET /api/v1/auth/me`**
   - Dependency `get_current_user` extracts and validates access token.
   - Returns `{ "id": "...", "email": "...", "full_name": "...", "avatar_url": "...", "provider": "..." }`.

### 4.3 RBAC & Workspace Scoping Dependencies

```python
async def get_current_user(...) -> User:
    # Extracts access_token cookie or Bearer header, validates JWT, fetches active User

async def require_workspace_read(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Workspace:
    # Query workspace joined with workspace_members
    # Allowed roles: "owner", "editor", "viewer"
    # Raises 404/403 if user is not a member

async def require_workspace_write(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Workspace:
    # Allowed roles: "owner", "editor" only
    # Raises 403 Forbidden if user is only a "viewer"
```

**Route Scoping:**
- Read routes (`GET /workspaces/{id}`, `GET /workspaces/{id}/graph`, `GET /workspaces/{id}/files`, `GET /workspaces/{id}/mastery`): use `require_workspace_read`.
- Write/Mutate routes (`POST /workspaces/{id}/graph`, `POST /chat/stream`, `POST /files/upload`, `POST /curator/trigger`): use `require_workspace_write`.

---

## 5. Frontend UI & Client Architecture

### 5.1 Unified API Client (`apps/web/src/lib/apiClient.ts`)
Refactors scattered `fetch("http://localhost:8300/...")` calls across the codebase into a robust client:
```typescript
export async function apiFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = normalizedEndpoint.startsWith("/api/v1") 
    ? normalizedEndpoint 
    : `/api/v1${normalizedEndpoint}`;

  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  // Transparent 401 Silent Refresh
  if (response.status === 401 && !url.includes("/auth/")) {
    const refreshRes = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (refreshRes.ok) {
      // Replay original request once
      const retryResponse = await fetch(url, {
        ...init,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
      if (retryResponse.ok) return retryResponse.json();
    } else {
      // Refresh failed -> session expired, redirect to login
      if (typeof window !== "undefined") {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "API request failed");
  }

  return response.json();
}
```

### 5.2 Next.js Route Guarding Middleware (`apps/web/src/middleware.ts`)
- Protects `/` and `/w/:path*`.
- Checks for presence of `access_token` or `refresh_token` in cookies.
- If missing, redirects to `/login?next=${encodeURIComponent(pathname)}`.
- If user has active auth cookies and visits `/login`, redirects to `/` or their last workspace.

### 5.3 Dedicated Login Page (`apps/web/src/app/login/page.tsx`)
- Dark, centered card matching GraphMind dark theme.
- Google One-Tap + branded "Continue with Google" button.
- Divider: `"or continue with email"`.
- Tabbed Email / Password interface (Sign In vs Create Account).
- Dynamic error banners and loading states.

### 5.4 Navbar Profile Dropdown (`components/layout/Navbar.tsx`)
- Displays user's Google avatar image or initials badge.
- Dropdown menu options:
  - User name and email display.
  - "Workspace Settings" modal trigger.
  - "Sign Out" button (calls `POST /api/v1/auth/logout`, clears state, and redirects to `/login`).

---

## 6. Testing & Verification Plan

### 6.1 Backend Tests (`apps/api/tests/`)
- `test_auth_security.py`:
  - `bcrypt` hashing, salted hashes, and constant-time match tests.
  - Threadpool Google ID token verification unit tests.
  - JWT token generation and validation.
- `test_auth_endpoints.py`:
  - Register with email + password -> 201 + cookies set.
  - Conflict on duplicate email -> 409.
  - Password login -> 200 + cookies set.
  - Invalid password -> 401.
  - Logout increments `token_version` -> subsequent `/auth/refresh` with previous refresh token fails with 401.
  - Google OAuth verification endpoint (mocked) -> sets session cookies.
- `test_workspace_rbac.py`:
  - User A creates workspace -> User B cannot read or write (403/404).
  - Viewer role can read nodes/edges but gets 403 on chat streaming or file uploading.

### 6.2 Frontend Tests (`apps/web/`)
- `apiClient.test.ts`: Tests `credentials: "include"`, automatic 401 interception, and token refresh replay.
- `middleware.test.ts`: Verifies unauthenticated redirects to `/login?next=...` and static file pass-through.
- `login.test.tsx`: Tests tab switching, form validation, and login triggers.
- Production build: `pnpm build` passing with zero errors.
