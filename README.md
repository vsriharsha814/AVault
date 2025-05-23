# AVault - AV Inventory Management System

AVault is a comprehensive web-based inventory management system designed for AV (Audio/Visual) equipment tracking. It supports Excel data import, semester-based inventory tracking, real-time counting sessions, and detailed reporting.

## Features

### Core Functionality
- **Dashboard**: Overview of all inventory items with search and filtering
- **Item Management**: Add, edit, and delete inventory items with detailed metadata
- **Category Management**: Organize items into categories (Wired Mics, Cables, etc.)
- **Excel Import**: Import existing inventory data from Excel spreadsheets
- **Semester Tracking**: Track inventory across academic terms with historical data
- **Inventory Sessions**: Conduct periodic inventory counts with completion tracking
- **Reports**: Generate shortage reports, new item reports, and trend analysis
- **User Authentication**: Secure login system with role-based permissions

### Advanced Features
- **Historical Analysis**: Track inventory changes across multiple semesters
- **Semester Comparison**: Compare inventory between any two academic terms
- **Trend Analysis**: Visualize item count trends over time with charts
- **Export Capabilities**: Export reports and full historical data to Excel
- **Real-time Counting**: Live inventory counting with shortage highlighting
- **AJAX Enhancements**: Dynamic category addition and responsive UI

## Tech Stack

- **Backend**: Django 5.2+ (Python)
- **Frontend**: Bootstrap 5.1 + Custom CSS/JS
- **Database**: SQLite (development) / PostgreSQL (production)
- **Data Processing**: Pandas + openpyxl for Excel handling
- **Charts**: Chart.js for trend visualization
- **Icons**: Font Awesome 6.0

## Installation & Setup

### Prerequisites
- Python 3.8+
- Virtual environment (recommended)

### Quick Start
```bash
# Clone or extract the project
cd avault

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup database
python manage.py makemigrations
python manage.py migrate

# Create initial data and users
python manage.py setup_avault --create-admin

# Run development server
python manage.py runserver
```

### Default Users
- **Admin**: `admin` / `admin123` (full access)
- **Demo User**: `avuser` / `avpass123` (standard access)

## Data Model

### Core Models
- **Category**: Equipment categories (e.g., "WIRED MICS", "CABLES")
- **Item**: Individual inventory items with metadata
- **AcademicTerm**: Semester tracking (Spring 2024, Fall 2025, etc.)
- **InventorySession**: Physical counting sessions
- **InventoryCount**: Current session count data
- **HistoricalCount**: Semester-based historical data

### Key Relationships
```
Category (1) → (many) Item
AcademicTerm (1) → (many) HistoricalCount
Item (1) → (many) HistoricalCount
InventorySession (1) → (many) InventoryCount
```

## Excel Import Format

Your Excel file should follow this structure:

```
+------------------+----------+-----------+---------------+-------------+
| Item             | LOCATION | CONDITION | S/N-FREQUENCY | Summer 2024 |
+------------------+----------+-----------+---------------+-------------+
| WIRED MICS       |          |           |               |             |
| Shure SM-57      | Closet   | Good      | SN123456      | 4           |
| Shure SM-58      | Closet   | Fair      | SN789012      | 2           |
|                  |          |           |               |             |
| WIRELESS MICS    |          |           |               |             |
| Shure GLXD24     | Cart     | Good      | 2.4GHz Ch1    | 1           |
+------------------+----------+-----------+---------------+-------------+
```

### Import Rules
1. **Category headers**: Rows with no count data in semester columns
2. **Item rows**: Rows with numeric count data
3. **Semester columns**: Any column with term/year pattern (e.g., "Fall 2024")
4. **Metadata columns**: LOCATION, CONDITION, S/N-FREQUENCY (optional)
5. **Multiple semesters**: Support unlimited semester columns for historical data

## Usage Guide

### Initial Setup
1. **Import Data**: Use admin account to import your existing Excel inventory
2. **Verify Categories**: Check that categories were created correctly
3. **Add Users**: Create accounts for team members
4. **Set Locations**: Update item locations if needed

### Regular Operations

#### Conducting Inventory
1. **Create Session**: Go to Inventory → New Session
2. **Count Items**: Use the counting interface to input current quantities
3. **Save Progress**: Counts are saved automatically
4. **Mark Complete**: Finalize the session when done

#### Viewing Reports
1. **Current Reports**: View shortages and new items since last session
2. **Semester History**: Browse historical data by academic term
3. **Semester Comparison**: Compare any two semesters
4. **Item Trends**: View individual item history with charts
5. **Export Data**: Download reports or full history as Excel

#### Adding New Items
1. **Add Item**: Use the form to add new equipment
2. **Select Category**: Choose existing or create new category
3. **Set Expected Quantity**: Based on current count
4. **Include in Next Count**: Item will appear in future sessions

## API Endpoints

### AJAX Endpoints
- `POST /inventory/add-category-ajax/`: Create new category
- `GET /inventory/ajax/term-data/`: Get semester data
- Various form submission endpoints

### Export URLs
- `/inventory/reports/export/`: Export current reports
- `/inventory/export-semester-data/`: Export full historical data

## Configuration

### Settings (avault/settings.py)
```python
# Database (change for production)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',  # Change from sqlite3
        'NAME': 'avault_db',
        'USER': 'avault_user',
        'PASSWORD': 'secure_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

# Security (update for production)
SECRET_KEY = 'your-secure-secret-key'
DEBUG = False
ALLOWED_HOSTS = ['your-domain.com']
```

### Admin Interface
Access at `/admin/` with admin credentials for:
- User management
- Direct database editing
- Bulk operations
- System configuration

## File Structure
```
avault/
├── avault/                 # Django project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── inventory/              # Main application
│   ├── migrations/         # Database migrations
│   ├── templates/          # HTML templates
│   ├── templatetags/       # Template filters
│   ├── management/         # Custom commands
│   ├── models.py           # Data models
│   ├── views.py            # View logic
│   ├── forms.py            # Form definitions
│   ├── urls.py             # URL routing
│   ├── utils.py            # Utility functions
│   └── admin.py            # Admin interface
├── requirements.txt        # Python dependencies
└── manage.py              # Django management script
```

## Troubleshooting

### Common Issues

**Template Not Found**
```bash
# Ensure templates are in correct directory
mkdir -p inventory/templates/registration/
```

**Migration Errors**
```bash
python manage.py makemigrations inventory
python manage.py migrate
```

**Excel Import Fails**
```bash
pip install openpyxl pandas
```

**Permission Denied**
- Login as admin user for imports
- Or grant staff status to user

### Testing
1. **Basic Flow**: Login → Add Item → Count → Report
2. **Excel Import**: Upload sample file and verify data
3. **Multi-user**: Test with different user roles

## Production Deployment

### Security Checklist
- [ ] Change SECRET_KEY
- [ ] Set DEBUG = False
- [ ] Configure ALLOWED_HOSTS
- [ ] Use PostgreSQL/MySQL
- [ ] Enable HTTPS
- [ ] Set up backups
- [ ] Configure static files

### Performance
- Add database indexes for large datasets
- Configure caching if needed
- Monitor query performance
- Set up proper logging

## Extension Ideas

The system is designed to be extensible. Potential enhancements:

- **Barcode Scanning**: QR/barcode integration for faster counting
- **Photo Management**: Upload and store item photos
- **Maintenance Tracking**: Schedule and track equipment maintenance
- **Check-out System**: Track equipment loans and returns
- **Mobile App**: Native mobile interface for inventory counting
- **API Development**: REST API for third-party integrations
- **Advanced Analytics**: Machine learning for demand forecasting
- **Notification System**: Email alerts for low stock or maintenance due

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Django and Python documentation
3. Examine the source code - it's well-commented
4. Test with the provided sample data

## License

This project is designed for internal AV team use. Modify and distribute as needed for your organization.