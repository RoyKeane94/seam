from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0003_note_tags'),
    ]

    operations = [
        migrations.AddField(
            model_name='note',
            name='error_message',
            field=models.TextField(blank=True, null=True),
        ),
    ]
