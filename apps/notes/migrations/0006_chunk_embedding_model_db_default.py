from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0005_chunk_embedding_model'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chunk',
            name='embedding_model',
            field=models.CharField(
                db_default='text-embedding-3-small',
                default='text-embedding-3-small',
                max_length=64,
            ),
        ),
    ]
