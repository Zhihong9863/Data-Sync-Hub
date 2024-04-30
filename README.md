# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### ``



The page will reload when you make changes.\
You may also see any lint errors in the console.


# Fovus Web Application

This application allows users to upload a text input and a file to AWS S3, then processes the file in an EC2 instance, and finally records the data in a DynamoDB table.

## Prerequisites

- AWS Account
- Node.js installed
- AWS CLI configured with Administrator access

## Setup Instructions

1. Clone the repository to your local machine.
   ```bash
   git clone <repository-url>
   ```
2. Navigate into the project directory.
   ```bash
   cd <project-name>
   ```
3. Install the necessary Node.js packages.
   ```bash
   npm install
   ```

## Running the Application

1. Start the React application.
   ```bash
   npm start
   ```
   The application will be available at `http://localhost:3000`.

2. Upload a file and input text using the web UI.

3. The application will:
   - Generate a UUID for the user session.
   - Get a presigned S3 URL to upload the file directly from the browser.
   - Save the input text and file reference to DynamoDB.

## AWS Configuration Step 1

1. Set up the necessary AWS services:
   - S3 Bucket: You don't need to manually create a `[S3 Bucket]` because after the project starts, when you upload files, a uuid will be automatically generated and a bucket will be created automatically.
   - DynamoDB Table: Create a table named `fovusDB` with `id` as the primary key.

2. Configure Lambda functions to handle API Gateway requests.
   - Lambda for presigned URL creation.
   - Lambda for saving input to DynamoDB.

## Step 1 details: AWS Configuration for S3 and IAM

### IAM Role Setup
Before starting, create an IAM role named `Fovus-S3-Role` or any other roles you love that will grant the necessary permissions to the Lambda function to interact with S3.

1. Navigate to the IAM Management Console in AWS.
2. Create a new role and select AWS Lambda as the service that will use this role.
3. Attach the `AmazonS3FullAccess` policy to grant full access to S3 resources.
4. Name the role `Fovus-S3-Role`.

### S3 Bucket Creation
The S3 bucket does not need to be created manually. A unique bucket will be automatically generated for each user upon file upload based on a UUID.

## Presigned URL Lambda Function

### API Gateway Setup
1. Go to the API Gateway Console.
2. Create a new API if you don’t have one already.
3. Define a new resource `/presigned-url`.
4. Add GET and PUT methods to the `/presigned-url` resource.
   - Ensure `Proxy integration` is enabled for both methods.
   - For the PUT method, add required URL query string parameters:
     - `fileName`
     - `uuid`

### CORS Configuration
Make sure to enable CORS by checking all options. This is crucial to resolving cross-origin resource sharing issues.

### Deploy API
After making any changes or upon completing the setup, deploy your API to receive an endpoint URL. If you wish, you can customize the resource path to your preference.

## Lambda Function Creation

### Function Setup
Create a Lambda function named `PresignedURLFunction`.

1. In the configuration tab, navigate to `Permissions`.
2. Attach the `Fovus-S3-Role` to the function’s execution role.
3. In the `Trigger` section, set up triggers for the GET and PUT methods from your API Gateway.

### Function Code
Copy and paste the code for generating presigned URLs into the Lambda function's code editor.

- The code can be written in JavaScript as `.mjs` files without needing to upload a ZIP, since no external libraries are required.
- Once ready, deploy the function.

### Testing the Lambda Function
Test your Lambda function with the following sample event:

```json
{
  "httpMethod": "GET",
  "queryStringParameters": {
    "fileName": "example.txt",
    "userUUID": "123e4567-e89b-12d3-a456-426614174000"
  }
}

## Processing Script on EC2

1. The EC2 instance is triggered via a DynamoDB event.
   - The instance will be created with the required IAM roles.
   - A startup script will handle the processing:
     1. Download the file from S3.
     2. Retrieve inputs from DynamoDB.
     3. Append the text input to the file.
     4. Upload the processed file back to S3.
     5. Record the output details in DynamoDB.

2. The EC2 instance will terminate upon completion of the script.

## Clean Up

1. To avoid incurring unintended costs, make sure to delete the created AWS resources:
   - S3 buckets
   - DynamoDB tables
   - EC2 instances

## Support

For any queries or issues, please open an issue on the GitHub repository.

