// Configure the AWS SDK
AWS.config.update({
    accessKeyId: 'YOUR_ACCESS_KEY',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
    region: 'YOUR_REGION' // can be e.g. eu-west-1
});

const s3 = new AWS.S3();
// put the bucket name where your pictures are here
const bucketName = 'YOUR_BUCKET_NAME';
let currentIndex = 0;
let files = [];
let currentPrefix = '';

function listObjects(prefix = '') {
    console.log(`Listing objects with prefix: ${prefix}`);
    const params = {
        Bucket: bucketName,
        Prefix: prefix,
        Delimiter: '/'
    };

    s3.listObjectsV2(params, (err, data) => {
        if (err) {
            console.error('Error listing objects:', err);
        } else {
            console.log('Objects listed successfully:', data);
            displayTree(data.CommonPrefixes, data.Contents, prefix);
            files = data.Contents.filter(item => item.Key !== prefix).map(item => item.Key);
            if (files.length > 0) {
                currentIndex = 0;
                displayFile(currentIndex);
            } else {
                document.getElementById('image-container').innerHTML = 'No files found';
                console.log('No files found for the given prefix.');
            }
        }
    });
}

function displayTree(folders, contents, prefix) {
    const tree = document.getElementById('folder-tree');
    tree.innerHTML = '';

    if (prefix !== '') {
        const li = document.createElement('li');
        li.textContent = '...';
        li.classList.add('back-navigation');
        li.onclick = () => {
            const parentPrefix = prefix.split('/').slice(0, -2).join('/') + '/';
            console.log(`Navigating to parent folder: ${parentPrefix}`);
            listObjects(parentPrefix);
        };
        tree.appendChild(li);
    }

    folders.forEach(folder => {
        const li = document.createElement('li');
        li.style.display = 'flex'; // Ensure the button is aligned properly
        li.style.alignItems = 'center'; // Center align items vertically

        const folderName = document.createElement('span');
        folderName.textContent = folder.Prefix.replace(prefix, '');
        folderName.style.flexGrow = '1'; // Allow the folder name to take up available space
        folderName.onclick = () => {
            console.log(`Navigating to folder: ${folder.Prefix}`);
            listObjects(folder.Prefix);
        };
        li.appendChild(folderName);

        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download All';
        downloadButton.style.marginLeft = '10px'; // Add some margin to separate the button from the text
        downloadButton.onclick = (event) => {
            event.stopPropagation();
            downloadFolder(folder.Prefix);
        };
        li.appendChild(downloadButton);

        tree.appendChild(li);
    });

    contents.forEach(content => {
        if (content.Key !== prefix) {
            const li = document.createElement('li');
            li.textContent = content.Key.replace(prefix, '');
            li.onclick = () => {
                console.log(`Navigating to file: ${content.Key}`);
                currentPrefix = prefix;
                currentIndex = files.indexOf(content.Key);
                displayFile(currentIndex);
            };
            tree.appendChild(li);
        }
    });
}

function displayFile(index) {
    const fileKey = files[index];
    const fileUrl = s3.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: fileKey,
        Expires: 60 // URL expiration time in seconds
    });

    console.log(`Displaying file: ${fileKey}`);
    console.log(`File URL: ${fileUrl}`);

    const container = document.getElementById('image-container');
    container.innerHTML = '';

    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i;
    const videoExtensions = /\.(mp4|webm|ogg|mov|avi|mkv|mpg|mpeg)$/i;

    if (videoExtensions.test(fileKey)) {
        const video = document.createElement('video');
        video.className = 'video-js vjs-default-skin';
        video.controls = true;
        video.width = container.clientWidth;
        video.height = container.clientHeight;

        const source = document.createElement('source');
        source.src = fileUrl;
        source.type = `video/${fileKey.split('.').pop().toLowerCase()}`; // Adjust the type as needed
        video.appendChild(source);

        container.appendChild(video);
        videojs(video); // Initialize Video.js

        // Add error handling
        videojs(video).on('error', function() {
            container.innerHTML = 'Video format not supported. Please try a different browser or convert the video to a supported format.';
            console.error('Error playing video:', fileKey);
        });

        console.log('Displayed video:', fileKey);
    } else if (imageExtensions.test(fileKey)) {
        const img = document.createElement('img');
        img.src = fileUrl;
        container.appendChild(img);
        console.log('Displayed image:', fileKey);
    } else {
        container.innerHTML = 'Unsupported file format';
        console.warn('Unsupported file format:', fileKey);
    }
}

async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.statusText}`);
            }
            return await response.blob();
        } catch (error) {
            console.error(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
}

// Function to download all files from a folder
async function downloadFolder(prefix) {
    console.log(`Downloading all files from folder: ${prefix}`);
    const params = {
        Bucket: bucketName,
        Prefix: prefix
    };

    s3.listObjectsV2(params, async (err, data) => {
        if (err) {
            console.error('Error listing objects for download:', err);
        } else {
            const zip = new JSZip();
            const files = data.Contents.map(item => item.Key);
            const promises = files.map(async fileKey => {
                const fileUrl = s3.getSignedUrl('getObject', {
                    Bucket: bucketName,
                    Key: fileKey,
                    Expires: 60 // URL expiration time in seconds
                });
                try {
                    const blob = await fetchWithRetry(fileUrl);
                    zip.file(fileKey.replace(prefix, ''), blob);
                } catch (error) {
                    console.error(`Failed to fetch ${fileKey}: ${error.message}`);
                }
            });

            await Promise.all(promises);

            zip.generateAsync({ type: 'blob' }).then(content => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = `${prefix.replace(/\/$/, '')}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
    });
}

document.getElementById('prev').addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        displayFile(currentIndex);
        console.log('Navigated to previous file:', files[currentIndex]);
    } else {
        console.log('No previous file.');
    }
});

document.getElementById('next').addEventListener('click', () => {
    if (currentIndex < files.length - 1) {
        currentIndex++;
        displayFile(currentIndex);
        console.log('Navigated to next file:', files[currentIndex]);
    } else {
        console.log('No next file.');
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
        if (currentIndex > 0) {
            currentIndex--;
            displayFile(currentIndex);
            console.log('Navigated to previous file:', files[currentIndex]);
        } else {
            console.log('No previous file.');
        }
    } else if (event.key === 'ArrowRight') {
        if (currentIndex < files.length - 1) {
            currentIndex++;
            displayFile(currentIndex);
            console.log('Navigated to next file:', files[currentIndex]);
        } else {
            console.log('No next file.');
        }
    }
});

// Initialize the gallery
listObjects();
