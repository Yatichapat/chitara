import json

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from music.models import Album, EndUser, GenerationStatus, Song

def user(request):
    return HttpResponse("Welcome to the User Page!")

def album(request):
    return HttpResponse("Welcome to the Album Page!")


def _serialize_song(song):
    return {
        "song_id": song.song_id,
        "title": song.title,
        "description": song.description,
        "created_date": song.created_date.isoformat(),
        "audio_file_path": song.audio_file_path,
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


def get_songs(request):
    try:
        songs = [_serialize_song(song) for song in Song.objects.all()]
        return JsonResponse({"songs": songs})
    except Exception as e:
        return JsonResponse({"error": f"Error occurred: {e}"}, status=500)

def create_song(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    data = _parse_json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

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
        return JsonResponse(
            {"error": f"Missing required fields: {', '.join(missing_fields)}"},
            status=400,
        )

    try:
        creator = EndUser.objects.get(pk=data["creator_id"])
    except EndUser.DoesNotExist:
        return JsonResponse({"error": "creator_id does not exist"}, status=400)

    generation_status = data.get("generation_status", GenerationStatus.PENDING)
    if generation_status not in GenerationStatus.values:
        return JsonResponse({"error": "Invalid generation_status"}, status=400)

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
            return JsonResponse({"error": "One or more album IDs are invalid"}, status=400)
        song.albums.set(albums)

    return JsonResponse(_serialize_song(song), status=201)


def update_song(request, song_id):
    if request.method not in ["PUT", "PATCH"]:
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        song = Song.objects.get(pk=song_id)
    except Song.DoesNotExist:
        return JsonResponse({"error": "Song not found"}, status=404)

    data = _parse_json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    if "creator_id" in data:
        try:
            song.creator = EndUser.objects.get(pk=data["creator_id"])
        except EndUser.DoesNotExist:
            return JsonResponse({"error": "creator_id does not exist"}, status=400)

    if "generation_status" in data:
        if data["generation_status"] not in GenerationStatus.values:
            return JsonResponse({"error": "Invalid generation_status"}, status=400)
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
            return JsonResponse({"error": "One or more album IDs are invalid"}, status=400)
        song.albums.set(albums)

    song.save()
    return JsonResponse(_serialize_song(song))


def delete_song(request, song_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    deleted_count, _ = Song.objects.filter(pk=song_id).delete()
    if deleted_count == 0:
        return JsonResponse({"error": "Song not found"}, status=404)

    return JsonResponse({}, status=204)