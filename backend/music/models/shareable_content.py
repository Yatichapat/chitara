from django.db import models


class ShareableContent(models.Model):
    class Meta:
        abstract = True