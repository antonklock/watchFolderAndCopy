const path = require('path');
const fse = require('fs-extra');
const express = require('express');
const chokidar = require('chokidar');

const app = express();
const port = 3000;

let sourceFolder = '';
let destinationFolder = '';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Serve the index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to start watching the folder
app.post('/start', (req, res) => {
    sourceFolder = req.body.sourceFolder;
    destinationFolder = req.body.destinationFolder;

    if (!sourceFolder || !destinationFolder) {
        return res.status(400).send('Source and destination folders are required.');
    }

    watchAndMove(sourceFolder, destinationFolder);
    res.send(`Watching started on ${sourceFolder} and copying to ${destinationFolder}`);
});

function watchAndMove(sourceFolder, destinationFolder) {
    const sourceMoveFolder = path.join(sourceFolder, 'Source');
    fse.ensureDirSync(sourceMoveFolder);

    console.log(`Watching for new JPEG files in: ${sourceFolder}`);

    // Use chokidar to watch the source folder for changes
    const watcher = chokidar.watch(sourceFolder, { persistent: true });

    watcher.on('add', (filePath) => {
        if (path.extname(filePath).toLowerCase() === '.jpg') {
            const filename = path.basename(filePath);
            const destinationFilePath = path.join(destinationFolder, filename);
            const sourceMoveFilePath = path.join(sourceMoveFolder, filename);

            fse.copy(filePath, destinationFilePath)
                .then(() => {
                    console.log(`Copied file: ${filename} to ${destinationFolder}`);
                    return fse.move(filePath, sourceMoveFilePath);
                })
                .then(() => {
                    console.log(`Moved file: ${filename} to ${sourceMoveFolder}`);
                })
                .catch(err => {
                    console.error(`Error processing file: ${filename}`, err);
                });
        }
    });

    watcher.on('error', (error) => console.error(`Watcher error: ${error}`));
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});