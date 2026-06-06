import django.db.models.deletion
import pgvector.django.vector
import uuid
from django.conf import settings
from django.db import migrations, models
from pgvector.django import VectorExtension


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        VectorExtension(),
        migrations.CreateModel(
            name='Note',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('source', models.CharField(choices=[('voice', 'Voice'), ('text', 'Text')], max_length=10)),
                ('raw_transcript', models.TextField(blank=True, null=True)),
                ('cleaned_text', models.TextField(blank=True, null=True)),
                ('duration_secs', models.IntegerField(blank=True, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('ready', 'Ready'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'notes_note',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Chunk',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('chunk_index', models.IntegerField()),
                ('text', models.TextField()),
                ('embedding', pgvector.django.vector.VectorField(dimensions=1536)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chunks', to=settings.AUTH_USER_MODEL)),
                ('note', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chunks', to='notes.note')),
            ],
            options={
                'db_table': 'notes_chunk',
                'ordering': ['chunk_index'],
            },
        ),
    ]
