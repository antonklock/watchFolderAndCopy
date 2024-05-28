const express = require('express');
const path = require('path');
const fse = require('fs-extra');
const chokidar = require('chokidar');
const WebSocket = require('ws');

const app = express();
const port = 3000;
const wss = new WebSocket.Server({ noServer: true });

let sourceFolder = '';
let destinationFolder = '';
let watcher = null;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/start', (req, res) => {
    sourceFolder = req.body.sourceFolder;
    destinationFolder = req.body.destinationFolder;

    if (!sourceFolder || !destinationFolder) {
        return res.status(400).send('Source and destination folders are required.');
    }

    // Serve the Source folder statically
    app.use('/Source', express.static(path.join(sourceFolder, 'Source')));

    watchAndMove(sourceFolder, destinationFolder);
    res.send(`Watching started on ${sourceFolder} and copying to ${destinationFolder}`);
});

app.post('/stop', (req, res) => {
    if (watcher) {
        watcher.close();
        watcher = null;
        res.send('Watcher stopped.');
    } else {
        res.send('No watcher to stop.');
    }
});

function watchAndMove(sourceFolder, destinationFolder) {
    const sourceMoveFolder = path.join(sourceFolder, 'Source');
    fse.ensureDirSync(sourceMoveFolder);

    console.log(`Watching for new JPEG files in: ${sourceFolder}`);

    watcher = chokidar.watch(sourceFolder, { 
        persistent: true, 
        ignored: path.join(sourceFolder, 'Source') // Ignore the Source subfolder
    });

    watcher.on('add', (filePath) => {
        if (path.extname(filePath).toLowerCase() === '.jpg') {
            const filename = path.basename(filePath);
            const destinationFilePath = path.join(destinationFolder, filename);
            const sourceMoveFilePath = path.join(sourceMoveFolder, filename);

            console.log(`Processing file: ${filePath}`);
            console.log(`Destination file path: ${destinationFilePath}`);
            console.log(`Source move file path: ${sourceMoveFilePath}`);

            fse.copy(filePath, destinationFilePath)
                .then(() => {
                    console.log(`Copied file: ${filename} to ${destinationFolder}`);
                    return fse.move(filePath, sourceMoveFilePath);
                })
                .then(() => {
                    console.log(`Moved file: ${filename} to ${sourceMoveFolder}`);
                    // Send the relative path from the Source folder
                    broadcastLatestImage(`/Source/${filename}`);
                })
                .catch(err => {
                    console.error(`Error processing file: ${filename}`, err);
                });
        }
    });

    watcher.on('error', (error) => console.error(`Watcher error: ${error}`));
}

function broadcastLatestImage(imagePath) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(imagePath);
        }
    });
}

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});