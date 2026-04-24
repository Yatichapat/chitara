from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from music.models import Album, EndUser, GenerationStatus, Song

from ..generation.factory import SongGeneratorContext
from .shared import (
    _get_albums,
    _get_creator,
    _get_default_creator,
    _json_error,
    _parse_json_body,
    _serialize_song,
    _update_song_from_generation,
)


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

    album_ids = data.get("albums", [])
    albums = _get_albums(album_ids)
    if albums is None:
        return _json_error("One or more album IDs are invalid", 400)

    song = Song.objects.create(
        title=data["title"],
        description=data.get("description", data["prompt"]),
        audio_file_path="",
        generation_task_id="",
        generation_status=GenerationStatus.PENDING,
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
        result = generator.generate(request_data)
        _update_song_from_generation(song, result)
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
        result = generator.get_status(task_id)
        _update_song_from_generation(song, result)
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

    song = Song.objects.create(
        title=data["title"],
        description=data["description"],
        audio_file_path=data["audio_file_path"],
        generation_status=generation_status,
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
        album_ids = data["albums"]
        albums = list(Album.objects.filter(album_id__in=album_ids))
        if len(albums) != len(set(album_ids)):
            return _json_error("One or more album IDs are invalid", 400)
        song.albums.set(albums)

    song.save()
    return JsonResponse(_serialize_song(song))


@csrf_exempt
def delete_song(request, song_id):
    if request.method != "DELETE":
        return _json_error("Method not allowed", 405)

    deleted_count, _ = Song.objects.filter(pk=song_id).delete()
    if deleted_count == 0:
        return _json_error("Song not found", 404)

    return JsonResponse({}, status=204)
