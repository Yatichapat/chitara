from django.urls import path

from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('albums/', views.albums, name='albums'),
    path('songs/', views.get_songs, name='get_songs'),
    path('songs/create/', views.create_song, name='create_song'),
    path('songs/generate/', views.generate_song, name='generate_song'),
    path('songs/generate/<str:task_id>/', views.generation_status, name='generation_status'),
    path('songs/<int:song_id>/update/', views.update_song, name='update_song'),
    path('songs/<int:song_id>/delete/', views.delete_song, name='delete_song'),
]
