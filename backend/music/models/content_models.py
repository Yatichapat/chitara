from django.db import models

from .enums import GenerationStatus
from .users import EndUser


class ShareableContent(models.Model):
    class Meta:
        abstract = True


class Album(ShareableContent):
    album_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    created_date = models.DateTimeField(auto_now_add=True)

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
    generation_status = models.CharField(
        max_length=50,
        default=GenerationStatus.PENDING,
        choices=GenerationStatus.choices,
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
