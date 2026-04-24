from django.http import HttpResponse
from django.shortcuts import render


def user(request):
    return HttpResponse("Welcome to the User Page!")


def home(request):
    return render(request, "music/index.html")


def album(request):
    return HttpResponse("Welcome to the Album Page!")
