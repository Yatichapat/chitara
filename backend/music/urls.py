from django.urls import path

from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('auth/google/', views.google_auth, name='google_auth'),
    path('accounts/google/login/', views.google_login_redirect, name='google_login_redirect'),
    path('accounts/google/login/callback/', views.google_login_callback, name='google_login_callback'),
    path('albums/', views.albums, name='albums'),
    path('songs/', views.get_songs, name='get_songs'),
    path('songs/<int:song_id>/share/', views.shared_song, name='shared_song'),
    path('songs/create/', views.create_song, name='create_song'),
    path('songs/generate/', views.generate_song, name='generate_song'),
    path('songs/generate/<str:task_id>/', views.generation_status, name='generation_status'),
    path('songs/<int:song_id>/update/', views.update_song, name='update_song'),
    path('songs/<int:song_id>/delete/', views.delete_song, name='delete_song'),
]
