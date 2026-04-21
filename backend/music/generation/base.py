from abc import ABC, abstractmethod


class SongGeneratorStrategy(ABC):
    @abstractmethod
    def generate(self, request_data: dict) -> dict:
        """Start song generation and return a provider-agnostic result."""

    @abstractmethod
    def get_status(self, task_id: str) -> dict:
        """Fetch the latest status for a generation task."""
