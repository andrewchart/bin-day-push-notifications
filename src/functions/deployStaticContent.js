const { app } = require('@azure/functions');
const fs = require('fs');
const path = require('path');
const { BlobServiceClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");

app.http('deployStaticContent', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {

        context.log('Deploying push subscription website to Azure Storage...');
            
        const {
            AZ_BLOB_STORAGE_URL,
            AZ_BLOB_STORAGE_NAME,
        } = process.env;

        const blobService = new BlobServiceClient(
            AZ_BLOB_STORAGE_URL, 
            new DefaultAzureCredential()
        );

        const container = blobService.getContainerClient(AZ_BLOB_STORAGE_NAME);

        // Loop through all files in the static directory and upload them
        fs.readdir(__dirname + '/static', (err, files) => {
            files.forEach(async filename => {

                let mimeType;

                switch(path.extname(filename)) {
                    case '.html':
                        mimeType = 'text/html';
                        break;

                    case '.js':
                        mimeType = 'text/javascript';
                        break;

                    default:
                        mimeType = 'text/html';
                }

                try {
                    
                    let blob = container.getBlockBlobClient(filename);

                    await blob.uploadFile(
                        __dirname + '/static/' + filename,
                        {
                            blobHTTPHeaders: {
                                blobContentType: mimeType
                            }
                        }
                    );
                } catch(err) {
                    context.error("Error deploying push subscription website: ", err);
                }
            });
        });

        return { body: 0 };

    }    
});