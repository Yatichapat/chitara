from django.conf import settings


def get_song_generator():
    strategy = settings.GENERATOR_STRATEGY.lower().strip()

    if strategy == "mock":
        from .mock_generator import MockSongGeneratorStrategy

        return MockSongGeneratorStrategy()
    if strategy == "suno":
        from .suno_generator import SunoSongGeneratorStrategy

        return SunoSongGeneratorStrategy()

    raise ValueError("Invalid GENERATOR_STRATEGY. Expected 'mock' or 'suno'.")
