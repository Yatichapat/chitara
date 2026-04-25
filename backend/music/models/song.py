from django.db import models

from .album import Album
from .generation_status import GenerationStatus
from .privacy_level import PrivacyLevel
from .shareable_content import ShareableContent
from .users import EndUser


class Song(ShareableContent):
    song_id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=200)
    description = models.TextField()

    created_date = models.DateTimeField(auto_now_add=True)
    audio_file_path = models.CharField(max_length=500)
    generation_task_id = models.CharField(max_length=255, blank=True, default="")
    generation_status = models.CharField(
        max_length=50,
        default=GenerationStatus.PENDING,
        choices=GenerationStatus.choices,
    )
    privacy_level = models.CharField(
        max_length=50,
        choices=PrivacyLevel.choices,
        default=PrivacyLevel.PRIVATE,
    )
    genre = models.CharField(max_length=100)
    mood = models.CharField(max_length=100)
    occasion = models.CharField(max_length=100)

    creator = models.ForeignKey(
        EndUser,
        on_delete=models.CASCADE,
        related_name="songs",
    )

    albums = models.ManyToManyField(
        Album,
        related_name="songs",
        blank=True,
    )

    def __str__(self):
        return self.title