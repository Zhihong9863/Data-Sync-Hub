// AWS SDK v3
import { S3Client, CreateBucketCommand, PutBucketCorsCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Create S3 client instance
const s3Client = new S3Client({ region: "us-east-2" });

export async function handler(event) {
    // Parse the file name and user's unique identifier (UUID) transmitted from the front-end
    const fileName = decodeURIComponent(event.queryStringParameters.fileName);
    //This parameter needs to be passed from the front-end
    const userUUID = event.queryStringParameters.uuid;
    //Unique bucket name created for each user
    const bucketName = `user-bucket-${userUUID}`; 

    // Attempt to create storage bucket
    try {
        const createBucketCommand = new CreateBucketCommand({
            Bucket: bucketName
        });
        await s3Client.send(createBucketCommand);
        console.log(`Bucket created: ${bucketName}`);
    } catch (err) {
        // If the storage bucket already exists, capture and ignore the error
        if (err.name !== "BucketAlreadyExists" && err.name !== "BucketAlreadyOwnedByYou") {
            console.error("Error creating the bucket", err);
            return {
                statusCode: 500,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: err.message }),
            };
        }
    }
    
    // Set CORS configuration
    const corsConfig = {
        Bucket: bucketName,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedHeaders: ["*"],
                    AllowedMethods: ["PUT", "POST", "GET", "DELETE"],
                    AllowedOrigins: ["http://localhost:3000"], // The address where our project was launched
                    MaxAgeSeconds: 3000
                },
            ],
        },
    };

    try {
        //Send a new PutBucketCorsCommand object using s3Client, which contains configuration information for CORS
        await s3Client.send(new PutBucketCorsCommand(corsConfig));
        console.log(`CORS configuration set for bucket: ${bucketName}`);
    } catch (err) {
        console.error("Error setting CORS configuration", err);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: "Error setting CORS configuration" }),
        };
    }

    // Create PutObject Command command
    const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
    });

    try {
        // Generate a pre signed URL and set the expiration time to 1 hour
        const url = await getSignedUrl(s3Client, putCommand, { expiresIn: 3600 }); 
        console.log(`Generated presigned URL: ${url}`);

        return {
            statusCode: 200,
            //The setting of the request header is very important here, especially the Access Control Allow Origin, 
            //which is the key to solving cross domain problems. Here, we allow our project address to
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'http://localhost:3000', 
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            },
            body: JSON.stringify({ uploadUrl: url }),
        };
    } catch (err) {
        console.error("Error creating presigned URL", err);
        return {
            statusCode: 500,
            //same reason as aboved, the same important even in the catch body
            headers: { "Access-Control-Allow-Origin": "http://localhost:3000" },
            body: JSON.stringify({ error: 'Error creating presigned URL' }),
        };
    }
};
