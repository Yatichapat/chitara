from django.http import HttpResponse


def user(request):
    return HttpResponse("Welcome to the User Page!")


def home(request):
    return HttpResponse("Chitara")


def album(request):
    return HttpResponse("Welcome to the Album Page!")
