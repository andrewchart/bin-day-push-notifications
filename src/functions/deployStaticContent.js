const { app } = require('@azure/functions');
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

        const blob = container.getBlockBlobClient('index.html');
        
        try {
            await blob.uploadFile(
                __dirname + '/static/index.html',
                {
                    blobHTTPHeaders: {
                        blobContentType: 'text/html'
                    }
                }
                );
        } catch(err) {
            context.error("Error deploying push subscription website: ", err);
        }
        
        return { body: 0 };

    }    
});