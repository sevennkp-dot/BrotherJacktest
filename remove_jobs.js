const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.startsWith('admin') && f.endsWith('.html'));

files.forEach(file => {
  if (file === 'admin-jobs.html') return;
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // match <a href="admin-jobs.html" ... > ... </a> including space before and after
  const regex = /\s*<a\s+href="admin-jobs\.html"[^>]*>[\s\S]*?<\/a>/gi;
  
  if (regex.test(content)) {
    content = content.replace(regex, '');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + file);
  }
});
