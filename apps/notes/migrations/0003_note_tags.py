import django.contrib.postgres.fields
import django.contrib.postgres.indexes
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0002_chunk_embedding_ivfflat_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='note',
            name='tags',
            field=django.contrib.postgres.fields.ArrayField(
                base_field=models.CharField(max_length=64),
                blank=True,
                default=list,
                size=None,
            ),
        ),
        migrations.AddIndex(
            model_name='note',
            index=django.contrib.postgres.indexes.GinIndex(
                fields=['tags'],
                name='idx_notes_note_tags',
            ),
        ),
    ]
