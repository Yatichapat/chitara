import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from music.models import (
    EndUser,
    Album,
    Song,
    SharedLink,
    Invitation,
    PrivacyLevel,
    GenerationStatus,
)

fake = Faker()


class Command(BaseCommand):
    help = "Seed database with mock data"

    def handle(self, *args, **kwargs):

        self.stdout.write("Deleting old data...")

        Invitation.objects.all().delete()
        SharedLink.objects.all().delete()
        Song.objects.all().delete()
        Album.objects.all().delete()
        EndUser.objects.all().delete()

        self.stdout.write("Creating users...")

        users = []
        for _ in range(5):
            user = EndUser.objects.create(
                name=fake.name(),
                email=fake.unique.email(),
                generation_quota=random.randint(5, 20),
            )
            users.append(user)

        genres = ["Pop", "Rock", "Jazz", "Lo-fi", "Hip Hop"]
        moods = ["Happy", "Sad", "Relaxed", "Energetic"]
        occasions = ["Study", "Workout", "Party", "Chill"]

        albums = []
        songs = []
        links = []

        self.stdout.write("Creating albums...")

        for user in users:
            for _ in range(3):
                album = Album.objects.create(
                    name=fake.word().capitalize() + " Album",
                    creator=user,
                )
                albums.append(album)

        self.stdout.write("Creating songs...")

        for user in users:
            user_albums = [a for a in albums if a.creator_id == user.user_id]
            for _ in range(8):
                song = Song.objects.create(
                    title=fake.word().capitalize() + " Song",
                    description=fake.sentence(),
                    audio_file_path=f"/audio/{fake.word()}.mp3",
                    generation_status=random.choice(
                        GenerationStatus.values
                    ),
                    genre=random.choice(genres),
                    mood=random.choice(moods),
                    occasion=random.choice(occasions),
                    creator=user,
                )

                album_count = random.randint(1, min(3, len(user_albums)))
                song.albums.add(*random.sample(user_albums, album_count))
                songs.append(song)

        self.stdout.write("Creating shared links...")

        for song in songs:
            link = SharedLink.objects.create(
                privacy_level=random.choice(PrivacyLevel.values),
                expiration_date=timezone.now()
                + timedelta(days=random.randint(1, 30)),
                content=song,
            )
            links.append(link)

        self.stdout.write("Creating invitations...")

        for link in links:
            for _ in range(random.randint(1, 3)):
                Invitation.objects.create(
                    link=link,
                    email=fake.email(),
                )

        self.stdout.write(
            self.style.SUCCESS("Database seeded successfully!")
        )