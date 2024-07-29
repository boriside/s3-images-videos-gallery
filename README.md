# Simple S3 Images and Videos Gallery with Folder Navigation

If you love AWS like me, you probably keep your pictures and videos on S3. You probably also know, that you cannot view them as a gallery and have to download them one by one. I struggled to find an **easy tool where only IAM User keys and bucket name are necessary, to connect and view your S3 bucket contents.** That's how the need for this tool emerged.  
The tool is a web-based image gallery that connects to an Amazon S3 bucket to display them. It allows users to navigate through folders, view images and videos (also using left and right arrow keys) and download all files in a folder as a ZIP file. The last is particularly useful if you have videos, that are in formats, that your browser can't play.  
**Note:** the way this tool is implemented is not particularly secure - it's meant to be easy and locally hosted (meaning you can just download the repo contents and open the index.html file and that's it). If you plan to host it for other users, please refer to the AWS guildelines and architectural propositions. Tested on Chrome and Safari.

## Features

- List and navigate through folders in an S3 bucket.
- Display images and videos from the S3 bucket.
- Download all files in a prefix as a ZIP file.
- Navigate through images using left and right arrow keys.

## Prerequisites

- Your images in an S3 Bucket.
- AWS SDK for JavaScript.
- JSZip library for creating ZIP files.
- (Optional) Node.js and npm (Node Package Manager).

## Setup

1. **Clone or download the repo:**
   
2. **Configure AWS SDK:**

    Open `script.js` and update the AWS configuration with your access key, secret access key, and region:

    ```javascript
    AWS.config.update({
        accessKeyId: 'YOUR_ACCESS_KEY',
        secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
        region: 'YOUR_REGION'
    });
    ```

3. **Update the S3 bucket name:**

    In `script.js`, update the `bucketName` variable with the name of your S3 bucket:

    ```javascript
    const bucketName = 'your-s3-bucket-name';
    ```

4. **Set up CORS for your S3 bucket:**

    To allow your web application to access the S3 bucket, you need to configure CORS (Cross-Origin Resource Sharing) for the bucket. Go to the S3 console, select your bucket, and add the following CORS configuration - this is an example for localhost, **your case might be different**:

    ```json
    [
        {
            "AllowedHeaders": [
                "*"
            ],
            "AllowedMethods": [
                "GET",
                "POST",
                "PUT",
                "DELETE",
                "HEAD"
            ],
            "AllowedOrigins": [
                "http://localhost:3000",
                "http://localhost:8080",
                "http://localhost"
            ],
            "ExposeHeaders": [
                "ETag"
            ],
            "MaxAgeSeconds": 3000
        }
    ]
    ```

5. **Create an AWS user with inline policies:**

    - Go to the IAM console and create a new user.
    - Attach the following inline policy to the user to allow access to the S3 bucket:

    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "s3:ListBucket",
                    "s3:GetObject"
                ],
                "Resource": [
                    "arn:aws:s3:::your-s3-bucket-name",
                    "arn:aws:s3:::your-s3-bucket-name/*"
                ]
            }
        ]
    }
    ```

    - Replace `your-s3-bucket-name` with the name of your S3 bucket.

6. **(Optional) Run a local server:**

    The tool doesn't require a server by itself, but I needed to do this, cause CORS wouldn't let me access the files in the S3 bucket. By doing this step you can have your tool running on localhost:8080 and just whitelist this in your bucket's CORS configuration. You can use `http-server` for this purpose.

    - Install `http-server` globally using npm:

        ```bash
        npm install -g http-server
        ```

    - **Navigate to the project directory** and run the server:

        ```bash
        http-server -p 8000
        ```

    - Open your web browser and navigate to `http://localhost:8000` to view and interact with the image gallery.

## File Structure

- `index.html`: The main HTML file that includes the structure of the web page and references to the CSS and JavaScript files.
- `styles.css`: The CSS file that contains the styles for the web page.
- `script.js`: The JavaScript file that contains the logic for connecting to the S3 bucket, listing objects, displaying images and videos, and handling downloads.
- `README.md`: This README file.

## Usage

1. **Navigate through folders:**

    Click on folder names to navigate into them. Click on the `...` item to navigate back to the parent folder.

2. **View images and videos:**

    Click on file names to view images and videos in the display area.

3. **Download all files in a folder:**

    Click the "Download All" button next to a folder name to download all files in that folder as a ZIP file.

4. **Keyboard navigation:**

    Use the left (`ArrowLeft`) and right (`ArrowRight`) arrow keys to navigate through images.
   
6. **Logging (Optional):**

   The tool has really great logging - just open the developer tools of Chrome (or whatever browser you have) and check the logs in the console.


## License

This project is licensed under the MIT License. 

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## Contact

For any questions or inquiries, please open a pull request.
