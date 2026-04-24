from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from music.models import Album

from .shared import (
    _get_creator,
    _get_default_creator,
    _json_error,
    _parse_json_body,
    _serialize_album,
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

        creator_id = data.get("creator_id")
        creator = _get_creator(creator_id) if creator_id is not None else _get_default_creator()
        if creator is None:
            if creator_id is None:
                return _json_error("No users available to own the album", 400)
            return _json_error("creator_id does not exist", 400)

        record = Album.objects.create(name=name, creator=creator)
        return JsonResponse(_serialize_album(record), status=201)

    return _json_error("Method not allowed", 405)
