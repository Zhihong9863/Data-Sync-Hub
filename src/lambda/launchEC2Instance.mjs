import { EC2Client, RunInstancesCommand, DescribeSecurityGroupsCommand, CreateSecurityGroupCommand, AuthorizeSecurityGroupIngressCommand } from '@aws-sdk/client-ec2';
import { customAlphabet } from 'nanoid';

const ec2Client = new EC2Client({ region: 'us-east-2' });
const nanoid = customAlphabet('1234567890abcdef', 10);

/*
Create a function specifically to add a timestamp to the file name, 
which will serve as the naming format for our output file, 
to distinguish the updated file names after users upload the file

format example: "s3://user-bucket-de3cc8b8-17da-45cd-aa0c-fb32561f5eb0/test.txt"
*/
function createTimestampedFileName(filePath) {
    //If filePath is empty or undefined, an error is thrown.
    if (!filePath) {
        throw new Error('filePath is undefined or empty');
    }

    //Get the current timestamp.
    const timestamp = Date.now();
    const parts = filePath.split('/');

    //If there are less than 3 parts after path segmentation, 
    //it indicates that the path may not meet the expected S3 path format and an error is thrown.
    if (parts.length < 3) {
        throw new Error('filePath does not seem to be a valid S3 path');
    }
    //Remove and retrieve the file name section (the last part of the path)
    const fileName = parts.pop();
    //Get bucket name, located in the third part of the path
    const bucketName = parts[2];
    const fileParts = fileName.split('.');

    //If the file name does not contain at least one dot (i.e. no extension), an error is thrown.
    if (fileParts.length < 2) {
        throw new Error('fileName does not seem to have a valid extension');
    }
    const extension = fileParts.pop();
    const baseName = fileParts.join('.');
    //Create a new file name in the format of "base name + timestamp + extension".
    const processedFileName = `${baseName}_${timestamp}.${extension}`;
    return { processedFileName, bucketName };
}

export const handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        //We need to differentiate the content we want based on the results obtained from the console log, in the following format
        /**
         * "NewImage": {
                    "input_text": {
                        "S": "789"
                    },
                    "input_file_path": {
                        "S": "s3://user-bucket-de3cc8b8-17da-45cd-aa0c-fb32561f5eb0/test.txt"
                    },
                    "id": {
                        "S": "4c491b41fb"
                    }
                },
         */
        console.log('Record:', JSON.stringify(record.dynamodb, null, 2));

        /**
         * Dealing with unexpected situations when threads are concurrent, such as files not yet uploaded, 
         * where the output file of the previous file is read first due to stream backlog or delay. 
         * At this time, we have not yet created the file, which can lead to accessing an undefined file or 
         * accidentally triggering this stream when we delete a file in dynamidb
         */
        if (record.eventName !== 'INSERT') {
            console.log('Skipping non-insert event:', record.eventName);
            continue;
        }

        if (!record.dynamodb.NewImage.input_file_path || !record.dynamodb.NewImage.input_text) {
            console.log('Missing input_file_path or input_text in the record:', JSON.stringify(record));
            continue;
        }
        
        //Execute the following script only when our database operation is an insert operation
        if (record.eventName === 'INSERT') {
            //according to the requirment, we use nanoid to create a fileid
            const fileId = nanoid();
            
            //according to the aboved file format, we access these syntaxs via this way
            const inputFilePath = record.dynamodb.NewImage.input_file_path.S;
            const inputText = record.dynamodb.NewImage.input_text.S;

            //in order any errors that we can go to cloud watch to check our logs
            console.log('fileId:', fileId);
            console.log('inputFilePath:', inputFilePath);
            console.log('inputText:', inputText);

            if (!inputFilePath || typeof inputFilePath !== 'string') {
                console.error('inputFilePath is not a string or is missing:', inputFilePath);
                continue;
            }

            //Create our output file path by calling the above function
            const { processedFileName, bucketName } = createTimestampedFileName(inputFilePath);
            const outputFilePath = `s3://${bucketName}/${processedFileName}`;
            console.log('outputFilePath:', outputFilePath);

            // The base64 encoded user data script that will be run when the EC2 instance starts
            const userDataScript = 
            `#!/bin/bash

            # Output start flag
            echo "Starting script execution."
            
            sudo yum install ec2-instance-connect
            
            # Update package index, print only when errors occur
            yum update -y || { echo "Failed to update packages."; exit 1; }
            
            # Installing AWS CLI
            yum install -y awscli || { echo "Failed to install AWS CLI."; exit 1; }
            
            # Download input files 
            aws s3 cp ${inputFilePath} /tmp/input-file.txt || { echo "Failed to download input file."; exit 1; }
            
            # Add input text to the file
            echo "${inputText} " >> /tmp/input-file.txt || { echo "Failed to append text."; exit 1; }
            
            # Upload output file to S3
            aws s3 cp /tmp/input-file.txt ${outputFilePath} || { echo "Failed to upload output file."; exit 1; }
            
            # Save output and S3 path to DynamoDB
            aws dynamodb put-item \
                --table-name fovusDB \
                --item \
                    '{"id": {"S": "${fileId}"}, "output_file_path": {"S": "${outputFilePath}"}}' \
                --region us-east-2 || { echo "Failed to update DynamoDB."; exit 1; }

            # Obtain Token
            TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s)
            
            # Using tokens to obtain instance IDs because IMDSv2 is required
            INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/instance-id)
            
            # Check if the INSTANCE ID is valid
            if [[ "$INSTANCE_ID" =~ ^i- ]]; then
                # Terminate the VM
                aws ec2 terminate-instances --instance-ids $INSTANCE_ID --region us-east-2 || { echo "Failed to terminate instance."; exit 1; }
            else
                echo "Invalid instance ID received: $INSTANCE_ID"
                exit 1
            fi

            echo "Script execution finished successfully."       
            `;

            const base64UserData = Buffer.from(userDataScript).toString('base64');

            // Check if the security group already exists
            let securityGroupId;
            try {
                const describeSecGroupsResponse = await ec2Client.send(new DescribeSecurityGroupsCommand({
                GroupNames: ['lambda-security-group'],
                }));
                securityGroupId = describeSecGroupsResponse.SecurityGroups[0].GroupId;
                console.log('Existing security group ID:', securityGroupId);
            } catch (error) {
                if (error.name === 'InvalidGroup.NotFound') {
                // Create the security group if it does not exist
                const createSecGroupResponse = await ec2Client.send(new CreateSecurityGroupCommand({
                    Description: 'Lambda created security group',
                    GroupName: 'lambda-security-group',
                }));
                securityGroupId = createSecGroupResponse.GroupId;
                console.log('New security group ID:', securityGroupId);
                } else {
                // Log other errors
                console.error('Error checking for security group:', error);
                }
            }
        
            // Before authorizing SSH access for the security group, check if the rule already exists
            try {
                const describeSecGroupsResponse = await ec2Client.send(new DescribeSecurityGroupsCommand({
                GroupIds: [securityGroupId]
                }));
                const existingPermissions = describeSecGroupsResponse.SecurityGroups[0].IpPermissions;
                let ruleExists = false;
                for (const perm of existingPermissions) {
                if (perm.IpProtocol === "tcp" && perm.FromPort === 22 && perm.ToPort === 22 &&
                    perm.IpRanges.some(range => range.CidrIp === "0.0.0.0/0")) {
                    ruleExists = true;
                    break;
                }
                }
            
                if (!ruleExists) {
                await ec2Client.send(new AuthorizeSecurityGroupIngressCommand({
                    GroupId: securityGroupId,
                    IpPermissions: [
                    {
                        IpProtocol: "tcp",
                        FromPort: 22,
                        ToPort: 22,
                        IpRanges: [{ CidrIp: "0.0.0.0/0" }],
                    },
                    ],
                }));
                console.log('Security rule added successfully.');
                } else {
                console.log('Security rule already exists, no need to add.');
                }
            } catch (error) {
                console.error('Error adding or checking security rule:', error);
            }

            //Instance Details
            /**
             * The reason why we provide so many parameters when creating an EC2 instance is because we encounter a situation 
             * where EC2 Instance Connect is unable to connect to your instance, so we must provide a complete configuration
             */
            const instanceDetails = {
                ImageId: 'ami-09b90e09742640522',
                InstanceType: 't2.micro',
                KeyName: 'ec2-default',
                UserData: base64UserData,
                MinCount: 1,
                MaxCount: 1,
                SecurityGroupIds: [securityGroupId],
                IamInstanceProfile: {
                    Name: 'launchEC2_second',
                },
            };

            try {
                //Create a new RunInstancesCommand object that contains detailed information about the instance
                const runCommand = new RunInstancesCommand(instanceDetails);
                //Use ec2Client to send a runCommand and start a new EC2 instance
                //This operation is asynchronous, so we use await to wait for it to complete
                const launchResponse = await ec2Client.send(runCommand);
                console.log('EC2 Launch Response:', launchResponse);
            } catch (err) {
                console.error('Error launching EC2 instance:', err);
            }
        }
    }
};
