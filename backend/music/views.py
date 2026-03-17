from django.shortcuts import render
from django.http import HttpResponse

from music.models import Song

# Create your views here.
def user(request):
    return HttpResponse("Welcome to the User Page!")

def album(request):
    return HttpResponse("Welcome to the Album Page!")

def get_songs(request):
    try:
        songs = list(Song.objects.values())
        return HttpResponse(f"Welcome to the Song Page! Here are the songs: \n{songs}")
    except Exception as e:
        return HttpResponse(f"Error occurred: {e}")