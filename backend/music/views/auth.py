from urllib.parse import urlencode

from django.conf import settings
from django.http import HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt
import requests

from music.models import EndUser

from .shared import (
    _frontend_redirect_url,
    _json_error,
    _parse_json_body,
    _safe_next_path,
    _serialize_user,
)

try:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token
except ImportError:  # pragma: no cover - exercised in runtime environments without google-auth
    google_requests = None
    id_token = None


def _google_oauth_url(next_path):
    client_id = settings.GOOGLE_CLIENT_ID.strip()
    redirect_uri = settings.GOOGLE_REDIRECT_URI.strip()
    client_secret = settings.GOOGLE_CLIENT_SECRET.strip()
    if not client_id or not redirect_uri or not client_secret:
        raise RuntimeError("Google OAuth redirect flow is not configured.")

    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
            "state": _safe_next_path(next_path),
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


def _exchange_google_code(code):
    if id_token is None or google_requests is None:
        raise RuntimeError("google-auth dependency is not installed.")

    client_id = settings.GOOGLE_CLIENT_ID.strip()
    client_secret = settings.GOOGLE_CLIENT_SECRET.strip()
    redirect_uri = settings.GOOGLE_REDIRECT_URI.strip()
    if not client_id or not client_secret or not redirect_uri:
        raise RuntimeError("Google OAuth redirect flow is not configured.")

    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=30,
    )
    token_response.raise_for_status()
    token_data = token_response.json()

    if token_data.get("error"):
        message = token_data.get("error_description") or token_data["error"]
        raise ValueError(message)

    google_id_token = token_data.get("id_token")
    if not google_id_token:
        raise ValueError("Google token response did not include an id_token.")

    return id_token.verify_oauth2_token(
        google_id_token,
        google_requests.Request(),
        client_id,
    )


def _verify_google_credential(credential):
    if id_token is None or google_requests is None:
        raise RuntimeError("google-auth dependency is not installed.")

    audience = settings.GOOGLE_CLIENT_ID.strip()
    if not audience:
        raise RuntimeError("GOOGLE_CLIENT_ID is not configured.")

    return id_token.verify_oauth2_token(
        credential,
        google_requests.Request(),
        audience,
    )


@csrf_exempt
def google_auth(request):
    if request.method != "POST":
        return _json_error("Method not allowed", 405)

    payload = _parse_json_body(request)
    if payload is None:
        return _json_error("Invalid JSON payload", 400)

    credential = str(payload.get("credential", "")).strip()
    if not credential:
        return _json_error("credential is required", 400)

    try:
        token_info = _verify_google_credential(credential)
    except ValueError:
        return _json_error("Invalid Google credential", 401)
    except RuntimeError as exc:
        return _json_error(str(exc), 500)

    email = str(token_info.get("email", "")).strip().lower()
    name = str(token_info.get("name", "")).strip() or "Google User"
    if not email:
        return _json_error("Google account email is missing", 400)

    user, created = EndUser.objects.get_or_create(
        email=email,
        defaults={"name": name},
    )
    if not created and name and user.name != name:
        user.name = name
        user.save(update_fields=["name"])

    return JsonResponse(_serialize_user(user), status=200)


def google_login_redirect(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    try:
        target = _google_oauth_url(request.GET.get("next", "/"))
    except RuntimeError as exc:
        return _json_error(str(exc), 500)

    return HttpResponseRedirect(target)


def google_login_callback(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    next_path = _safe_next_path(request.GET.get("state", "/"))
    error = request.GET.get("error")
    if error:
        return HttpResponseRedirect(
            _frontend_redirect_url(
                next_path,
                {
                    "google_auth": "error",
                    "error": error,
                },
            )
        )

    code = str(request.GET.get("code", "")).strip()
    if not code:
        return HttpResponseRedirect(
            _frontend_redirect_url(
                next_path,
                {
                    "google_auth": "error",
                    "error": "missing_code",
                },
            )
        )

    try:
        token_info = _exchange_google_code(code)
    except ValueError as exc:
        return HttpResponseRedirect(
            _frontend_redirect_url(
                next_path,
                {
                    "google_auth": "error",
                    "error": str(exc),
                },
            )
        )
    except RuntimeError as exc:
        return HttpResponseRedirect(
            _frontend_redirect_url(
                next_path,
                {
                    "google_auth": "error",
                    "error": str(exc),
                },
            )
        )
    except Exception as exc:
        return HttpResponseRedirect(
            _frontend_redirect_url(
                next_path,
                {
                    "google_auth": "error",
                    "error": f"Google sign-in failed: {exc}",
                },
            )
        )

    email = str(token_info.get("email", "")).strip().lower()
    name = str(token_info.get("name", "")).strip() or "Google User"
    if not email:
        return HttpResponseRedirect(
            _frontend_redirect_url(
                next_path,
                {
                    "google_auth": "error",
                    "error": "missing_email",
                },
            )
        )

    user, created = EndUser.objects.get_or_create(
        email=email,
        defaults={"name": name},
    )
    if not created and name and user.name != name:
        user.name = name
        user.save(update_fields=["name"])

    return HttpResponseRedirect(
        _frontend_redirect_url(
            next_path,
            {
                "google_auth": "success",
                "user_id": str(user.user_id),
                "name": user.name,
                "email": user.email,
                "generation_quota": str(user.generation_quota),
            },
        )
    )
