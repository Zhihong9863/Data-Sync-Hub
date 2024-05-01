# Fovus Web Application

This application allows users to upload a text input and a file to AWS S3 and store into DynamoDB, then processes the file in an EC2 instance, and finally You will find two records in S3 and Dynamodb, one is the uploaded file, and the other is the updated file by adding the content of the text box to the file.

## Prerequisites

- AWS Account
- Node.js installed
- AWS CLI configured with Administrator access

## Setup Instructions

1. Clone the repository to your local machine.
   ```bash
   git clone (https://github.com/Zhihong9863/fovusAWS.git)
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

## AWS Configuration and Automation Flow

1. S3 Bucket & DynamoDB Table:
   - A unique `S3 Bucket` is automatically created when you start the project and upload files, identified by a `UUID`.
   - A DynamoDB table named `fovusDB` is to be set up with `id` as the primary key for storing file metadata.

2. Lambda Function Integration:
   - A Lambda function is configured to generate presigned URLs, allowing secure, direct file uploads to the S3 Bucket.
   - Another Lambda function is established to record the input text and file metadata into the fovusDB table after the upload.

2. EC2 Processing Triggered by DynamoDB:
   - Upon a new file upload and DynamoDB entry, a Lambda function triggers an EC2 instance to process the file.
   - The EC2 instance runs a user data script that installs required packages, processes the file by appending input text, and uploads it back to S3.
   - Details of the processed file are then recorded back in the `fovusDB` table, and the EC2 instance terminates to conclude the workflow.

## Step 1 details: AWS Configuration for S3 and IAM

### IAM Role Setup
Before starting, create an IAM role named `Fovus-S3-Role` or any other roles you love that will grant the necessary permissions to the Lambda function to interact with S3.

1. Navigate to the IAM Management Console in AWS.
2. Create a new role and select AWS Lambda as the service that will use this role.
3. Attach the `AmazonS3FullAccess` policy to grant full access to S3 resources.
4. Name the role `Fovus-S3-Role`.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/69622dba-dcdc-43fd-a941-9b719d13e361)


### S3 Bucket Creation
The S3 bucket does not need to be created manually. A unique bucket will be automatically generated for each user upon file upload based on a UUID.

## Presigned URL Lambda Function

### API Gateway Setup
1. Go to the API Gateway Console.
2. Create a new API if you don’t have one already. Mine is called FovusAPI
3. Define a new resource `/presigned-url`.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/1aaa09ed-b085-4499-a79d-2d474a69620b)
4. Add GET and PUT methods to the `/presigned-url` resource.
   - Ensure `Proxy integration` is enabled for both methods.
   - For the GET method, add required URL query string parameters:
     - `fileName`
     - `uuid`
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/d84102c8-fc45-4fd7-9036-21791227be88)

### CORS Configuration
Make sure to enable CORS by checking all options. This is crucial to resolving cross-origin resource sharing issues.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/0adfb6c4-e428-436f-82c6-5123ef246909)

### Deploy API
1. After making any changes or upon completing the setup, deploy your API to receive an endpoint URL. If you wish, you can customize the resource path to your preference.
2. Here is my API path, please change yourself and remember add the path you defined "https://hwfncn3pc3.execute-api.us-east-2.amazonaws.com/dev/presigned-url"

## Lambda Function Creation

### Function Setup
Create a Lambda function named `PresignedURLFunction`.

1. In the configuration tab, navigate to `Permissions`.
2. Attach the `Fovus-S3-Role` to the function’s execution role.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/47e3cb6c-17a1-4348-99fa-0593ea4b46af)
3. In the `Trigger` section, set up triggers for the GET and PUT methods from your API Gateway.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/2e55e00b-c9d5-46ba-b7eb-5f4bafa41e4b)


### Function Code
Copy and paste the code for generating presigned URLs into the Lambda function's code editor.

- The code can be written in JavaScript as `.mjs` files without needing to upload a ZIP, since no external libraries are required.
- Once ready, deploy the function.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/4bd462f0-468f-41a4-8e93-9a388653bf4e)

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
```

## Step 2 details: Saving Inputs and Paths in DynamoDB via API Gateway and Lambda

### DynamoDB Table Setup
1. Create the DynamoDB table where the file metadata will be stored.
   - Go to the DynamoDB Console in AWS.
   - Create a new table named `fovusDB`.
   - Set the partition key to `id` (String).
   - Leave the default settings for the rest and create the table.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/fc34228a-2871-4921-b345-7d3586894743)

### IAM Role for DynamoDB Access
2. Create an IAM role for Lambda to interact with DynamoDB.
   - Name the role `LambdaDynamoDBAccessRole`.
   - Attach an inline policy that grants full access to DynamoDB, or you can attach the managed policy `AmazonDynamoDBFullAccess`. If creating an inline policy, you can use the following JSON as a template, replacing the resource ARN with your table's ARN:
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/5e997760-345b-4110-90d4-bf7609852e3a)
   
```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"dynamodb:*"
			],
			"Resource": "arn:aws:dynamodb:us-east-2:123456789012:table/fovusDB"
		}
	]
}
```

### API Gateway Setup for Data Insertion
3. Define a new endpoint in API Gateway to handle data insertion.
   - Create a new resource named `/file`.
   - Add a `POST` method to the `/file` resource.
   - Enable `Proxy integration` for the method.
   - Set up CORS by enabling it just as you did with the previous resource.
   - Here is my API path, please change yourself and remember add the path you defined "[https://hwfncn3pc3.execute-api.us-east-2.amazonaws.com/dev/presigned-url](https://hwfncn3pc3.execute-api.us-east-2.amazonaws.com/dev/file)"
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/e7ae29e4-d5ac-48e3-a599-483a35820e34)

### Lambda Function for Data Insertion
4. Set up the Lambda function that will insert data into DynamoDB.
   - Create a new Lambda function named `DataInsertFunction`.
   - In the `Configuration` tab, under `Permissions`, assign the `LambdaDynamoDBAccessRole` to the function’s execution role.
   - Set up the `/file` API Gateway endpoint as the trigger.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/fba20d95-a3e0-4dad-ae4a-d9a1355cf178)
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/e054327b-8cdf-492e-a56d-627de82f90dc)


### Packaging External Dependencies
5. Since the function requires the `nanoid` library, which is an external dependency, package your function and dependencies into a ZIP file.
   - Navigate to your Lambda function's folder.
   - Include `package.json` and the `DataInsertFunction.mjs` in a new directory.
   - If there are any unnecessary dependencies listed in `package.json`, feel free to remove them to minimize the package size.
   - Zip the directory.
   - The reason for this step is that AWS Lambda needs all external dependencies to be included in the uploaded package.

### Deploying the Lambda Function
6. Upload the ZIP package to your Lambda function via the AWS Console.
   - Ensure that you deploy the function after uploading.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/be7824bb-cc6a-4846-8346-c904166b3790)


## Final Step details: Processing Files with EC2 Instance Triggered by DynamoDB Event

### IAM Roles Creation

1. **Lambda Role (launchEC2):**
   - Create an IAM role `lambdaEC2` for the Lambda function that triggers the EC2 instance.
   - Use the following policy to grant the Lambda function permissions to interact with various AWS services. This includes EC2 for instance creation/termination, logging for CloudWatch logs, and SNS for notifications if required:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "VisualEditor0",
			"Effect": "Allow",
			"Action": [
				"sns:*",
				"logs:CreateLogStream",
				"ec2:*",
				"logs:CreateLogGroup",
				"logs:PutLogEvents"
			],
			"Resource": "*"
		}
	]
}
```

   - This policy grants the Lambda function the ability to assign the launchEC2_second IAM role to EC2 instances it launches, enabling those instances to perform actions requiring specific permissions, such as accessing S3 or DynamoDB resources. The policy's condition ensures the role is only passed to the EC2 and Lambda services for security purposes.

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": "iam:PassRole",
			"Resource": "arn:aws:iam::665294208057:role/launchEC2_second",
			"Condition": {
				"StringEquals": {
					"iam:PassedToService": [
						"ec2.amazonaws.com",
						"lambda.amazonaws.com"
					]
				}
			}
		}
	]
}
```
   - Attach additional policies for full DynamoDB and S3 access.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/11c3a934-6232-4e3b-b064-849a78f7cabc)


2. **EC2 Role (launchEC2_second):**
   - Create another IAM role `launchEC2_second` for the EC2 instances to be launched.
   - This role grants the EC2 instance permissions to access S3 and DynamoDB, and to log to CloudWatch.

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "VisualEditor0",
			"Effect": "Allow",
			"Action": [
				"s3:GetObject",
				"s3:PutObject",
				"dynamodb:PutItem",
				"logs:*"
			],
			"Resource": "*"
		}
	]
}
```
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/8e2c03d2-144a-44f6-9a28-b45d046bf25a)


### Lambda Function Setup for Triggering EC2 Instances
3. Set up a Lambda function named ProcessFileFunction.
   - Under the Configuration tab, assign the `lambdaEC2` role to the function’s execution role.
   - Configure the DynamoDB `fovusDB` table as a trigger for this Lambda function.
   - Ensure the trigger is set for new item creation events.
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/e26c1ec7-d4e0-4a0b-a830-d6a81693dca1)
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/18277479-9fb6-4e84-a7ec-0c16d157777b)
   - upload the zip file including package.json, node_modules and launchEC2Instance.mjs as mention aboved (nanoid library is outside package dependecy).
![image](https://github.com/Zhihong9863/fovusAWS/assets/129224800/9bb77816-419a-4123-890a-bb1495ed8392)



### EC2 Instance Scripting
4. When a new file is uploaded and a new item is created in fovusDB, the Lambda function will:
   - Create a new EC2 instance with a user data script to process the file.
   - The user data script performs the following actions:
      - Installs necessary packages and updates.
      - Downloads the input file from S3.
      - Appends the input text to the file.
      - Uploads the updated file back to S3.
      - Records the output file path in the `fovusDB` DynamoDB table.
      - Terminates the EC2 instance upon completion.


### Code Highlights
5. Within the Lambda function, key pieces of code include(Details are in the command line in launchEC2Instance.mjs):
   - `IamInstanceProfile` specifies the IAM role `launchEC2_second` to be used by the `EC2 instance`.
   - The Bash script within the `userDataScript` variable which orchestrates the download, processing, and upload of the file.
   - Logging commands to aid in debugging and tracking the process flow within the EC2 instance.

### Deployment and Testing
6. After implementing the Lambda function:
   - Deploy the function in the AWS Console.
   - Test by uploading a file through the application interface.
   - Verify that the EC2 instance is created, the file is processed, and the DynamoDB table is updated with the output file path.
   - Monitor CloudWatch logs for any potential issues or to confirm successful executions.


## Debugs and Reference

1. origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource. 
   - https://stackoverflow.com/questions/57009371/access-to-xmlhttprequest-at-from-origin-localhost3000-has-been-blocked
   - https://stackoverflow.com/questions/43871637/no-access-control-allow-origin-header-is-present-on-the-requested-resource-whe
   - https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html

2. {"errorType":"Runtime.ImportModuleError","errorMessage":"Error: Cannot find module 'index'\nRequire stack:\n- /var/runtime/index.mjs","trace":
    - https://stackoverflow.com/questions/75678115/error-cannot-find-module-index-nrequire-stack-n-var-runtime-index-mjs
   
3. GET https://hwfncn3pc3.execute-api.us-east-2.amazonaws.com/dev?fileName=test.txt 403 // PUT http://localhost:3000/undefined 404 (Not Found)
   - https://stackoverflow.com/questions/68273500/api-gateway-configuration-returns-403
  
4. Cannot find package 'nanoid' imported from /var/task/index.mjs
   - https://repost.aws/questions/QUEx1pFI3kSsCMRlu3UuBa_g/error-cannot-find-module-nanoid-when-invoking-lambda-function
   - https://stackoverflow.com/questions/41750026/aws-lambda-error-cannot-find-module-var-task-index

5. "errorMessage": "\"undefined\" is not valid JSON"
   - https://blog.hubspot.com/website/json-response-error-wordpress

6. aws cli command study
   - https://stackoverflow.com/questions/33513604/call-aws-cli-from-aws-lambda
   - https://www.pluralsight.com/cloud-guru/labs/aws/creating-an-ec2-instance-with-lambda-in-aws
   - https://docs.aws.amazon.com/systems-manager/latest/userguide/documents-creating-content.html
   - https://www.bluematador.com/learn/aws-cli-cheatsheet

7. how to shut down ec2 instance using lambda automatically
   - https://docs.aws.amazon.com/AWSEC2/latest/WindowsGuide/instance-metadata-v2-how-it-works.html
   - https://docs.aws.amazon.com/AWSEC2/latest/WindowsGuide/instance-identity-documents.html

8. Write data to a table using the console or AWS CLI
   - https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/getting-started-step-2.html

9. Create a presigned URL for Amazon S3 using an AWS SDK
    - https://docs.aws.amazon.com/AmazonS3/latest/userguide/example_s3_Scenario_PresignedUrl_section.html

10. Cannot read properties of undefined (Reading 'S')
    - self debug to solve event concuurency (in the code of launchEC2Instance.mjs)
![337ef0f188b5fc956e2cff8dbd564b1](https://github.com/Zhihong9863/fovusAWS/assets/129224800/d5202cff-b84f-4157-a3c2-cbecd749c3e8)
![313d4f5ca3192f0773e981a90ac5c86](https://github.com/Zhihong9863/fovusAWS/assets/129224800/fea764f5-e8b2-4ba1-9ccb-e9daa14276f8)


## Real-time running condition
1. Project Running condition
![5e565d9f42f2e70a55713d705f4163c](https://github.com/Zhihong9863/fovusAWS/assets/129224800/e6adae31-bb6d-4140-b68c-2346ae239fe8)

2.EC2 Running condition, running and terminated automatically
![e1e370a813ed50b167576458a3493192_](https://github.com/Zhihong9863/fovusAWS/assets/129224800/5c261d77-7584-488f-9db5-08e4022d21ea)
![14c8e92c38821f6849d0982058ae5add_](https://github.com/Zhihong9863/fovusAWS/assets/129224800/75b0ec91-0635-49fe-9b24-c488a1c5da81)
![631281f0a539d2a2f22a89ce5ac2f093_](https://github.com/Zhihong9863/fovusAWS/assets/129224800/df73d10f-9a1d-49a9-8e26-99e6cade4005)
![ae02db427e4e5242044f7ad13ea96e63_](https://github.com/Zhihong9863/fovusAWS/assets/129224800/e2f94238-94d5-497d-802f-5437367e89cd)

3. Store into S3, each user has their itself bucket, using uuid to distinuish, and has input file and output file(output file here I used `date` naming them to distinguish the difference) 
![6fc6dd77c963c98fec21e05863f4871e_](https://github.com/Zhihong9863/fovusAWS/assets/129224800/fcededca-62cf-4392-a331-05a2485a4ab9)
![0b42224f82f3f06072f4f224ed66d22f_](https://github.com/Zhihong9863/fovusAWS/assets/129224800/07424776-b943-4e48-a1a7-caca660951c2)

4. Store into DynamoDB, and has input file and output file
![2ed108e591845d378618609cf971a366_](https://github.com/Zhihong9863/fovusAWS/assets/129224800/be2c8bbf-b647-40a7-bf3b-0f55dd9d898f)

5. Download the updated file again, and you can see that the word successful has been successfully added to the original hello world of the file
![19f399b0b213d4e92414d2bdf73086af_](https://github.com/Zhihong9863/fovusAWS/assets/129224800/fed51689-170f-4967-b1d7-dab1afc65de1)


## Clean Up

1. To avoid incurring unintended costs, make sure to delete the created AWS resources:
   - S3 buckets
   - DynamoDB tables
   - EC2 instances

## Support And Completion status

**all basic requirements have finished**
For any queries or issues, please email me at "hezhihong98@gmail.com"

