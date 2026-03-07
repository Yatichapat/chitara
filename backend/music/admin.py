from django.contrib import admin

from music.models import *

# Register your models here.
admin.site.register(EndUser)
admin.site.register(Song)
admin.site.register(Album)
admin.site.register(SharedLink)
admin.site.register(Invitation)