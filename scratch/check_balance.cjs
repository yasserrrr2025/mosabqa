
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Azzam\\Desktop\\sebaq\\src\\teacher.js', 'utf8');

let curly = 0;
let round = 0;
let square = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') curly++;
    if (char === '}') curly--;
    if (char === '(') round++;
    if (char === ')') round--;
    if (char === '[') square++;
    if (char === ']') square--;

    if (curly < 0 || round < 0 || square < 0) {
        console.log(`Mismatch at index ${i} (Line ${content.substring(0, i).split('\n').length}): Char ${char}`);
        // break; 
    }
}

console.log(`Final Balance: Curly: ${curly}, Round: ${round}, Square: ${square}`);
