from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('inventory', '0001_initial'),
    ]

    operations = [
        # Create AcademicTerm model
        migrations.CreateModel(
            name='AcademicTerm',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
                ('term', models.CharField(choices=[('SPRING', 'Spring'), ('SUMMER', 'Summer'), ('FALL', 'Fall'), ('WINTER', 'Winter')], max_length=10)),
                ('year', models.IntegerField()),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-year', '-term'],
            },
        ),
        
        # Add unique constraint for term + year
        migrations.AddConstraint(
            model_name='academicterm',
            constraint=models.UniqueConstraint(fields=('term', 'year'), name='unique_term_year'),
        ),
        
        # Create HistoricalCount model
        migrations.CreateModel(
            name='HistoricalCount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('counted_quantity', models.PositiveIntegerField(default=0)),
                ('imported_at', models.DateTimeField(auto_now_add=True)),
                ('notes', models.TextField(blank=True)),
                ('academic_term', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='historical_counts', to='inventory.academicterm')),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='historical_counts', to='inventory.item')),
            ],
            options={
                'ordering': ['academic_term__year', 'academic_term__term'],
            },
        ),
        
        # Add unique constraint for item + academic_term
        migrations.AddConstraint(
            model_name='historicalcount',
            constraint=models.UniqueConstraint(fields=('item', 'academic_term'), name='unique_item_term'),
        ),
        
        # Add academic_term field to InventorySession
        migrations.AddField(
            model_name='inventorysession',
            name='academic_term',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='inventory.academicterm'),
        ),
        
        # Remove expected_quantity from Item (will be calculated from historical data)
        migrations.RemoveField(
            model_name='item',
            name='expected_quantity',
        ),
    ]