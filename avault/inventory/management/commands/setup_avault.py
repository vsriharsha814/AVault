from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from inventory.models import Category, Item, InventorySession
from django.utils import timezone

class Command(BaseCommand):
    help = 'Setup AVault with initial data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-admin',
            action='store_true',
            help='Create admin user',
        )

    def handle(self, *args, **options):
        if options['create_admin']:
            if not User.objects.filter(username='admin').exists():
                User.objects.create_superuser(
                    username='admin',
                    email='admin@example.com',
                    password='admin123'
                )
                self.stdout.write(
                    self.style.SUCCESS('Successfully created admin user (admin/admin123)')
                )
            else:
                self.stdout.write(
                    self.style.WARNING('Admin user already exists')
                )

        # Create sample categories if none exist
        if not Category.objects.exists():
            sample_categories = [
                'WIRED MICS',
                'WIRELESS MICS',
                'CABLES',
                'SPEAKERS',
                'MIXERS',
                'PROJECTORS'
            ]
            
            for cat_name in sample_categories:
                Category.objects.get_or_create(name=cat_name)
            
            self.stdout.write(
                self.style.SUCCESS(f'Created {len(sample_categories)} sample categories')
            )

        # Create a demo user
        if not User.objects.filter(username='avuser').exists():
            User.objects.create_user(
                username='avuser',
                email='avuser@example.com',
                password='avpass123'
            )
            self.stdout.write(
                self.style.SUCCESS('Created demo user (avuser/avpass123)')
            )

        self.stdout.write(
            self.style.SUCCESS('AVault setup complete!')
        )
