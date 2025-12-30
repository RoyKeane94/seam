from django.db import models
from django.core.validators import EmailValidator
from django.utils import timezone

class PageVisit(models.Model):
    """Track visits to the landing page"""
    visit_date = models.DateField(
        unique=True,
        help_text="Date of the visit"
    )
    visit_count = models.IntegerField(
        default=0,
        help_text="Number of visits on this date"
    )
    last_visit = models.DateTimeField(
        auto_now=True,
        help_text="Last time a visit was recorded"
    )
    
    class Meta:
        ordering = ['-visit_date']
        verbose_name = 'Page Visit'
        verbose_name_plural = 'Page Visits'
    
    def __str__(self):
        return f"{self.visit_date} - {self.visit_count} visits"

class Waitlist(models.Model):
    email = models.EmailField(
        max_length=254,
        unique=True,
        validators=[EmailValidator()],
        help_text="Email address for the waitlist"
    )
    date_signed_up = models.DateTimeField(
        auto_now_add=True,
        help_text="Date and time when the user signed up"
    )
    
    SHARE_TYPE_CHOICES = [
        ('ideas', 'Ideas'),
        ('research', 'Research'),
        ('summaries', 'Summaries'),
        ('notes', 'Notes'),
    ]
    
    what_mostly_share = models.CharField(
        max_length=20,
        choices=SHARE_TYPE_CHOICES,
        blank=True,
        null=True,
        help_text="What do you mostly share?"
    )
    
    class Meta:
        ordering = ['-date_signed_up']
        verbose_name = 'Waitlist Entry'
        verbose_name_plural = 'Waitlist Entries'
    
    def __str__(self):
        return f"{self.email} - {self.date_signed_up.strftime('%Y-%m-%d %H:%M')}"
