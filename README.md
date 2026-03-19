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

## Quick Check

- Django admin is at http://127.0.0.1:8000/admin/
