const { app } = require('@azure/functions');
const puppeteer = require("puppeteer");

app.timer('getBinfo', {
    schedule: '0 0 1 * * 1',
    handler: async function(myTimer, context) {

        context.log('Hello Binfo.');

        const { 
            START_URL,
            FORM_PAGE_LINK_TEXT,
            PROPERTY_NAME_OR_NUMBER,
            STREET,
            POSTCODE 
        } = process.env;

        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();

        // Go to start page
        await page.goto(START_URL);

        // Navigate to address form
        await Promise.all([
            page.locator(`a ::-p-text(${FORM_PAGE_LINK_TEXT})`).click(),
            page.waitForNavigation
        ]);

        // Fill in the form
        await page.locator('#address_name_number').fill(PROPERTY_NAME_OR_NUMBER);
        await page.locator('#address_street').fill(STREET);
        await page.locator('#address_postcode').fill(POSTCODE);

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

        // TODO: Parse data

        await browser.close();
    
    }
});
