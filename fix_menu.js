const fs = require('fs');
const files = [
  'admin.html',
  'admin-customers.html',
  'admin-technicians.html',
  'admin-properties.html',
  'admin-content.html',
  'admin-chats.html',
  'admin-requests.html',
  'admin-reports.html',
  'admin-settings.html'
];
files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('admin-reviews.html')) {
       // Support 'admin-reports.html" class="menu-item"' or '"menu-item active"'
       const replaceTarget = /<a href="admin-reports\.html" class="menu-item(.*?)">/;
       const replacement = `<a href="admin-reviews.html" class="menu-item">
          <i class="fa-solid fa-star"></i>
          <span>จัดการรีวิว</span>
        </a>
        <a href="admin-reports.html" class="menu-item$1">`;
       content = content.replace(replaceTarget, replacement);
       fs.writeFileSync(file, content);
       console.log('Updated ' + file);
    } else {
       console.log('Already updated ' + file);
    }
  } catch(e) {
      console.log('Error in ' + file, e);
  }
});
