from django.db import models

from .enums import GenerationStatus, PrivacyLevel
from .users import EndUser


class ShareableContent(models.Model):
    class Meta:
        abstract = True


class Album(ShareableContent):
    album_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    created_date = models.DateTimeField(auto_now_add=True)
    privacy_level = models.CharField(
        max_length=50,
        choices=PrivacyLevel.choices,
        default=PrivacyLevel.PRIVATE,
    )

    creator = models.ForeignKey(
        EndUser,
        on_delete=models.CASCADE,
        related_name="albums",
    )

    def __str__(self):
        return self.name


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
