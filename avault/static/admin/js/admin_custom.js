// Custom admin JavaScript enhancements
document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scrolling to admin links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
    
    // Enhanced form validation feedback
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.classList.add('loading');
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }
        });
    });
    
    // Auto-refresh statistics every 30 seconds (optional)
    if (window.location.pathname === '/admin/') {
        setInterval(function() {
            // You can implement AJAX refresh of stats here
            console.log('Stats refresh would happen here');
        }, 30000);
    }
});