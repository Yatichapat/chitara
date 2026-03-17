from django import views
from django.urls import path

from . import views

urlpatterns = [
    path('songs/', views.get_songs, name='get_songs'),
]