from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE INDEX IF NOT EXISTS notes_chunk_embedding_ivfflat_idx
                ON notes_chunk USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql='DROP INDEX IF EXISTS notes_chunk_embedding_ivfflat_idx;',
        ),
    ]
