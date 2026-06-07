from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0004_note_error_message'),
    ]

    operations = [
        migrations.AddField(
            model_name='chunk',
            name='embedding_model',
            field=models.CharField(default='text-embedding-3-small', max_length=64),
        ),
    ]
