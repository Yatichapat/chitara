from urllib.parse import urlencode, urljoin
import json

from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone

from music.models import Album, EndUser, GenerationStatus, Invitation, PrivacyLevel, SharedLink


def _json_error(message, status):
    return JsonResponse({"error": message}, status=status)


def _normalize_generation_status(provider_status):
    if not provider_status:
        return GenerationStatus.PENDING

    normalized = str(provider_status).lower()
    if normalized == "pending":
        return GenerationStatus.PENDING
    if normalized in {"processing", "text_success", "first_success", "in_progress"}:
        return GenerationStatus.PROCESSING
    if normalized in {"success", "completed"}:
        return GenerationStatus.COMPLETED
    if "fail" in normalized or normalized == "error":
        return GenerationStatus.FAILED

    return GenerationStatus.PROCESSING


def _extract_audio_file_path(result):
    if result.get("audio_url"):
        return result["audio_url"]

    def _extract_from_node(node):
        audio_keys = [
            "audioUrl",
            "audio_url",
            "streamAudioUrl",
            "stream_audio_url",
            "sourceAudioUrl",
            "source_audio_url",
        ]

        if isinstance(node, dict):
            for key in audio_keys:
                value = node.get(key)
                if value:
                    return value

            for value in node.values():
                nested_value = _extract_from_node(value)
                if nested_value:
                    return nested_value

        if isinstance(node, list):
            for item in node:
                nested_value = _extract_from_node(item)
                if nested_value:
                    return nested_value

        return ""

    raw_response = result.get("raw_response", {})
    extracted_url = _extract_from_node(raw_response.get("data"))
    if extracted_url:
        return extracted_url

    extracted_url = _extract_from_node(raw_response)
    if extracted_url:
        return extracted_url

    return ""


def _serialize_song(song):
    return {
        "song_id": song.song_id,
        "title": song.title,
        "description": song.description,
        "created_date": song.created_date.isoformat(),
        "audio_file_path": song.audio_file_path,
        "generation_task_id": song.generation_task_id,
        "generation_status": song.generation_status,
        "privacy_level": song.privacy_level,
        "invited_emails": _get_song_invited_emails(song),
        "creator_generation_quota": song.creator.generation_quota,
        "genre": song.genre,
        "mood": song.mood,
        "occasion": song.occasion,
        "creator_id": song.creator_id,
        "albums": list(song.albums.values_list("album_id", flat=True)),
    }


def _serialize_album(album):
    return {
        "album_id": album.album_id,
        "name": album.name,
        "created_date": album.created_date.isoformat(),
        "privacy_level": album.privacy_level,
        "creator_id": album.creator_id,
        "song_count": album.songs.count(),
    }


def _serialize_user(user):
    return {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "generation_quota": user.generation_quota,
    }


def _parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return None


def _get_creator(creator_id):
    try:
        return EndUser.objects.get(pk=creator_id)
    except EndUser.DoesNotExist:
        return None


def _get_default_creator():
    return EndUser.objects.order_by("user_id").first()


def _get_albums(album_ids):
    albums = list(Album.objects.filter(album_id__in=album_ids))
    if len(albums) != len(set(album_ids)):
        return None
    return albums


def _normalize_email(value):
    return str(value or "").strip().lower()


def _normalize_invited_emails(values):
    if values is None:
        return []

    if isinstance(values, str):
        raw_values = values.replace("\n", ",").split(",")
    elif isinstance(values, list):
        raw_values = values
    else:
        return None

    emails = []
    seen = set()
    for value in raw_values:
        email = _normalize_email(value)
        if not email or email in seen:
            continue
        if "@" not in email:
            return None
        emails.append(email)
        seen.add(email)

    return emails


def _get_song_shared_link(song):
    link = song.shared_links.order_by("link_id").first()
    if link is not None:
        return link

    return SharedLink.objects.create(
        content=song,
        privacy_level=song.privacy_level,
        expiration_date=timezone.now() + timezone.timedelta(days=3650),
    )


def _get_song_invited_emails(song):
    link = song.shared_links.order_by("link_id").first()
    if link is None:
        return []

    return list(
        link.invitations.order_by("email").values_list("email", flat=True)
    )


def _set_song_invited_emails(song, emails):
    link = _get_song_shared_link(song)
    link.invitations.all().delete()
    Invitation.objects.bulk_create(
        [Invitation(link=link, email=email) for email in emails]
    )
    return link


def _sync_song_shared_link(song):
    link = _get_song_shared_link(song)
    link.privacy_level = song.privacy_level
    if link.expiration_date <= timezone.now():
        link.expiration_date = timezone.now() + timezone.timedelta(days=3650)
    link.save(update_fields=["privacy_level", "expiration_date"])
    return link


def _normalize_privacy_level(value):
    if value == "invite":
        return PrivacyLevel.INVITE_ONLY
    if value in PrivacyLevel.values:
        return value
    return None


def _update_song_from_generation(song, result):
    task_id = result.get("task_id")
    if task_id:
        song.generation_task_id = task_id
    song.generation_status = _normalize_generation_status(result.get("status"))

    audio_file_path = _extract_audio_file_path(result)
    if audio_file_path:
        song.audio_file_path = audio_file_path

    song.save()
    return song


def _safe_next_path(next_path):
    value = str(next_path or "").strip()
    if not value:
        return "/"

    if value.startswith("//"):
        return "/"

    if value.startswith("http://") or value.startswith("https://"):
        return "/"

    if not value.startswith("/"):
        return "/"

    return value


def _frontend_redirect_url(next_path, query_params=None):
    base_url = settings.FRONTEND_URL.strip() or "http://127.0.0.1:3000"
    safe_next = _safe_next_path(next_path)
    target = urljoin(base_url.rstrip("/") + "/", safe_next.lstrip("/"))

    if query_params:
        target = f"{target}?{urlencode(query_params)}"

    return target
