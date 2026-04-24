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
pip install --upgrade pip
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
```

You can also set `SUNO_CALLBACK_URL` if your Suno setup uses a callback endpoint.

### Where to Put the Suno API Key

Put the key in `backend/.env`. That file is already ignored by git, so the secret stays local and must not be committed.

## Quick Check

- Django admin is at http://127.0.0.1:8000/admin/
