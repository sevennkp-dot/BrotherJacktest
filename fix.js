const fs = require('fs');
let code = fs.readFileSync('technician.js', 'utf8');
code = code.replace(/status: ".*"/g, 'status: "รอดำเนินการ"');
fs.writeFileSync('technician.js', code);
console.log('Fixed');
