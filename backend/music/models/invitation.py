from django.db import models

from .shared_link import SharedLink


class Invitation(models.Model):
    invitation_id = models.AutoField(primary_key=True)
    link = models.ForeignKey(
        SharedLink,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    email = models.EmailField()
    sent_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invitation for {self.email} via link {self.link_id}"