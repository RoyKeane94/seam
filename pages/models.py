from django.db import models
from django.core.validators import EmailValidator

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
    
    class Meta:
        ordering = ['-date_signed_up']
        verbose_name = 'Waitlist Entry'
        verbose_name_plural = 'Waitlist Entries'
    
    def __str__(self):
        return f"{self.email} - {self.date_signed_up.strftime('%Y-%m-%d %H:%M')}"
