
/* Page Element Definitions */
const subscribeForm = document.getElementById('subscribeForm');
const subscribeBtn = document.getElementById('subscribe');

const unsubscribeForm = document.getElementById('unsubscribeForm');

subscribeForm.onsubmit = subscribe;
unsubscribeForm.onsubmit = unsubscribe;

const userFeedbackMsg = document.getElementById('userFeedbackMsg');


/* Runtime function */
(function main() {

    if("serviceWorker" in navigator) {
        navigator.serviceWorker.register('sw.js');
    
        navigator.serviceWorker.ready.then((registration) => {
        
            resetSubscribeButton();
        
            return registration.pushManager.getSubscription();
        
        }).then((subscription) => {
        
            if(subscription) {
                // Attach to window so we can reference this later e.g. for unsubscribing
                window.subscription = subscription;
    
                loadCurrentSubscriptionDetails('server');
    
                unsubscribeForm.classList.remove('hidden');
            } else {
                subscribeForm.classList.remove('hidden');
            }
        
        }).catch((error) =>{
            subscribeForm.classList.remove('hidden');
        });    
    } else {
        setMessage('error', `Your browser does not support push notifications. Please try another browser.`);
    }
    
})();


/* ServiceWorker & Push Subscription Handling */
function subscribe(event) {

    event.preventDefault();

    return Notification.requestPermission().then((permissionStatus) => {

        if(permissionStatus !== 'granted') {
            throw new Error(`You have disabled push notifications for this website in your browser.
                Please grant permission to subscribe to push notifications then try again.`);
        }

        // Validate form
        hideMessage();
    
        let validationErrors = validateSubscribeForm().errors;
    
        if(validationErrors.length > 0) {
            throw new Error('<ul><li>' + validationErrors.join('</li><li>') + '</li></ul>');
        }

        // Create push subscription
        return navigator.serviceWorker.ready.then(async (registration) => {

            //Spinner state
            subscribeBtn.disabled = true;
            subscribeBtn.value = "Please wait...";

            //Fetch Vapid Key
            let url = `${AZ_HTTP_FUNC_BASE_URL}/api/getVapidKey`;
            const vapidServerKey = await fetch(url).then(response => response.text());

            // Establish subscription in browser and server
            return registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidServerKey
            }).then((subscription) => {

                if(!subscription) {
                    throw new Error(`Failed to subscribe to push notifications. Browser subscription
                        not found. Please try again.`);
                }

                window.subscription = subscription;
                    
                let subscriptionDetails = {
                    auth: arrayBufferToString(subscription.getKey("auth")),
                    p256dh: arrayBufferToString(subscription.getKey("p256dh")),
                    endpoint: subscription.endpoint,
                    propertyNameOrNumber: document.getElementById('propertyNameOrNumber').value, 
                    street: document.getElementById('street').value, 
                    postcode: document.getElementById('postcode').value
                }
                
                return fetch(`${AZ_HTTP_FUNC_BASE_URL}/api/createSubscription`, { 
                    method: 'post',
                    body: JSON.stringify(subscriptionDetails)
                }).then((response) => {

                    if(response.status !== 201) {
                        throw new Error(`Failed to subscribe to push notifications. Server failed to
                            record subscription. Please try again.`);
                    }

                    setMessage('ok', `Successfully subscribed to push notifications.`);

                    loadCurrentSubscriptionDetails('client');

                    scrapeBinfoForNewSubscription(encodeURIComponent(subscriptionDetails.auth));

                    document.getElementById('upcomingCollections').innerHTML = '';

                    document.getElementById('upcomingCollectionsMessage').innerHTML = `Currently 
                        checking for upcoming collections... Please wait 30 seconds or 
                        <a href="javascript:;" onclick="javascript:location.reload();">refresh</a> 
                        the page.`;

                    setTimeout(loadCollectionDetails.bind(
                        null,
                        encodeURIComponent(subscriptionDetails.auth)
                    ), 30000);

                    resetSubscribeButton();

                    subscribeForm.classList.add('hidden');
                    unsubscribeForm.classList.remove('hidden');

                    return true;

                });

            }); 

        });
    }).catch(error => {
        setMessage('error', error.message);
        resetSubscribeButton();
        if("subscription" in window) deleteBrowserSubscription();
        return false;
    });
}


function validateSubscribeForm() {

    let errors = [];

    if(document.getElementById('propertyNameOrNumber').value.length === 0) {
        errors.push('Property Name or Number should be populated');
    }

    if(document.getElementById('street').value.length === 0) {
        errors.push('Street should be populated');
    }

    if(document.getElementById('postcode').value.length === 0) {
        errors.push('Postcode should be populated');
    }

    return { errors }
}


function resetSubscribeButton() {
    subscribeBtn.removeAttribute('disabled');
    subscribeBtn.value = "Subscribe";
}


function loadCurrentSubscriptionDetails(populateFrom = 'server') {

    let { subscription } = window;

    if(!subscription) throw new Error(`Unable to find push subscription.`);

    // For newly created subscriptions just display the details from the client to avoid a network call
    if(populateFrom === 'client') {
        return displayCurrentSubscriptionDetails(
            document.getElementById('propertyNameOrNumber').value,
            document.getElementById('street').value,
            document.getElementById('postcode').value,
        );
    } 
    
    // Otherwise fetch the subscription details from the server
    else {
        let key = encodeURIComponent(arrayBufferToString(subscription.getKey('auth')));
        let url = `${AZ_HTTP_FUNC_BASE_URL}/api/getSubscription?key=${key}`;

        return fetch(url).then((response) => {
    
            if(response.status !== 200) throw new Error(`Failed to retrieve subscription details`);
    
            return response.json();

        }).then((subscriptionDetails) => {

            if(subscriptionDetails.validAddress) {
                document.getElementById('upcomingCollectionsMessage').innerHTML = `Loading collection 
                    details...`;

                loadCollectionDetails(subscriptionDetails.rowKey);
        
            } else {
                document.getElementById('upcomingCollectionsMessage').innerHTML = `No bin collection
                    details were found for this address on the Woking Council website. This address
                    may not be in the Woking collection area.`;
            }
            
            return displayCurrentSubscriptionDetails(
                subscriptionDetails.propertyNameOrNumber,
                subscriptionDetails.street,
                subscriptionDetails.postcode
            );
    
        }).catch((error) => {
            setMessage('error', error.message);
            return false;
        });
    }
}


function displayCurrentSubscriptionDetails(propertyNameOrNumber, street, postcode) {
    document.getElementById('currentSubPropertyNameOrNumber').innerText = propertyNameOrNumber;
    document.getElementById('currentSubStreet').innerText = street;
    document.getElementById('currentSubPostcode').innerText = postcode;
    return true;
}


function loadCollectionDetails(subscriptionRowKey) {
    return fetch(`${AZ_HTTP_FUNC_BASE_URL}/api/getCollections?key=${subscriptionRowKey}`)
        .then(response => response.json())
        .then((result) => {

            const { collections } = result;

            // At this point, the address is considered valid but no collections have been found OR
            // more likely this is a new subscription and we haven't yet scraped Binfo, so we just 
            // don't have collection data yet.
            if(collections.length === 0) {
                return document.getElementById('upcomingCollectionsMessage').innerHTML = `Currently 
                    checking for upcoming collections... Please wait 30 seconds or 
                    <a href="javascript:;" onclick="javascript:location.reload();">refresh</a> 
                    the page.`;
            }

            return displayCollectionDetails(collections);

        }).catch(error => {
            console.log(error)
            document.getElementById('upcomingCollectionsMessage').innerHTML = `An error has occurred.
                Unable to retrieve collection data for this subscription.`;
        });
}


function displayCollectionDetails(collections) {

    let outputDays = {};

    let html = '';

    collections.forEach((collection) => {
        let utcDate = new Date(Date.parse(collection.utcDate));

        let dateAsKey = 'collday_' + [utcDate.getFullYear(), utcDate.getMonth() + 1, utcDate.getDate()].join('_');

        let dateAsStr = new Intl.DateTimeFormat('en-GB', {
            dateStyle: 'full'
        }).format(utcDate);

        if(!outputDays[dateAsKey]) {
            outputDays[dateAsKey] = {};
            outputDays[dateAsKey].collections = []
        }

        outputDays[dateAsKey].dateAsStr = dateAsStr;
        outputDays[dateAsKey].collections.push(collection.description);
    });

    for (key in outputDays) {
        let collectionDateHtml = '<h4>' + outputDays[key].dateAsStr + '</h4>';
        let collectionListHtml = '<ul><li>' + outputDays[key].collections.join('</li><li>') + '</li></ul>';

        html += collectionDateHtml + collectionListHtml;
    }

    document.getElementById('upcomingCollectionsMessage').innerHTML = '';
    document.getElementById('upcomingCollections').innerHTML = html;

    return true;
}


function scrapeBinfoForNewSubscription(subscriptionRowKey) {
    return fetch(`${AZ_HTTP_FUNC_BASE_URL}/api/scrapeBinfoSingle`, { 
        method: 'post',
        body: JSON.stringify({ key: subscriptionRowKey })
    }).catch(error => {});
}


function deleteServerSubscription() {

    let { subscription } = window;

    if(!subscription) throw new Error(`Unable to find push subscription.`);

    let subscriptionRowKey = encodeURIComponent(arrayBufferToString(subscription.getKey('auth')));

    return fetch(`${AZ_HTTP_FUNC_BASE_URL}/api/deleteSubscription`, { 
        method: 'delete',
        body: JSON.stringify({ key: subscriptionRowKey })
    }).then((response) => {

        if(response.status !== 200) {
            throw new Error(`Failed to delete push subscription. Server failed to delete subscription. 
                Please try again.`);
        }

        return true;

    }).catch((error) => {
        setMessage('error', error.message);
        return false;
    });

}


function deleteBrowserSubscription() {
    
    let { subscription } = window;

    if(!subscription) {
        unsubscribeForm.classList.add('hidden');
        subscribeForm.classList.remove('hidden');
        throw new Error('No push subscription to unsubscribe from.');
    }

    return subscription.unsubscribe().then((success) => {

        if(!success) {
            throw new Error(`Failed to unsubscribe from push notifications. Browser error. 
                Please try again.`);
        }

        unsubscribeForm.classList.add('hidden');
        subscribeForm.classList.remove('hidden');
        resetSubscribeButton();

        delete window.subscription;

        return true;

    }).catch((error) => {
        setMessage('error', error.message);
        return false;
    });

}


function unsubscribe(event) {

    event.preventDefault();

    if(!confirm("You will stop receiving push notifications for this address. Are you sure?")) {
        return false;
    }

    let deletedFromServer = deleteServerSubscription();

    if(!deletedFromServer) {
        setMessage('error', `Failed to unsubscribe from push notifications. Server error. Please
            try again.`);
        return false;
    }

    let deletedFromBrowser = deleteBrowserSubscription();

    if(!deletedFromBrowser) {
        setMessage('error', `Failed to unsubscribe from push notifications. Browser error. Please
            try again.`);
        return false;
    }

    setMessage('ok', `Successfully unsubscribed from push notifications.`);
    subscribeForm.reset();
    return true;

}


/* Utils: UI Generic Feedback Message */
function setMessage(level, msg) {

    var msgClass;

    switch(level) {
        case 'error': 
            msgClass = 'error';
            break;
        case 'warning':
            msgClass = 'warning';
            break;
        case 'ok':
            msgClass = 'ok';
            break;
        default: 
            console.error('Invalid message class');
            return;
    }

    userFeedbackMsg.innerHTML = msg;
    userFeedbackMsg.classList.remove('error','warning','ok');
    userFeedbackMsg.classList.add(msgClass);
    userFeedbackMsg.classList.remove('hidden');
}

function hideMessage() {
    userFeedbackMsg.classList.add('hidden');
}


/* Utils: iOS user hint messaging */
function iOS() {
    return [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].includes(navigator.platform)
    // iPad on iOS 13 detection
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}

if(iOS()) {
    document.body.classList.add('ios');
}


/* Utils: Convert PushSubscription keys to strings */
function arrayBufferToString(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}