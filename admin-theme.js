
// admin-theme.js
document.addEventListener('DOMContentLoaded', () => {
    // Check saved theme
    const savedTheme = localStorage.getItem('adminTheme') || 'light';
    if(savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const drkSwitch = document.getElementById('darkModeSwitch');
        if(drkSwitch) drkSwitch.checked = true;
    }
});

// For settings page to toggle
window.toggleDarkMode = function(isDark) {
    if(isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('adminTheme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('adminTheme', 'light');
    }
};
