from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from music.models import Album, EndUser, GenerationStatus, Song

from ..generation.factory import SongGeneratorContext
from ..generation.mock_generator import MockSongGeneratorStrategy
from .shared import (
    _get_albums,
    _get_creator,
    _get_default_creator,
    _json_error,
    _normalize_privacy_level,
    _parse_json_body,
    _serialize_song,
    _normalize_email,
    _normalize_invited_emails,
    _set_song_invited_emails,
    _sync_song_shared_link,
    _update_song_from_generation,
)


def _is_suno_generator(generator):
    return generator.__class__.__name__ == "SunoSongGeneratorStrategy"


def _mock_request_data_for_song(song):
    return {
        "prompt": song.description,
        "title": song.title,
        "genre": song.genre,
        "mood": song.mood,
    }


def _mock_generate_song(song):
    result = MockSongGeneratorStrategy().generate(_mock_request_data_for_song(song))
    _update_song_from_generation(song, result)
    song.refresh_from_db()
    return song


@csrf_exempt
def generate_song(request):
    if request.method != "POST":
        return _json_error("Method not allowed", 405)

    data = _parse_json_body(request)
    if data is None:
        return _json_error("Invalid JSON payload", 400)

    required_fields = [
        "prompt",
        "title",
        "genre",
        "mood",
    ]
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return _json_error(
            f"Missing required fields: {', '.join(missing_fields)}",
            400,
        )

    if "style" in data and not isinstance(data["style"], list):
        return _json_error("style must be a list", 400)

    creator_id = data.get("creator_id")
    creator = _get_creator(creator_id) if creator_id is not None else _get_default_creator()
    if creator is None:
        if creator_id is None:
            return _json_error("No users available to own the generated song", 400)
        return _json_error("creator_id does not exist", 400)

    if creator.generation_quota <= 0:
        return _json_error("No generation credits remaining", 403)

    album_ids = data.get("albums", [])
    albums = _get_albums(album_ids)
    if albums is None:
        return _json_error("One or more album IDs are invalid", 400)

    privacy_level = _normalize_privacy_level(data.get("privacy_level", "private"))
    if privacy_level is None:
        return _json_error("Invalid privacy_level", 400)

    if albums and "privacy_level" not in data:
        privacy_level = albums[0].privacy_level

    song = Song.objects.create(
        title=data["title"],
        description=data.get("description", data["prompt"]),
        audio_file_path="",
        generation_task_id="",
        generation_status=GenerationStatus.PENDING,
        privacy_level=privacy_level,
        genre=data["genre"],
        mood=data["mood"],
        occasion=data.get("occasion", "general"),
        creator=creator,
    )
    if albums:
        song.albums.set(albums)

    generator = SongGeneratorContext().get_generator()
    request_data = {
        "prompt": data["prompt"],
        "title": data["title"],
        "genre": data["genre"],
        "mood": data["mood"],
    }

    try:
        try:
            result = generator.generate(request_data)
        except Exception:
            if not _is_suno_generator(generator):
                raise
            result = MockSongGeneratorStrategy().generate(request_data)

        _update_song_from_generation(song, result)
        creator.generation_quota -= 1
        creator.save(update_fields=["generation_quota"])
        song.refresh_from_db()
    except ValueError as exc:
        return _json_error(str(exc), 500)
    except Exception as exc:
        song.generation_status = GenerationStatus.FAILED
        song.save(update_fields=["generation_status"])
        return _json_error(f"Song generation failed: {exc}", 502)

    return JsonResponse(_serialize_song(song), status=201)


def generation_status(request, task_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    try:
        song = Song.objects.get(generation_task_id=task_id)
    except Song.DoesNotExist:
        return _json_error("Song not found for task_id", 404)

    generator = SongGeneratorContext().get_generator()
    try:
        try:
            result = generator.get_status(task_id)
        except Exception:
            if not _is_suno_generator(generator):
                raise
            _mock_generate_song(song)
            return JsonResponse(_serialize_song(song))

        _update_song_from_generation(song, result)
        if _is_suno_generator(generator) and song.generation_status == GenerationStatus.FAILED:
            _mock_generate_song(song)
    except ValueError as exc:
        return _json_error(str(exc), 500)
    except Exception as exc:
        return _json_error(f"Status lookup failed: {exc}", 502)

    return JsonResponse(_serialize_song(song))


def get_songs(request):
    try:
        songs = [_serialize_song(song) for song in Song.objects.all()]
        return JsonResponse({"songs": songs})
    except Exception as exc:
        return _json_error(f"Error occurred: {exc}", 500)


def shared_song(request, song_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    try:
        song = Song.objects.get(pk=song_id)
    except Song.DoesNotExist:
        return _json_error("Song not found", 404)

    if song.privacy_level == "private":
        return _json_error("This song is private", 403)

    if song.privacy_level == "invite_only":
        viewer_email = _normalize_email(request.GET.get("email"))
        owner_email = _normalize_email(song.creator.email)
        invited_emails = {
            _normalize_email(email)
            for email in song.shared_links
            .filter(invitations__isnull=False)
            .values_list("invitations__email", flat=True)
        }

        if not viewer_email:
            return _json_error("Sign in with an invited email to access this song", 403)

        if viewer_email != owner_email and viewer_email not in invited_emails:
            return _json_error("This song is invite-only", 403)

    return JsonResponse(_serialize_song(song))


@csrf_exempt
def create_song(request):
    if request.method != "POST":
        return _json_error("Method not allowed", 405)

    data = _parse_json_body(request)
    if data is None:
        return _json_error("Invalid JSON payload", 400)

    required_fields = [
        "title",
        "description",
        "audio_file_path",
        "genre",
        "mood",
        "occasion",
        "creator_id",
    ]
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return _json_error(
            f"Missing required fields: {', '.join(missing_fields)}",
            400,
        )

    try:
        creator = EndUser.objects.get(pk=data["creator_id"])
    except EndUser.DoesNotExist:
        return _json_error("creator_id does not exist", 400)

    generation_status = data.get("generation_status", GenerationStatus.PENDING)
    if generation_status not in GenerationStatus.values:
        return _json_error("Invalid generation_status", 400)

    privacy_level = _normalize_privacy_level(data.get("privacy_level", "private"))
    if privacy_level is None:
        return _json_error("Invalid privacy_level", 400)

    song = Song.objects.create(
        title=data["title"],
        description=data["description"],
        audio_file_path=data["audio_file_path"],
        generation_status=generation_status,
        privacy_level=privacy_level,
        genre=data["genre"],
        mood=data["mood"],
        occasion=data["occasion"],
        creator=creator,
    )

    album_ids = data.get("albums", [])
    if album_ids:
        albums = list(Album.objects.filter(album_id__in=album_ids))
        if len(albums) != len(set(album_ids)):
            song.delete()
            return _json_error("One or more album IDs are invalid", 400)
        song.albums.set(albums)
        if "privacy_level" not in data:
            song.privacy_level = albums[0].privacy_level
            song.save(update_fields=["privacy_level"])

    return JsonResponse(_serialize_song(song), status=201)


@csrf_exempt
def update_song(request, song_id):
    if request.method not in ["PUT", "PATCH"]:
        return _json_error("Method not allowed", 405)

    try:
        song = Song.objects.get(pk=song_id)
    except Song.DoesNotExist:
        return _json_error("Song not found", 404)

    data = _parse_json_body(request)
    if data is None:
        return _json_error("Invalid JSON payload", 400)

    if "creator_id" in data:
        try:
            song.creator = EndUser.objects.get(pk=data["creator_id"])
        except EndUser.DoesNotExist:
            return _json_error("creator_id does not exist", 400)

    if "generation_status" in data:
        if data["generation_status"] not in GenerationStatus.values:
            return _json_error("Invalid generation_status", 400)
        song.generation_status = data["generation_status"]

    if "privacy_level" in data:
        privacy_level = _normalize_privacy_level(data["privacy_level"])
        if privacy_level is None:
            return _json_error("Invalid privacy_level", 400)
        song.privacy_level = privacy_level

    if "invited_emails" in data:
        invited_emails = _normalize_invited_emails(data["invited_emails"])
        if invited_emails is None:
            return _json_error("Invalid invited_emails", 400)
        _set_song_invited_emails(song, invited_emails)

    editable_fields = [
        "title",
        "description",
        "audio_file_path",
        "genre",
        "mood",
        "occasion",
    ]
    for field in editable_fields:
        if field in data:
            setattr(song, field, data[field])

    if "albums" in data:
        existing_album_ids = set(song.albums.values_list("album_id", flat=True))
        album_ids = data["albums"]
        albums = list(Album.objects.filter(album_id__in=album_ids))
        if len(albums) != len(set(album_ids)):
            return _json_error("One or more album IDs are invalid", 400)
        song.albums.set(albums)
        added_album_ids = [album_id for album_id in album_ids if album_id not in existing_album_ids]
        if added_album_ids and "privacy_level" not in data:
            added_album = next(
                (album for album in albums if album.album_id == added_album_ids[0]),
                None,
            )
            if added_album is not None:
                song.privacy_level = added_album.privacy_level

    song.save()
    if "privacy_level" in data:
        _sync_song_shared_link(song)
    return JsonResponse(_serialize_song(song))


@csrf_exempt
def delete_song(request, song_id):
    if request.method != "DELETE":
        return _json_error("Method not allowed", 405)

    deleted_count, _ = Song.objects.filter(pk=song_id).delete()
    if deleted_count == 0:
        return _json_error("Song not found", 404)

    return JsonResponse({}, status=204)
