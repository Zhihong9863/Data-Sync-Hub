// AWS SDK v3
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { customAlphabet } from 'nanoid';

const dynamoDbClient = new DynamoDBClient({ region: "us-east-2" });
const nanoid = customAlphabet('1234567890abcdef', 10);

export async function handler(event) {
    // const inputText = event.inputText;
    // const inputFilePath = event.inputFilePath; // This should be the S3 path
    // Parsing body from events received by API Gateway
    const body = JSON.parse(event.body);
    const inputText = body.inputText;
    const inputFilePath = body.inputFilePath; 
    const id = nanoid();

    //According to the requirements, we create the request body for inserting into dynamidb
    //we need to create the table fovusDB previously
    const params = {
        TableName: 'fovusDB',
        Item: {
            id: { S: id },
            input_text: { S: inputText },
            input_file_path: { S: inputFilePath },
        },
    };

    try {
        //Asynchronous function to insert the request body into the database
        await dynamoDbClient.send(new PutItemCommand(params));
        console.log(`Data saved to DynamoDB with id: ${id}`);
        return {
            statusCode: 200,
            //'Access-Control-Allow-Origin': 'http://localhost:3000' is very important since the cors problem
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'http://localhost:3000', 
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE', 
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token', 
            },
            body: JSON.stringify({ id: id }),
        };
    } catch (err) {
        console.error('Error saving to DynamoDB', err);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "http://localhost:3000" },
            body: JSON.stringify({ error: 'Error saving to DynamoDB' }),
        };
    }
};
