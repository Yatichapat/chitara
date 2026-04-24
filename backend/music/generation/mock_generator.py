from .base import SongGeneratorStrategy

MOCK_AUDIO_URL = "https://samplelib.com/lib/preview/mp3/sample-3s.mp3"


class MockSongGeneratorStrategy(SongGeneratorStrategy):
    def generate(self, request_data: dict) -> dict:
        return {
            "task_id": "mock-task-12345",
            "status": "completed",
            "audio_url": MOCK_AUDIO_URL,
            "title": request_data.get("title", "Mock Song Title"),
            "prompt": request_data.get("prompt", ""),
        }

    def get_status(self, task_id: str) -> dict:
        return {
            "task_id": task_id,
            "status": "completed",
            "audio_url": MOCK_AUDIO_URL,
        }
