import uuid

from django.conf import settings
from django.db import models


class ErrorLog(models.Model):
    class Kind(models.TextChoices):
        SERVER = 'server', 'Server'
        API = 'api', 'API'
        CLIENT = 'client', 'Client'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.SERVER)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    path = models.CharField(max_length=2048, blank=True)
    method = models.CharField(max_length=10, blank=True)
    exception_type = models.CharField(max_length=255, blank=True)
    message = models.TextField(blank=True)
    traceback = models.TextField(blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='error_logs',
    )
    user_agent = models.CharField(max_length=512, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['kind', 'status_code']),
        ]

    def __str__(self) -> str:
        code = self.status_code or '—'
        return f'{self.get_kind_display()} {code} {self.path[:60]}'
