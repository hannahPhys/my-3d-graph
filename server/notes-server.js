const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');

const SOURCE_DIR = process.env.NOTES_SOURCE_DIR
  || '/Users/user/Library/Mobile Documents/iCloud~md~obsidian/Documents/Everything/QuantaReality';
const MIRROR_DIR = process.env.NOTES_MIRROR_DIR || path.join(__dirname, 'notes-cache');
const PORT = process.env.PORT || 3001;

fs.ensureDirSync(MIRROR_DIR);

function mirrorPathFor(sourcePath) {
  return path.join(MIRROR_DIR, path.relative(SOURCE_DIR, sourcePath));
}

let initialScanDone = false;
let pendingInitialCopies = 0;
let mirroredCount = 0;

function checkMirrorReady() {
  if (initialScanDone && pendingInitialCopies === 0 && !mirrorReady) {
    mirrorReady = true;
    console.log(`Initial mirror complete (${mirroredCount} notes). Watching "${SOURCE_DIR}" for changes.`);
  }
}

function mirrorFile(sourcePath, isInitialScan) {
  if (isInitialScan) pendingInitialCopies++;
  fs.copy(sourcePath, mirrorPathFor(sourcePath), err => {
    if (err) console.error(`Failed to mirror ${sourcePath}:`, err.message);
    else mirroredCount++;
    if (isInitialScan) {
      pendingInitialCopies--;
      checkMirrorReady();
    }
  });
}

function removeMirroredFile(sourcePath) {
  fs.remove(mirrorPathFor(sourcePath), err => {
    if (err) console.error(`Failed to remove mirrored file for ${sourcePath}:`, err.message);
  });
}

let mirrorReady = false;

// awaitWriteFinish avoids mirroring a note mid-save (Obsidian/iCloud write in chunks)
const watcher = chokidar.watch(SOURCE_DIR, {
  ignored: /(^|[/\\])\../,
  persistent: true,
  awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
});

watcher
  .on('add', filePath => path.extname(filePath) === '.md' && mirrorFile(filePath, !initialScanDone))
  .on('change', filePath => path.extname(filePath) === '.md' && mirrorFile(filePath, false))
  .on('unlink', filePath => path.extname(filePath) === '.md' && removeMirroredFile(filePath))
  .on('ready', () => {
    initialScanDone = true;
    checkMirrorReady();
  })
  .on('error', err => console.error('Watcher error:', err.message));

// MIRROR_DIR is a plain local copy, so these sync reads never touch iCloud
function readMarkdownFiles(dir) {
  let foundNotes = [];
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
    return foundNotes;
  }

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    try {
      if (fs.statSync(fullPath).isDirectory()) {
        foundNotes = foundNotes.concat(readMarkdownFiles(fullPath));
      } else if (path.extname(file) === '.md') {
        const content = fs.readFileSync(fullPath, 'utf-8');
        foundNotes.push({
          title: file.slice(0, -3),
          content,
          path: fullPath,
        });
      }
    } catch (err) {
      console.error(`Error reading file ${fullPath}:`, err.message);
    }
  });

  return foundNotes;
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/notes', (req, res) => {
  if (!mirrorReady) {
    return res.status(503).json({ error: 'Initial mirror still in progress, try again shortly' });
  }
  res.json(readMarkdownFiles(MIRROR_DIR));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mirrorReady,
    mirroredCount,
    pendingInitialCopies,
    sourceDir: SOURCE_DIR,
    mirrorDir: MIRROR_DIR,
  });
});

app.listen(PORT, () => {
  console.log(`Notes server running on http://localhost:${PORT}`);
  console.log(`Mirroring from: ${SOURCE_DIR}`);
  console.log(`Local cache at: ${MIRROR_DIR}`);
});
