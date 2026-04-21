from .base import SongGeneratorStrategy


class MockSongGeneratorStrategy(SongGeneratorStrategy):
    def generate(self, request_data: dict) -> dict:
        return {
            "task_id": "mock-task-12345",
            "status": "completed",
            "audio_url": "https://example.com/mock_song.mp3",
            "title": request_data.get("title", "Mock Song Title"),
            "prompt": request_data.get("prompt", ""),
        }

    def get_status(self, task_id: str) -> dict:
        return {
            "task_id": task_id,
            "status": "completed",
            "audio_url": "https://example.com/mock_song.mp3",
        }
