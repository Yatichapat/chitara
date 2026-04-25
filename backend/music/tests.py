from django.test import TestCase
from django.test.utils import override_settings
from django.urls import reverse
from django.utils import timezone
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

from music.generation.factory import SongGeneratorContext
from music.generation.mock_generator import MockSongGeneratorStrategy
from music.models import Album, EndUser, GenerationStatus, Invitation, PrivacyLevel, Song


class SongCUDViewTests(TestCase):
    def setUp(self):
        self.user = EndUser.objects.create(
            name="Test User",
            email="test@example.com",
            generation_quota=10,
        )
        self.album = Album.objects.create(
            name="My Album",
            creator=self.user,
            privacy_level=PrivacyLevel.PUBLIC,
        )
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
        self.assertEqual(data["privacy_level"], PrivacyLevel.PUBLIC)
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
        self.assertEqual(self.song.privacy_level, PrivacyLevel.PUBLIC)

    def test_update_song_privacy_success(self):
        response = self.client.patch(
            reverse("update_song", kwargs={"song_id": self.song.song_id}),
            data={"privacy_level": "invite"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.song.refresh_from_db()
        self.assertEqual(self.song.privacy_level, PrivacyLevel.INVITE_ONLY)
        self.assertEqual(response.json()["privacy_level"], PrivacyLevel.INVITE_ONLY)

    def test_update_song_invited_emails_success(self):
        response = self.client.patch(
            reverse("update_song", kwargs={"song_id": self.song.song_id}),
            data={
                "privacy_level": PrivacyLevel.INVITE_ONLY,
                "invited_emails": ["Friend@Example.com", "friend@example.com", "team@example.com"],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.song.refresh_from_db()
        self.assertEqual(self.song.privacy_level, PrivacyLevel.INVITE_ONLY)
        self.assertEqual(
            response.json()["invited_emails"],
            ["friend@example.com", "team@example.com"],
        )

    def test_update_album_share_success(self):
        response = self.client.patch(
            reverse("update_album", kwargs={"album_id": self.album.album_id}),
            data={
                "privacy_level": PrivacyLevel.INVITE_ONLY,
                "invited_emails": ["Friend@Example.com", "friend@example.com"],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.album.refresh_from_db()
        self.assertEqual(self.album.privacy_level, PrivacyLevel.INVITE_ONLY)
        self.assertEqual(self.album.invited_emails, ["friend@example.com"])
        self.assertEqual(response.json()["invited_emails"], ["friend@example.com"])

    def test_shared_album_invite_only_allows_invited_email(self):
        self.album.privacy_level = PrivacyLevel.INVITE_ONLY
        self.album.invited_emails = ["friend@example.com"]
        self.album.save(update_fields=["privacy_level", "invited_emails"])
        self.song.albums.add(self.album)

        response = self.client.get(
            reverse("shared_album", kwargs={"album_id": self.album.album_id}),
            data={"email": "friend@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["album"]["album_id"], self.album.album_id)
        self.assertEqual(len(payload["songs"]), 1)

    def test_shared_album_invite_only_blocks_uninvited_email(self):
        self.album.privacy_level = PrivacyLevel.INVITE_ONLY
        self.album.invited_emails = ["friend@example.com"]
        self.album.save(update_fields=["privacy_level", "invited_emails"])

        response = self.client.get(
            reverse("shared_album", kwargs={"album_id": self.album.album_id}),
            data={"email": "stranger@example.com"},
        )

        self.assertEqual(response.status_code, 403)

    def test_shared_song_invite_only_allows_invited_email(self):
        self.song.privacy_level = PrivacyLevel.INVITE_ONLY
        self.song.save(update_fields=["privacy_level"])
        link = self.song.shared_links.create(
            privacy_level=PrivacyLevel.INVITE_ONLY,
            expiration_date=timezone.now() + timezone.timedelta(days=1),
        )
        Invitation.objects.create(link=link, email="friend@example.com")

        response = self.client.get(
            reverse("shared_song", kwargs={"song_id": self.song.song_id}),
            data={"email": "friend@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["song_id"], self.song.song_id)

    def test_shared_song_invite_only_blocks_uninvited_email(self):
        self.song.privacy_level = PrivacyLevel.INVITE_ONLY
        self.song.save(update_fields=["privacy_level"])
        link = self.song.shared_links.create(
            privacy_level=PrivacyLevel.INVITE_ONLY,
            expiration_date=timezone.now() + timezone.timedelta(days=1),
        )
        Invitation.objects.create(link=link, email="friend@example.com")

        response = self.client.get(
            reverse("shared_song", kwargs={"song_id": self.song.song_id}),
            data={"email": "stranger@example.com"},
        )

        self.assertEqual(response.status_code, 403)

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
    def test_context_returns_mock_strategy(self):
        self.assertIsInstance(
            SongGeneratorContext().get_generator(),
            MockSongGeneratorStrategy,
        )

    @override_settings(GENERATOR_STRATEGY="suno")
    def test_context_returns_suno_strategy(self):
        self.assertEqual(
            SongGeneratorContext().get_generator().__class__.__name__,
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
        self.assertEqual(
            result["audio_url"],
            "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
        )
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
    @override_settings(SUNO_CALLBACK_URL="")
    def test_suno_strategy_allows_polling_without_callback_url(self):
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
            strategy.generate(
                {
                    "prompt": "A calm piano melody",
                    "title": "Study Session",
                    "genre": "Ambient",
                    "mood": "Calm",
                }
            )

        payload = requests_module.post.call_args.kwargs["json"]
        self.assertNotIn("callBackUrl", payload)

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
        user = EndUser.objects.create(
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
        self.assertEqual(data["creator_generation_quota"], 9)
        self.assertEqual(
            data["audio_file_path"],
            "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
        )
        self.assertTrue(Song.objects.filter(song_id=data["song_id"]).exists())
        user.refresh_from_db()
        self.assertEqual(user.generation_quota, 9)

    @override_settings(GENERATOR_STRATEGY="mock")
    def test_generate_song_blocks_user_without_quota(self):
        user = EndUser.objects.create(
            name="No Quota User",
            email="no-quota@example.com",
            generation_quota=0,
        )
        payload = {
            "prompt": "A calm piano melody",
            "title": "Study Session",
            "genre": "Ambient",
            "mood": "Calm",
            "creator_id": user.user_id,
        }

        response = self.client.post(
            reverse("generate_song"),
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "No generation credits remaining")
        self.assertFalse(Song.objects.filter(title="Study Session").exists())

    @override_settings(GENERATOR_STRATEGY="suno")
    def test_generate_song_falls_back_to_mock_when_suno_generate_fails(self):
        user = EndUser.objects.create(
            name="Fallback User",
            email="fallback@example.com",
            generation_quota=10,
        )
        payload = {
            "prompt": "A calm piano melody",
            "title": "Fallback Session",
            "genre": "Ambient",
            "mood": "Calm",
            "creator_id": user.user_id,
        }

        with patch(
            "music.generation.suno_generator.SunoSongGeneratorStrategy.generate",
            side_effect=RuntimeError("Suno unavailable"),
        ):
            response = self.client.post(
                reverse("generate_song"),
                data=payload,
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["generation_status"], GenerationStatus.COMPLETED)
        self.assertEqual(
            data["audio_file_path"],
            "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
        )
        user.refresh_from_db()
        self.assertEqual(user.generation_quota, 9)

    @override_settings(GENERATOR_STRATEGY="suno")
    def test_generation_status_falls_back_to_mock_when_suno_status_fails(self):
        user = EndUser.objects.create(
            name="Status Fallback User",
            email="status-fallback@example.com",
            generation_quota=10,
        )
        song = Song.objects.create(
            title="Pending Fallback Song",
            description="Waiting on provider",
            audio_file_path="",
            generation_task_id="suno-task-fallback",
            generation_status=GenerationStatus.PENDING,
            genre="Ambient",
            mood="Calm",
            occasion="Study",
            creator=user,
        )

        with patch(
            "music.generation.suno_generator.SunoSongGeneratorStrategy.get_status",
            side_effect=RuntimeError("Suno status unavailable"),
        ):
            response = self.client.get(
                reverse("generation_status", kwargs={"task_id": "suno-task-fallback"})
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        song.refresh_from_db()
        self.assertEqual(data["generation_status"], GenerationStatus.COMPLETED)
        self.assertEqual(song.generation_status, GenerationStatus.COMPLETED)
        self.assertEqual(
            data["audio_file_path"],
            "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
        )

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
            "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
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

        with patch(
            "music.views.SongGeneratorContext.get_generator",
            return_value=_StubGenerator(),
        ):
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


class GoogleAuthTests(TestCase):
    def test_google_auth_requires_credential(self):
        response = self.client.post(
            reverse("google_auth"),
            data={},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "credential is required")

    def test_google_auth_creates_or_updates_user(self):
        token_info = {
            "email": "google-user@example.com",
            "name": "Google User",
        }

        with patch("music.views.auth._verify_google_credential", return_value=token_info):
            response = self.client.post(
                reverse("google_auth"),
                data={"credential": "mock-google-id-token"},
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["email"], token_info["email"])
        self.assertEqual(payload["name"], token_info["name"])
        self.assertTrue(EndUser.objects.filter(email=token_info["email"]).exists())

    @override_settings(GOOGLE_CLIENT_ID="")
    def test_google_auth_returns_error_when_google_client_id_missing(self):
        with patch("music.views.auth.id_token") as id_token_mock, patch(
            "music.views.auth.google_requests"
        ) as google_requests_mock:
            id_token_mock.verify_oauth2_token.return_value = {}
            google_requests_mock.Request.return_value = object()

            response = self.client.post(
                reverse("google_auth"),
                data={"credential": "mock-google-id-token"},
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json()["error"],
            "GOOGLE_CLIENT_ID is not configured.",
        )

    @override_settings(
        GOOGLE_CLIENT_ID="test-client-id",
        GOOGLE_CLIENT_SECRET="test-client-secret",
        GOOGLE_REDIRECT_URI="http://localhost:8000/accounts/google/login/callback/",
    )
    def test_google_login_redirect_builds_google_authorize_url(self):
        response = self.client.get(
            reverse("google_login_redirect"),
            data={"next": "/playlist/library"},
        )

        self.assertEqual(response.status_code, 302)
        parsed = urlparse(response["Location"])
        query = parse_qs(parsed.query)
        self.assertEqual(parsed.netloc, "accounts.google.com")
        self.assertEqual(parsed.path, "/o/oauth2/v2/auth")
        self.assertEqual(query["client_id"][0], "test-client-id")
        self.assertEqual(
            query["redirect_uri"][0],
            "http://localhost:8000/accounts/google/login/callback/",
        )
        self.assertEqual(query["state"][0], "/playlist/library")

    @override_settings(
        GOOGLE_CLIENT_ID="test-client-id",
        GOOGLE_CLIENT_SECRET="test-client-secret",
        GOOGLE_REDIRECT_URI="http://localhost:8000/accounts/google/login/callback/",
        FRONTEND_URL="http://127.0.0.1:3000",
    )
    def test_google_login_callback_creates_user_and_redirects_frontend(self):
        token_response = MagicMock()
        token_response.raise_for_status.return_value = None
        token_response.json.return_value = {"id_token": "mock-id-token"}

        token_info = {
            "email": "redirect-user@example.com",
            "name": "Redirect User",
        }

        with patch("music.views.auth.requests.post", return_value=token_response), patch(
            "music.views.auth.id_token.verify_oauth2_token",
            return_value=token_info,
        ), patch("music.views.auth.google_requests.Request", return_value=object()):
            response = self.client.get(
                reverse("google_login_callback"),
                data={"code": "auth-code-123", "state": "/playlist"},
            )

        self.assertEqual(response.status_code, 302)
        parsed = urlparse(response["Location"])
        query = parse_qs(parsed.query)
        self.assertEqual(f"{parsed.scheme}://{parsed.netloc}{parsed.path}", "http://127.0.0.1:3000/playlist")
        self.assertEqual(query["google_auth"][0], "success")
        self.assertEqual(query["email"][0], token_info["email"])
        self.assertEqual(query["name"][0], token_info["name"])
        self.assertTrue(EndUser.objects.filter(email=token_info["email"]).exists())
