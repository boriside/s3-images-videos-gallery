// Configure the AWS SDK
AWS.config.update({
    accessKeyId: 'YOUR_ACCESS_KEY',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
    region: 'YOUR_REGION' // can be e.g. eu-west-1
});

const s3 = new AWS.S3();
const bucketName = 'YOUR_BUCKET_NAME'; // Replace with your S3 bucket name
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
            handleS3Error(err);
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

// Error handling function for S3 operations
function handleS3Error(err) {
    console.error('Error accessing S3:', err);
    const container = document.getElementById('image-container');

    if (err.code === 'CredentialsError' || err.code === 'AccessDenied' || err.code === 'NotAuthorized') {
        container.innerHTML = `
            <p><strong>Access Denied:</strong> Please check your AWS credentials and permissions.</p>
            <p>Ensure that your IAM user has the necessary permissions to access the S3 bucket.</p>
        `;
    } else if (err.code === 'NetworkingError' && err.message === 'Network Failure') {
        displayCorsError();
    } else {
        container.innerHTML = 'An error occurred while accessing the S3 bucket. Please try again later.';
    }
}

// Function to display a CORS error message
function displayCorsError() {
    const container = document.getElementById('image-container');
    container.innerHTML = `
        <p>
            <strong>CORS Error:</strong> Cross-Origin Resource Sharing (CORS) is not enabled for this S3 bucket.
            Please configure CORS settings to allow access from your application.
        </p>
        <p>
            <a href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html" target="_blank">
                Learn how to configure CORS for Amazon S3
            </a>
        </p>
    `;
    console.error('CORS is not enabled on the S3 bucket.');
}

// Function to display the folder tree and files
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
        li.style.display = 'flex';
        li.style.alignItems = 'center';

        const folderName = document.createElement('span');
        folderName.textContent = folder.Prefix.replace(prefix, '');
        folderName.style.flexGrow = '1';
        folderName.onclick = () => {
            console.log(`Navigating to folder: ${folder.Prefix}`);
            listObjects(folder.Prefix);
        };
        li.appendChild(folderName);

        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download All';
        downloadButton.style.marginLeft = '10px';
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

// Function to display the selected file (image or video)
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
        source.type = `video/${fileKey.split('.').pop().toLowerCase()}`;
        video.appendChild(source);

        container.appendChild(video);
        videojs(video); // Initialize Video.js

        // Add error handling for video playback
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

// Function to fetch files with retry mechanism
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

// Function to download all files from a folder as a ZIP archive
async function downloadFolder(prefix) {
    console.log(`Downloading all files from folder: ${prefix}`);
    const params = {
        Bucket: bucketName,
        Prefix: prefix
    };

    s3.listObjectsV2(params, async (err, data) => {
        if (err) {
            handleS3Error(err);
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

// Event listeners for previous and next buttons
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

// Keyboard navigation using arrow keys
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

// Initialize the gallery by listing objects in the root folder
listObjects();
