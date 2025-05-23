# avault/inventory/management/commands/clear_database.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from inventory.models import (
    Category, Item, AcademicTerm, HistoricalCount, 
    InventorySession, InventoryCount
)

class Command(BaseCommand):
    help = 'Clear inventory database - WARNING: This will delete all inventory data!'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm that you want to delete all data',
        )
        parser.add_argument(
            '--keep-users',
            action='store_true',
            help='Keep user accounts (only delete inventory data)',
        )
        parser.add_argument(
            '--keep-categories',
            action='store_true',
            help='Keep categories (delete items and counts only)',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.ERROR('⚠️  DANGER: This will permanently delete data!')
            )
            self.stdout.write('To proceed, run with --confirm flag:')
            self.stdout.write('python manage.py clear_database --confirm')
            return

        # Show what will be deleted
        counts = {
            'inventory_counts': InventoryCount.objects.count(),
            'inventory_sessions': InventorySession.objects.count(),
            'historical_counts': HistoricalCount.objects.count(),
            'items': Item.objects.count(),
            'academic_terms': AcademicTerm.objects.count(),
            'categories': Category.objects.count(),
            'users': User.objects.count()
        }

        self.stdout.write('\n📊 Current database contents:')
        for model, count in counts.items():
            self.stdout.write(f'  • {model.replace("_", " ").title()}: {count}')

        # Confirmation prompt
        self.stdout.write('\n⚠️  Are you absolutely sure? This cannot be undone!')
        confirm = input('Type "d" to proceed: ')
        
        if confirm != "d":
            self.stdout.write(self.style.ERROR('❌ Operation cancelled'))
            return

        try:
            with transaction.atomic():
                # Delete in order of dependencies
                deleted_counts = {}
                
                # 1. Delete inventory counts first
                deleted_counts['inventory_counts'] = InventoryCount.objects.all().delete()[0]
                
                # 2. Delete inventory sessions
                deleted_counts['inventory_sessions'] = InventorySession.objects.all().delete()[0]
                
                # 3. Delete historical counts
                deleted_counts['historical_counts'] = HistoricalCount.objects.all().delete()[0]
                
                # 4. Delete academic terms
                deleted_counts['academic_terms'] = AcademicTerm.objects.all().delete()[0]
                
                # 5. Delete items
                deleted_counts['items'] = Item.objects.all().delete()[0]
                
                # 6. Delete categories (if not keeping them)
                if not options['keep_categories']:
                    deleted_counts['categories'] = Category.objects.all().delete()[0]
                
                # 7. Delete users (if not keeping them)
                if not options['keep_users']:
                    # Keep superusers, delete regular users
                    regular_users = User.objects.filter(is_superuser=False)
                    deleted_counts['regular_users'] = regular_users.delete()[0]

            # Success message
            self.stdout.write('\n✅ Database cleared successfully!')
            self.stdout.write('📋 Deleted:')
            for model, count in deleted_counts.items():
                if count > 0:
                    self.stdout.write(f'  • {model.replace("_", " ").title()}: {count}')

            # Suggest next steps
            self.stdout.write('\n🚀 Next steps:')
            self.stdout.write('  1. Run: python manage.py setup_avault --create-admin')
            self.stdout.write('  2. Import fresh data from Excel')
            self.stdout.write('  3. Create new inventory sessions')

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error clearing database: {str(e)}')
            )
            return

    def confirm_deletion(self):
        """Additional confirmation for safety"""
        self.stdout.write(
            self.style.WARNING('This will permanently delete ALL inventory data!')
        )
        confirm = input('Are you sure? (yes/no): ').lower().strip()
        return confirm in ['yes', 'y']