# Chitara

Chitara is a web app for generating AI music, organizing songs into albums, and sharing songs or albums with public, invite-only, or private access.

The project has two apps:

- `backend/`: Django API, SQLite database, Google OAuth callback handling, song generation, albums, sharing, and invite checks.
- `frontend/`: Next.js app, UI, API proxy routes, audio proxy, playback player, and shared pages.

## Requirements

- Python 3.12 or newer
- Node.js 20 or newer
- npm

## 1. Clone

All platforms:

```bash
git clone https://github.com/Yatichapat/chitara.git
cd chitara
```

## 2. Backend Setup

Create and activate a virtual environment:

Linux/macOS:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
```

Windows:

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
```

Windows (Command Prompt alternative):

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
```

Install Python dependencies (same command on Linux/macOS and Windows):

```bash
pip install -r requirements.txt
```

Create `backend/.env`:

```env
GENERATOR_STRATEGY=mock
SUNO_API_KEY=
SUNO_CALLBACK_URL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/accounts/google/login/callback/
FRONTEND_URL=http://127.0.0.1:3000
```

Run database migrations:

```bash
python manage.py migrate
```

Optional: seed local sample data:

```bash
python manage.py seed
```

Optional: create a Django admin user:

```bash
python manage.py createsuperuser
```

Start the backend:

```bash
python manage.py runserver
```

Backend URLs:

- API root: http://127.0.0.1:8000/api/
- Django admin: http://127.0.0.1:8000/admin/

## 3. Frontend Setup

Open a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
BACKEND_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

How to run with `frontend/.env.local`:

- Next.js automatically loads `.env.local` when you run `npm run dev`, `npm run build`, or `npm start`.
- Restart the frontend server after changing `.env.local`.

Start the frontend:

```bash
npm run dev
```

Frontend URL:

- http://127.0.0.1:3000

Keep both servers running:

- Django backend on `http://127.0.0.1:8000`
- Next.js frontend on `http://127.0.0.1:3000`

## Google Login Setup

Google login is needed for user-specific libraries, generation quota, invite-only sharing, and album ownership.

Follow these exact steps in Google Cloud Console:

1. Open https://console.cloud.google.com/ and sign in.
2. Click the top project selector (next to the Google Cloud logo) and choose your project.
3. In the left sidebar, click `APIs & Services`.
4. Click `OAuth consent screen`.
5. On the overview dashboard, if your Google Auth Platform not configured yet, click `Get Started`.
6. Fill in the required fields:
    - App name
    - User support email
    - Audience choose `External`
    - Developer contact email
Then click Create.
7. In the sidebar click `Clients` then `Create client` create client ID
8. For `Application type`, choose `Web application`.
9. Set a name, for example `Chitara Local Web`.
10. Under `Authorized JavaScript origins`, click `+ Add URI` and add:

```text
http://127.0.0.1:3000
http://localhost:3000
```

11. Under `Authorized redirect URIs`, click `+ Add URI` and add:

```text
http://127.0.0.1:8000/accounts/google/login/callback/
http://localhost:8000/accounts/google/login/callback/
```

12. Click `Create`.
13. Copy `Client ID` and `Client secret` from the popup.
14. Update `backend/.env` (the file you created in Backend Setup):

- Set `GOOGLE_CLIENT_ID` to the Client ID.
- Set `GOOGLE_CLIENT_SECRET` to the Client secret.
- Keep `GOOGLE_REDIRECT_URI` as `http://localhost:8000/accounts/google/login/callback/`.
- Keep `FRONTEND_URL` as `http://127.0.0.1:3000`.

19. Update `frontend/.env.local` (the file you created in Frontend Setup):

- Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the same Google Client ID.
- Keep `BACKEND_BASE_URL` as `http://127.0.0.1:8000`.

20. Restart both backend and frontend after env changes.

Runtime flow in this project:

- Frontend opens Google Sign-In prompt.
- Frontend sends Google credential to `POST /api/auth/google`.
- Next.js proxy forwards it to Django `POST /api/auth/google/`.
- Django verifies the token, creates/updates `EndUser`, and returns user data.

## Music Generation Modes

Chitara reads generation settings from `backend/.env`.

### Mock Mode

Mock mode is the easiest local setup and does not require a Suno API key.

```env
GENERATOR_STRATEGY=mock
```

Generated songs complete immediately and use a sample URL.

### Suno Mode

To use Suno:

```env
GENERATOR_STRATEGY=suno
SUNO_API_KEY=your_suno_api_key
SUNO_CALLBACK_URL=
```

Notes:

- `SUNO_API_KEY` stays in `backend/.env`; do not commit it.
- If Suno generation fails, the backend falls back to mock generation.
- `SUNO_CALLBACK_URL` is optional for the current polling flow unless your Suno provider requires it.

### Public Callback URL

If your Suno setup requires a public callback URL, expose the Django backend with a tunnel.

Example with Cloudflare Tunnel:

Linux/macOS:

```bash
brew install cloudflared
cloudflared tunnel --url http://127.0.0.1:8000
```

Windows (PowerShell):

```powershell
# Install with winget if available
winget install Cloudflare.cloudflared

# Or install with Chocolatey if available
# choco install cloudflared

cloudflared tunnel --url http://127.0.0.1:8000
```

Then set:

```env
SUNO_CALLBACK_URL=https://your-public-tunnel-url.example.com/suno/webhook
```

Restart Django after changing the env file.

## Common Commands

Use these after initial setup.

Backend (Linux/macOS):

```bash
cd backend
source .venv/bin/activate
python manage.py runserver
```

Backend (Windows PowerShell):

```powershell
cd backend
.venv\Scripts\Activate.ps1
python manage.py runserver
```

Frontend (Linux/macOS):

```bash
cd frontend
npm run dev
```

Frontend (Windows PowerShell):

```powershell
cd frontend
npm run dev
```

Quality checks (from `frontend`):

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

## How The Local App Works

- The frontend calls local Next.js API routes under `/api/...`.
- Next.js proxies those requests to Django using `BACKEND_BASE_URL`.
- Songs and albums are owned by the logged-in Google user.
- Each user has their own generation quota.
- Albums and songs can be `public`, `invite_only`, or `private`.
- Invite-only share links require the viewer to sign in with Google so the backend can check the viewer email.
- Shared album pages use the same playback player as the main app.

## Troubleshooting

If the frontend cannot reach the backend, check `frontend/.env.local` and confirm `BACKEND_BASE_URL=http://127.0.0.1:8000`.

If Google login fails, check:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `backend/.env`.
- The Google redirect URI exactly matches `http://localhost:8000/accounts/google/login/callback/`.
- `FRONTEND_URL` points to the running frontend.
- The backend was restarted after env changes.

If generated audio does not play:

- Confirm the song has an `audio_file_path`.
- Confirm the backend is running.
- In mock mode, the browser/server must be able to reach the sample MP3 URL.

If database fields are missing or API responses look old:

Linux/macOS:

```bash
cd backend
source .venv/bin/activate
python manage.py migrate
```

Windows (PowerShell):

```powershell
cd backend
.venv\Scripts\Activate
python manage.py migrate
```
