const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");
const puppeteer = require("puppeteer");

app.timer('scrapeBinfoSchedule', {
    schedule: '0 0 1 * * 1',
    handler: async (myTimer, context) => {
        return scrapeBinfo();
    }
});

app.http('scrapeBinfoSingle', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'scrapeBinfoSingle/{subscriptionRowKey}',
    handler: async (request, context) => {
        const { subscriptionRowKey }  = request.params;
        return scrapeBinfo(encodeURIComponent(decodeURIComponent(subscriptionRowKey)));
    }    
});

app.http('getCollections', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'getCollections/{subscriptionRowKey}',
    handler: async (request, context) => {
        const { subscriptionRowKey }  = request.params;
        return {
            body: JSON.stringify({ message: 'TODO' }),
            status: 200
        };
    }    
});


async function scrapeBinfo (subscriptionRowKey = null) {

    const { 
        START_URL,
        FORM_PAGE_LINK_TEXT,
        AZ_HTTP_FUNC_BASE_URL
    } = process.env;

    let response = {
        body: JSON.stringify({ message: 'OK' }),
        status: 200
    }

    addresses = await getAddresses(subscriptionRowKey);

    // Loop through each subscription getting collection details for each address
    addresses.forEach(async (address) => {

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        const { rowKey, propertyNameOrNumber, street, postcode } = address;

        // Go to start page
        await page.goto(START_URL);

        // Navigate to address form
        await Promise.all([
            page.locator(`a ::-p-text(${FORM_PAGE_LINK_TEXT})`).click(),
            page.waitForNavigation
        ]);

        // Fill in the form
        await page.locator('#address_name_number').fill(propertyNameOrNumber);
        await page.locator('#address_street').fill(street);
        await page.locator('#address_postcode').fill(postcode);

        // Submit form
        await Promise.all([
            page.locator('#Submit').click(),
            page.waitForNavigation
        ]);

        // Choose first address if it exists, mark subscription invalid if not
        try {
            await Promise.all([
                page.locator('#property_list a').setTimeout(3000).click(),
                page.waitForNavigation
            ]);
        } catch(error) {
            await fetch(`${AZ_HTTP_FUNC_BASE_URL}/api/markInvalidAddress/${rowKey}`, { 
                method: 'PATCH'
            });
            return false;
        }

        // Parse data
        const container = '#scheduled-collections';
        await page.locator(container).waitHandle();

        const data = await page.$$eval(`${container} li`, data => 
            data.filter(li => li.innerText !== '').map(li => {
                return li.innerText;
            })
        );

        const collections = [];

        for(i = 0; i < data.length; i = i+2) {
            const collection = new Collection(rowKey, data[i], data[i+1]);
            if (collection.isRecognisedCollectionType) {
                delete collection.isRecognisedCollectionType;
                collections.push(collection);
            }
        }

        await writeCollections(collections);

        await browser.close(); 

    });

    return response;

}


function Collection(subscriptionRowKey, dateString, description) {

    this.partitionKey = subscriptionRowKey;

    const BLACK_BIN = 'Rubbish';
    const BLUE_BIN  = 'Recycling';
    const FOOD_BIN  = 'Food waste';
    const ELEC_TEXTILES = 'Batteries-small electricals-textiles';
    const GARDEN = 'Garden';

    this.rowKey = ((dateString, description) => {
        const ymd = dateString.split('/').reverse().join('_');

        switch(description) {
            case BLACK_BIN: 
                return ymd + '_BLACK_BIN';

            case BLUE_BIN:
                return ymd + '_BLUE_BIN';

            case FOOD_BIN:
                return ymd + '_FOOD_BIN';

            case ELEC_TEXTILES:
                return ymd + '_ELEC_TEXTILES';

            case GARDEN:
                return ymd + '_GARDEN';

            default: 
                return null;
        }
    })(dateString, description);


    this.utcDate = ((dateString) => {

        const dmy = dateString.split('/');

        return new Date(Date.UTC(
            dmy[2],
            dmy[1] - 1,
            dmy[0]
        ));

    })(dateString);


    this.description = ((description) => {

        switch(description) {
            case BLACK_BIN: 
                return '🗑️ Black Bin';

            case BLUE_BIN:
                return '♻️ Recycling Bin';

            case FOOD_BIN:
                return '🥗 Food Bin';

            case ELEC_TEXTILES:
                return '🪫 Electrical & Textiles';

            case GARDEN:
                return '🌳 Garden'

            default: 
                return null;
        }
        
    })(description);

    this.isRecognisedCollectionType = (this.rowKey !== null);

}


function writeCollections(collections) {
    const {
        AZ_ACCOUNT_NAME,
        AZ_ACCOUNT_KEY,
        AZ_TABLE_STORAGE_URL,
        AZ_COLLECTIONS_TABLE_NAME
    } = process.env;

    const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
    const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_COLLECTIONS_TABLE_NAME, creds);

    collections.forEach(collection => {
        client.upsertEntity(collection, "Replace");
    });
}


function readCollections(subscriptionRowKey) {
    // TODO: 
}


async function getAddresses(subscriptionRowKey = null) {

    const {
        AZ_ACCOUNT_NAME,
        AZ_ACCOUNT_KEY,
        AZ_TABLE_STORAGE_URL,
        AZ_SUBSCRIPTIONS_TABLE_NAME
    } = process.env;

    let addresses = [];

    const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
    const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);

    let query;

    if(subscriptionRowKey) query = {
        queryOptions: {
            filter: `RowKey eq '${subscriptionRowKey}'`
        }
    }
    
    let subscriptions = await client.listEntities(query);

    for await (const subscription of subscriptions) {
        addresses.push({ 
            rowKey: subscription.rowKey,
            propertyNameOrNumber: subscription.propertyNameOrNumber, 
            street: subscription.street, 
            postcode: subscription.postcode 
        });
    }

    return addresses;
}