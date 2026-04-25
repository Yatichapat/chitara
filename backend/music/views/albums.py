from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from music.models import Album

from .shared import (
    _get_creator,
    _get_default_creator,
    _json_error,
    _normalize_email,
    _normalize_invited_emails,
    _normalize_privacy_level,
    _parse_json_body,
    _serialize_album,
    _serialize_song,
)


@csrf_exempt
def albums(request):
    if request.method == "GET":
        try:
            records = [_serialize_album(record) for record in Album.objects.all()]
            return JsonResponse({"albums": records})
        except Exception as exc:
            return _json_error(f"Error occurred: {exc}", 500)

    if request.method == "POST":
        data = _parse_json_body(request)
        if data is None:
            return _json_error("Invalid JSON payload", 400)

        name = str(data.get("name", "")).strip()
        if not name:
            return _json_error("name is required", 400)

        privacy_level = _normalize_privacy_level(data.get("privacy_level", "private"))
        if privacy_level is None:
            return _json_error("Invalid privacy_level", 400)

        creator_id = data.get("creator_id")
        creator = _get_creator(creator_id) if creator_id is not None else _get_default_creator()
        if creator is None:
            if creator_id is None:
                return _json_error("No users available to own the album", 400)
            return _json_error("creator_id does not exist", 400)

        invited_emails = _normalize_invited_emails(data.get("invited_emails", []))
        if invited_emails is None:
            return _json_error("Invalid invited_emails", 400)

        record = Album.objects.create(
            name=name,
            creator=creator,
            privacy_level=privacy_level,
            invited_emails=invited_emails,
        )
        return JsonResponse(_serialize_album(record), status=201)

    return _json_error("Method not allowed", 405)


@csrf_exempt
def update_album(request, album_id):
    if request.method not in ["PUT", "PATCH"]:
        return _json_error("Method not allowed", 405)

    try:
        album = Album.objects.get(pk=album_id)
    except Album.DoesNotExist:
        return _json_error("Album not found", 404)

    data = _parse_json_body(request)
    if data is None:
        return _json_error("Invalid JSON payload", 400)

    if "name" in data:
        name = str(data["name"]).strip()
        if not name:
            return _json_error("name cannot be blank", 400)
        album.name = name

    if "privacy_level" in data:
        privacy_level = _normalize_privacy_level(data["privacy_level"])
        if privacy_level is None:
            return _json_error("Invalid privacy_level", 400)
        album.privacy_level = privacy_level

    if "invited_emails" in data:
        invited_emails = _normalize_invited_emails(data["invited_emails"])
        if invited_emails is None:
            return _json_error("Invalid invited_emails", 400)
        album.invited_emails = invited_emails

    album.save()
    return JsonResponse(_serialize_album(album))


def shared_album(request, album_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    try:
        album = Album.objects.get(pk=album_id)
    except Album.DoesNotExist:
        return _json_error("Album not found", 404)

    if album.privacy_level == "private":
        return _json_error("This album is private", 403)

    if album.privacy_level == "invite_only":
        viewer_email = _normalize_email(request.GET.get("email"))
        owner_email = _normalize_email(album.creator.email)
        invited_emails = {_normalize_email(email) for email in album.invited_emails or []}

        if not viewer_email:
            return _json_error("Sign in with an invited email to access this album", 403)

        if viewer_email != owner_email and viewer_email not in invited_emails:
            return _json_error("This album is invite-only", 403)

    songs = [_serialize_song(song) for song in album.songs.order_by("-song_id")]
    return JsonResponse({"album": _serialize_album(album), "songs": songs})
