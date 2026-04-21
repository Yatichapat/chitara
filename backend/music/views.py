import json

from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

from music.models import Album, EndUser, GenerationStatus, Song

from .generation.factory import get_song_generator


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
        "genre": song.genre,
        "mood": song.mood,
        "occasion": song.occasion,
        "creator_id": song.creator_id,
        "albums": list(song.albums.values_list("album_id", flat=True)),
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

    generator = get_song_generator()
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

    generator = get_song_generator()
    try:
        result = generator.get_status(task_id)
        _update_song_from_generation(song, result)
    except ValueError as exc:
        return _json_error(str(exc), 500)
    except Exception as exc:
        return _json_error(f"Status lookup failed: {exc}", 502)

    return JsonResponse(_serialize_song(song))


def user(request):
    return HttpResponse("Welcome to the User Page!")


def home(request):
    return render(request, "music/index.html")


def album(request):
    return HttpResponse("Welcome to the Album Page!")


def get_songs(request):
    try:
        songs = [_serialize_song(song) for song in Song.objects.all()]
        return JsonResponse({"songs": songs})
    except Exception as e:
        return _json_error(f"Error occurred: {e}", 500)


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
