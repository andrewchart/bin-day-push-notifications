const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");


app.http('deployStaticContent', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        
        const {
            AZ_STORAGE_URL,
            AZ_BLOB_STORAGE_NAME,
        } = process.env;

        const blobService = new BlobServiceClient(
            AZ_STORAGE_URL, 
            new DefaultAzureCredential()
        );

        const container = blobService.getContainerClient(AZ_BLOB_STORAGE_NAME);

        const blob = container.getBlockBlobClient('test.html');
        context.log('2200');
        
        await blob.uploadFile(__dirname + '/../static/index.html');
        
        return { body: 'done' };
    }
});