import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './App.css';

function App() {
  const [inputText, setInputText] = useState(''); 
  const [selectedFile, setSelectedFile] = useState(null); 
  const [userUUID, setUserUUID] = useState('');

  useEffect(() => {
    // Generate UUID during component mounting and only once
    setUserUUID(uuidv4());
  }, []);


  const handleTextChange = (event) => {
    setInputText(event.target.value);
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const apiEndpoint_presigned = 'https://hwfncn3pc3.execute-api.us-east-2.amazonaws.com/dev/presigned-url';
  const apiEndpoint_file = 'https://hwfncn3pc3.execute-api.us-east-2.amazonaws.com/dev/file';

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      alert('Please select a file.');
      return;
    }

    if (!userUUID) {
      console.error('UUID not set. Please wait and try again.');
      return;
    }

    try {
      // Get pre signed URL
      const response = await fetch(`${apiEndpoint_presigned}?uuid=${userUUID}&fileName=${encodeURIComponent(selectedFile.name)}`);
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log(data); 

      if (!data.uploadUrl) {
        throw new Error('No upload URL returned from the server.');
      }

      const presignedUrl = data.uploadUrl;

      //The s3FilePath here is only for recording purposes. After successfully uploading the file, 
      //it will be stored in DynamoDB to record the location of each file stored in S3
      const s3FilePath = `s3://user-bucket-${userUUID}/${selectedFile.name}`

      // Upload files to S3 using a pre signed URL
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type 
        }
      });

      if (uploadResponse.ok) {

        console.log('File successfully uploaded to S3.');

        // Build user input data for saving to DynamoDB
        const userInput = {
          inputText: inputText,
          inputFilePath: s3FilePath 
        };

        // Send a POST request to another endpoint of your API Gateway (/dev/file)
        const saveDataResponse = await fetch(apiEndpoint_file, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userInput)
        });

        const saveDataResult = await saveDataResponse.json();
        console.log('Data saved to DynamoDB:', saveDataResult);

      } else {
        const text = await uploadResponse.text();
        throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText} - ${text}`);
      }
    } catch (error) {
      
      console.error('Error:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <form onSubmit={handleSubmit}>
          <label>
            Text input:
            <input type="text" value={inputText} onChange={handleTextChange} />
          </label>
          <br />
          <label>
            File input:
            <input type="file" onChange={handleFileChange} />
          </label>
          <br />
          <button type="submit">Submit</button>
        </form>
      </header>
    </div>
  );
}

export default App;

