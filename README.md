# bin-day-push-notifications
Get push notifications when it's time to put the bins out, telling you which bins are being 
collected the next day.

> Collections tomorrow (Wed 20 Nov)
> ♻️ Recycling Bin
> 🪫 Electrical & Textiles
> 🥗 Food Bin

## Overview 
This Azure Functions app allows a user to subscribe a device to web push notifications for their 
address. The app then regularly scrapes the website of the local refuse collection service, records
upcoming collections for that address in Azure Table Storage then manages the sending of push 
notifications using Azure Notification Hubs.

My particular local authority uses a website where you have to go through a five(!) step process 
each time you want to check the bin collections; there is no single url to recall the information
for any given address. This makes checking the collection information time consuming and fiddly. 

This app means that the relevant information is pushed to my phone the day before the collection, 
telling me which bins to put out.

To find out more about what I was trying to do, check out [my blog post](https://www.andrewchart.co.uk/blog/web/development/woking-bin-collection-alerts).

## Setup
The app requires the following resources in Azure:
* An Azure Functions application
* A storage account containing:
** A blob storage bucket for the static website
** Two tables to store user subscription and bin collection data
* A Notification Hub resource


### Environment Variables
_Specified in **local.settings.json** for local environment and **Function App > Settings > Environment Variables** for running in Azure cloud._

| Variable                              | Description                                                                                                             |
|---------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| START_URL                             | Scraper: Starting URL for the scraper for my local bin website                                                          |
| FORM_PAGE_LINK_TEXT                   | Scraper: Text to look for to reach the address submission form for my local bin website                                 |
| AZ_ACCOUNT_NAME                       | Azure: Storage account name for table and blob storage                                                                  |
| AZ_ACCOUNT_KEY                        | Azure: Storage account key for table and blob storage                                                                   |
| AZ_BLOB_STORAGE_URL                   | Azure: Root URL to access the blob storage bucket                                                                       |
| AZ_BLOB_STORAGE_NAME                  | Azure: Name of the blob container for the static website files. Default is $web to serve files directly from the bucket |
| AZ_HTTP_FUNC_BASE_URL                 | Azure: The base URL for the function app to make http trigger calls                                                     |
| AZ_NOTIFICATION_HUB_CONNECTION_STRING | Azure: Connection string for the notification hub resource used to send push notifications                              |
| AZ_NOTIFICATION_HUB_NAME              | Azure: Name of the notification hub resource used to send push notifications                                            |
| AZ_COLLECTIONS_TABLE_NAME             | Azure: Name of the table used to store details of bin collections                                                       |
| AZ_SUBSCRIPTIONS_TABLE_NAME           | Azure: Name of the table used to store details of user subscriptions                                                    |
| AZ_TABLE_STORAGE_URL                  | Azure: Base URL for table storage                                                                                       |
| VAPID_SERVER_KEY                      | Azure: VAPID key generated in Azure Notification Hubs                                                                   |


---

## Application Details

### How it works


### File/Folder Structure
_The following describes the folder structure of this application:_

    .
    ├── .github                         # Example GitHub Workflow file inc. static website deployment
    ├── .vscode                         # VS Code development environment configuration to run functions locally
    ├── src                             # Azure Functions App
        └── functions                   # Individually runnable functions
            └── static                  # Files that will be deployed for the static website
    ├── .funcignore                     # See [Microsoft documentation](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=macos%2Cisolated-process%2Cnode-v4%2Cpython-v2%2Chttp-trigger%2Ccontainer-apps&pivots=programming-language-javascript#project-file-deployment)
    ├── .gitignore
    ├── host.json                       # See [Microsoft documentation](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=macos%2Cisolated-process%2Cnode-v4%2Cpython-v2%2Chttp-trigger%2Ccontainer-apps&pivots=programming-language-javascript#configure-binding-extensions)
    ├── LICENSE
    ├── local.settings.example.json     # Example of a valid local configuration file showing environment variables
    ├── package-lock.json
    ├── package.json
    ├── puppeteer.config.cjs            # Config to establish a Puppeteer cache in the working directory
    └── README.md


### Static Website


### Questions

Q: Did this take me more time to make than it will ever save me in looking up the next collection?
A: Yes, absolutely.

Q: Could this be modified to work for my own council's website?
A: Yes. Although I haven't built a framework to incorporate other websites, the 
[scraper](./src/functions/scrapeBinfo.js) could be customised to navigate your own Council's website 
and harvest appropriate data into table storage. See the [Collection constructor](./src/functions/scrapeBinfo.js) 
to see how I've modelled data for each collection.