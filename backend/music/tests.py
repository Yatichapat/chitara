from django.test import TestCase
from django.urls import reverse

from music.models import Album, EndUser, Song


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
