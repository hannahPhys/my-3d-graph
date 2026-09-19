'use strict';

// Exports every markdown note from the local mirror to public/notes.json so the
// production site can load notes statically. Re-run and redeploy to publish edits.
const fs = require('fs');
const path = require('path');

const SOURCE = process.env.NOTES_MIRROR_DIR || path.join(__dirname, '..', 'server', 'notes-cache');
const OUT = path.join(__dirname, '..', 'public', 'notes.json');

function readNotes(dir) {
  return fs.readdirSync(dir).flatMap(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) return readNotes(full);
    if (path.extname(file) !== '.md') return [];
    return [{ title: file.slice(0, -3), content: fs.readFileSync(full, 'utf-8') }];
  });
}

if (!fs.existsSync(SOURCE)) {
  console.error(`Notes mirror not found at ${SOURCE}. Start the notes server once to populate it.`);
  process.exit(1);
}

// daily notes (YYYY-MM-DD titles) stay private
const notes = readNotes(SOURCE).filter(n => !/^\d{4}-\d{2}-\d{2}/.test(n.title));
fs.writeFileSync(OUT, JSON.stringify(notes));
console.log(`Exported ${notes.length} notes to ${path.relative(process.cwd(), OUT)}`);
