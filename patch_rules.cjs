const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(/data\.createdAt is string;/, "(!('createdAt' in data) || data.createdAt is string);");
rules = rules.replace(/request\.resource\.data\.createdAt == resource\.data\.createdAt/, "(!('createdAt' in resource.data) || request.resource.data.createdAt == resource.data.createdAt)");

fs.writeFileSync('firestore.rules', rules);
console.log("Patched firestore.rules");
