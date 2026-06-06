import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ErrorLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('kind', models.CharField(
                    choices=[('server', 'Server'), ('api', 'API'), ('client', 'Client')],
                    default='server',
                    max_length=16,
                )),
                ('status_code', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('path', models.CharField(blank=True, max_length=2048)),
                ('method', models.CharField(blank=True, max_length=10)),
                ('exception_type', models.CharField(blank=True, max_length=255)),
                ('message', models.TextField(blank=True)),
                ('traceback', models.TextField(blank=True)),
                ('user_agent', models.CharField(blank=True, max_length=512)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('extra', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='error_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='errorlog',
            index=models.Index(fields=['-created_at'], name='errors_erro_created_6e0f0d_idx'),
        ),
        migrations.AddIndex(
            model_name='errorlog',
            index=models.Index(fields=['kind', 'status_code'], name='errors_erro_kind_8c2f1a_idx'),
        ),
    ]
