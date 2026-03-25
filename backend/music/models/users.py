from django.db import models


class EndUser(models.Model):
    user_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    generation_quota = models.IntegerField(default=10)

    def __str__(self):
        return self.name
