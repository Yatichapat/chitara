from django.urls import path

from . import views

urlpatterns = [
    path('songs/', views.get_songs, name='get_songs'),
    path('songs/create/', views.create_song, name='create_song'),
    path('songs/<int:song_id>/update/', views.update_song, name='update_song'),
    path('songs/<int:song_id>/delete/', views.delete_song, name='delete_song'),
]