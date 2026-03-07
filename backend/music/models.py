from django.db import models

# Create your models here.

class PrivacyLevel(models.TextChoices):
    PUBLIC = 'public', 'Public'
    INVITE_ONLY = 'invite_only', 'Invite Only'
    PRIVATE = 'private', 'Private'

class GenerationStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    IN_PROGRESS = 'in_progress', 'In Progress'
    COMPLETED = 'completed', 'Completed'
    FAILED = 'failed', 'Failed'

class EndUser(models.Model):
    user_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    generation_quota = models.IntegerField(default=10)

    def __str__(self):
        return self.name

# ABSTRACT SHAREABLE CONTENT
class ShareableContent(models.Model):

    class Meta:
        abstract = True

class Album(ShareableContent):
    album_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    created_date = models.DateTimeField(auto_now_add=True)

    creator = models.ForeignKey(
        EndUser, 
        on_delete=models.CASCADE,
        related_name='albums'
        )

    def __str__(self):
        return self.name
    
class Song(ShareableContent):
    song_id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=200)
    description = models.TextField()

    created_date = models.DateTimeField(auto_now_add=True)
    audio_file_path = models.CharField(max_length=500)
    generation_status = models.CharField(max_length=50, default=GenerationStatus.PENDING, 
                                         choices=GenerationStatus.choices)
    genre = models.CharField(max_length=100)
    mood = models.CharField(max_length=100)
    occasion = models.CharField(max_length=100)

    creator = models.ForeignKey(
        EndUser, 
        on_delete=models.CASCADE,
        related_name='songs'
        )
    
    album = models.ForeignKey(
        Album, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='songs'
    )

    def __str__(self):
        return self.title
    
class SharedLink(models.Model):
    link_id = models.AutoField(primary_key=True)

    privacy_level = models.CharField(max_length=50, default=PrivacyLevel.PRIVATE, 
                                     choices=PrivacyLevel.choices)
    expiration_date = models.DateTimeField()
    content = models.ForeignKey(
        Song,
        on_delete=models.CASCADE,
        related_name='shared_links'
    )
    def __str__(self):
        return f"Link for {self.content.title} with {self.privacy_level} privacy"

class Invitation(models.Model):
    invitation_id = models.AutoField(primary_key=True)

    link = models.ForeignKey(
        SharedLink,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    email = models.EmailField()
    sent_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invitation for {self.email} via link {self.link_id}"
