# Chitara

Chitara is a web-based platform for AI-generated music.

## Install and Run

1. Clone the project and move into the backend folder.

```bash
git clone https://github.com/Yatichapat/chitara.git
cd chitara/backend
```

2. Create virtual environment.

```bash
python -m venv .venv
source .venv/bin/activate
```

3. Install dependencies.

```bash
pip install -r requirements.txt
```

4. Run migrations.

```bash
python manage.py migrate
```

5. (Optional) Seed sample data.

```bash
python manage.py seed
```

6. Create admin superuser
```bash
python manage.py createsuperuser

Enter:
- Username
- Email
- Password
```

7. Start the development server and log in to Admin.

```bash
python manage.py runserver
```

8. In a separate terminal, move into the frontend folder, install dependencies, and start the Next.js app.

```bash
cd ../frontend
npm install
npm run dev
```

The frontend runs on http://127.0.0.1:3000/ by default.

## Generator Modes

Chitara reads generator settings from `backend/.env`.

### Mock Mode

Mock mode is the default and does not require any external API key. Set:

```env
GENERATOR_STRATEGY=mock
```

### Suno Mode

To use Suno, set:

```env
GENERATOR_STRATEGY=suno
SUNO_API_KEY=your_suno_api_key_here
SUNO_CALLBACK_URL=
```

Set `SUNO_CALLBACK_URL` only if your Suno provider setup requires a callback.

### Suno Callback URL (If Needed)

If Suno requires a callback endpoint, configure a public HTTPS URL in `backend/.env`:

```env
SUNO_CALLBACK_URL=https://your-public-domain.com/suno/webhook
```

Example using Cloudflare Tunnel (local development):

1. Install `cloudflared` (macOS):

```bash
brew install cloudflared
```

2. Start your Django backend on port `8000`, then run:

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

3. Copy the generated public URL, for example:

```text
https://abc123-example.trycloudflare.com
```

4. Set your callback URL in `backend/.env` (use your webhook path):

```env
SUNO_CALLBACK_URL=https://abc123-example.trycloudflare.com/suno/webhook
```

Alternative with ngrok:

```bash
ngrok http 8000
```

Then set:

```env
SUNO_CALLBACK_URL=https://your-ngrok-subdomain.ngrok-free.app/suno/webhook
```

Notes:

- `SUNO_CALLBACK_URL` must be a public `https://` URL.
- The callback URL should point to a real webhook endpoint in your backend.
- This project currently uses polling for generation status by default, so callback is optional unless your Suno setup requires it.

### Where to Put the Suno API Key

Put the key in `backend/.env`. That file is already ignored by git, so the secret stays local and must not be committed.

## Google OAuth Login Setup

This project supports Google OAuth login from the sidebar.

1. Create a Google OAuth Client ID in Google Cloud Console.
2. Add authorized JavaScript origins for local development, for example:
	- `http://127.0.0.1:3000`
	- `http://localhost:3000`
3. Set the same client ID in backend and frontend env files:

`backend/.env`

```env
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

`frontend/.env.local`

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
BACKEND_BASE_URL=http://127.0.0.1:8000
```

4. Restart backend and frontend dev servers after changing env values.

Notes:

- The frontend obtains a Google ID credential and sends it to backend `/api/auth/google/`.
- Backend verifies the credential and creates/updates the user in `EndUser`.

## Quick Check

- Django admin is at http://127.0.0.1:8000/admin/
