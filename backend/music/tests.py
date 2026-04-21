from django.test import TestCase
from django.test.utils import override_settings
from django.urls import reverse
from unittest.mock import MagicMock, patch

from music.generation.factory import get_song_generator
from music.generation.mock_generator import MockSongGeneratorStrategy
from music.models import Album, EndUser, GenerationStatus, Song


class SongCUDViewTests(TestCase):
    def setUp(self):
        self.user = EndUser.objects.create(
            name="Test User",
            email="test@example.com",
            generation_quota=10,
        )
        self.album = Album.objects.create(name="My Album", creator=self.user)
        self.song = Song.objects.create(
            title="Initial Song",
            description="Initial description",
            audio_file_path="/audio/initial.mp3",
            genre="Pop",
            mood="Happy",
            occasion="Study",
            creator=self.user,
        )

    def test_create_song_success(self):
        payload = {
            "title": "New Song",
            "description": "Generated song",
            "audio_file_path": "/audio/new.mp3",
            "genre": "Lo-fi",
            "mood": "Relaxed",
            "occasion": "Chill",
            "creator_id": self.user.user_id,
            "albums": [self.album.album_id],
        }

        response = self.client.post(
            reverse("create_song"),
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["title"], payload["title"])
        self.assertEqual(data["creator_id"], self.user.user_id)
        self.assertIn(self.album.album_id, data["albums"])
        self.assertTrue(Song.objects.filter(title="New Song").exists())

    def test_update_song_success(self):
        payload = {
            "title": "Updated Song",
            "mood": "Energetic",
            "albums": [self.album.album_id],
        }

        response = self.client.patch(
            reverse("update_song", kwargs={"song_id": self.song.song_id}),
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.song.refresh_from_db()
        self.assertEqual(self.song.title, "Updated Song")
        self.assertEqual(self.song.mood, "Energetic")
        self.assertIn(self.album, self.song.albums.all())

    def test_delete_song_success(self):
        response = self.client.delete(
            reverse("delete_song", kwargs={"song_id": self.song.song_id})
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Song.objects.filter(song_id=self.song.song_id).exists())

    def test_home_page_renders(self):
        response = self.client.get(reverse("home"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Chitara")


class SongGeneratorStrategyTests(TestCase):
    @override_settings(GENERATOR_STRATEGY="mock")
    def test_factory_returns_mock_strategy(self):
        self.assertIsInstance(get_song_generator(), MockSongGeneratorStrategy)

    @override_settings(GENERATOR_STRATEGY="suno")
    def test_factory_returns_suno_strategy(self):
        self.assertEqual(
            get_song_generator().__class__.__name__,
            "SunoSongGeneratorStrategy",
        )

    def test_mock_strategy_returns_deterministic_output(self):
        result = MockSongGeneratorStrategy().generate(
            {
                "prompt": "A calm piano melody",
                "title": "Study Session",
                "style": ["piano", "ambient"],
            }
        )

        self.assertEqual(result["task_id"], "mock-task-12345")
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["audio_url"], "https://example.com/mock_song.mp3")
        self.assertEqual(result["title"], "Study Session")

    @override_settings(SUNO_API_KEY="test-token")
    @override_settings(SUNO_CALLBACK_URL="https://example.com/webhooks/suno")
    def test_suno_strategy_extracts_task_id_from_nested_response(self):
        from music.generation.suno_generator import SunoSongGeneratorStrategy

        response = MagicMock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "data": {
                "taskId": "suno-task-12345",
                "status": "PENDING",
            }
        }

        requests_module = MagicMock()
        requests_module.post.return_value = response

        strategy = SunoSongGeneratorStrategy()
        with patch.object(strategy, "_requests_module", return_value=requests_module):
            result = strategy.generate(
                {
                    "prompt": "A calm piano melody",
                    "title": "Study Session",
                    "genre": "Ambient",
                    "mood": "Calm",
                }
            )

        self.assertEqual(result["task_id"], "suno-task-12345")
        self.assertEqual(result["status"], "pending")
        self.assertEqual(result["raw_response"], response.json.return_value)
        requests_module.post.assert_called_once()

    @override_settings(SUNO_API_KEY="test-token")
    @override_settings(SUNO_CALLBACK_URL="https://example.com/webhooks/suno")
    def test_suno_strategy_raises_on_api_error(self):
        from music.generation.suno_generator import SunoSongGeneratorStrategy

        response = MagicMock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "code": 400,
            "msg": "Please enter callBackUrl.",
            "data": None,
        }

        requests_module = MagicMock()
        requests_module.post.return_value = response

        strategy = SunoSongGeneratorStrategy()
        with patch.object(strategy, "_requests_module", return_value=requests_module):
            with self.assertRaisesMessage(ValueError, "Please enter callBackUrl."):
                strategy.generate(
                    {
                        "prompt": "A calm piano melody",
                        "title": "Study Session",
                        "genre": "Ambient",
                        "mood": "Calm",
                    }
                )

        requests_module.post.assert_called_once()

    @override_settings(GENERATOR_STRATEGY="mock")
    def test_generate_song_endpoint_creates_song_record(self):
        EndUser.objects.create(
            name="Generator User",
            email="generator@example.com",
            generation_quota=10,
        )
        payload = {
            "prompt": "A calm piano melody",
            "title": "Study Session",
            "style": ["piano", "ambient"],
            "genre": "Ambient",
            "mood": "Calm",
        }

        response = self.client.post(
            reverse("generate_song"),
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["title"], "Study Session")
        self.assertEqual(data["description"], "A calm piano melody")
        self.assertEqual(data["occasion"], "general")
        self.assertEqual(data["generation_task_id"], "mock-task-12345")
        self.assertEqual(data["generation_status"], GenerationStatus.COMPLETED)
        self.assertEqual(data["audio_file_path"], "https://example.com/mock_song.mp3")
        self.assertTrue(Song.objects.filter(song_id=data["song_id"]).exists())

    @override_settings(GENERATOR_STRATEGY="mock")
    def test_generate_song_requires_some_user_if_creator_missing(self):
        payload = {
            "prompt": "A calm piano melody",
            "title": "Study Session",
            "genre": "Ambient",
            "mood": "Calm",
        }

        response = self.client.post(
            reverse("generate_song"),
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["error"],
            "No users available to own the generated song",
        )

    @override_settings(GENERATOR_STRATEGY="mock")
    def test_generation_status_endpoint_updates_existing_song(self):
        user = EndUser.objects.create(
            name="Polling User",
            email="polling@example.com",
            generation_quota=10,
        )
        song = Song.objects.create(
            title="Pending Song",
            description="Waiting on provider",
            audio_file_path="",
            generation_task_id="mock-task-12345",
            generation_status=GenerationStatus.PENDING,
            genre="Ambient",
            mood="Calm",
            occasion="Study",
            creator=user,
        )

        response = self.client.get(
            reverse("generation_status", kwargs={"task_id": "mock-task-12345"})
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        song.refresh_from_db()
        self.assertEqual(data["song_id"], song.song_id)
        self.assertEqual(data["generation_task_id"], "mock-task-12345")
        self.assertEqual(data["generation_status"], GenerationStatus.COMPLETED)
        self.assertEqual(
            data["audio_file_path"],
            "https://example.com/mock_song.mp3",
        )

    def test_generation_status_extracts_audio_from_nested_data_list(self):
        user = EndUser.objects.create(
            name="Nested Response User",
            email="nested@example.com",
            generation_quota=10,
        )
        song = Song.objects.create(
            title="Pending Suno Song",
            description="Waiting on Suno",
            audio_file_path="",
            generation_task_id="suno-task-abc",
            generation_status=GenerationStatus.PENDING,
            genre="Ambient",
            mood="Calm",
            occasion="Study",
            creator=user,
        )

        class _StubGenerator:
            def get_status(self, task_id):
                return {
                    "task_id": task_id,
                    "status": "SUCCESS",
                    "raw_response": {
                        "data": [
                            {
                                "id": "clip-1",
                                "audioUrl": "https://cdn.suno.ai/audio/final-track.mp3",
                            }
                        ]
                    },
                }

        with patch("music.views.get_song_generator", return_value=_StubGenerator()):
            response = self.client.get(
                reverse("generation_status", kwargs={"task_id": "suno-task-abc"})
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        song.refresh_from_db()
        self.assertEqual(data["generation_status"], GenerationStatus.COMPLETED)
        self.assertEqual(
            data["audio_file_path"],
            "https://cdn.suno.ai/audio/final-track.mp3",
        )
        self.assertEqual(
            song.audio_file_path,
            "https://cdn.suno.ai/audio/final-track.mp3",
        )
