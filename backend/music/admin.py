from django.contrib import admin

from music.models import EndUser, Song

# Register your models here.
admin.site.register(EndUser)
admin.site.register(Song)