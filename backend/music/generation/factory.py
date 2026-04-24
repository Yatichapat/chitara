from django.conf import settings


class SongGeneratorContext:
    def __init__(self, strategy_name=None):
        configured = strategy_name if strategy_name is not None else settings.GENERATOR_STRATEGY
        self.strategy_name = str(configured).lower().strip()

    def get_generator(self):
        strategy = self.strategy_name

        if strategy == "mock":
            from .mock_generator import MockSongGeneratorStrategy

            return MockSongGeneratorStrategy()
        if strategy == "suno":
            from .suno_generator import SunoSongGeneratorStrategy

            return SunoSongGeneratorStrategy()

        raise ValueError("Invalid GENERATOR_STRATEGY. Expected 'mock' or 'suno'.")
