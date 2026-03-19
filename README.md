# Chitara

Chitara is a web-based platform for AI-generated music.

## Tech Stack

- Python
- Django
- PostgreSQL

## Prerequisites

- Python 3.10+
- PostgreSQL 14+
- pip

## Install and Run

1. Clone the project and move into the backend folder.

```bash
git clone https://github.com/Yatichapat/chitara.git
cd chitara/backend
```

2. Create virtual environment.

```bash
python3 -m venv .venv
source .venv/bin/activate
```

3. Install dependencies.

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

6. Run migrations.

```bash
python manage.py migrate
```

7. (Optional) Seed sample data.

```bash
python manage.py seed
```

8. Start the development server.

```bash
python manage.py runserver
```

## Quick Check

- Open http://127.0.0.1:8000/songs/
- Django admin is at http://127.0.0.1:8000/admin/
