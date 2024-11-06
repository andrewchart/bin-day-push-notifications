const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");
const puppeteer = require("puppeteer");

app.timer('getBinfo', {
    schedule: '0 0 1 * * 1',
    handler: async function(myTimer, context) {

        const { 
            START_URL,
            FORM_PAGE_LINK_TEXT
        } = process.env;

        const addresses = await getAddresses();

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
    
            // Choose first address
            await Promise.all([
                page.locator('#property_list a').click(),
                page.waitForNavigation
            ]);
    
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
                    collections.push(collection);
                }
            }
    
            await writeCollections(collections);
    
            await browser.close(); 

        });
    
    }
});


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


async function getAddresses() {
    const {
        AZ_ACCOUNT_NAME,
        AZ_ACCOUNT_KEY,
        AZ_TABLE_STORAGE_URL,
        AZ_SUBSCRIPTIONS_TABLE_NAME
    } = process.env;

    let addresses = [];

    const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
    const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);
    
    let subscriptions = client.listEntities();

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