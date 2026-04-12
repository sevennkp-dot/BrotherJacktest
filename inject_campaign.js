const fs = require('fs');
const files = [
  'admin.html',
  'admin-customers.html',
  'admin-technicians.html',
  'admin-properties.html',
  'admin-content.html',
  'admin-chats.html',
  'admin-requests.html',
  'admin-reviews.html',
  'admin-reports.html',
  'admin-settings.html'
];

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('admin-campaigns.html')) {
       const replaceTarget = /<a href="admin-reviews\.html" class="menu-item(.*?)">/;
       const replacement = `<a href="admin-campaigns.html" class="menu-item">
          <i class="fa-solid fa-tag"></i>
          <span>จัดการแคมเปญ</span>
        </a>
        <a href="admin-reviews.html" class="menu-item$1">`;
       content = content.replace(replaceTarget, replacement);
       fs.writeFileSync(file, content);
       console.log('Updated sidebar in ' + file);
    } else {
       console.log('Sidebar already updated in ' + file);
    }
  } catch(e) {
      console.log('Error in ' + file, e);
  }
});
