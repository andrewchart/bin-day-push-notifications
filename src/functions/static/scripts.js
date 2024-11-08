
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
            let url = `${AZ_HTTP_FUNC_BASE_URL}/api/getvapidkey`;
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

                    getBinfoForNewSubscription(encodeURIComponent(subscriptionDetails.auth));

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
        let authKey = encodeURIComponent(arrayBufferToString(subscription.getKey('auth')));
        let url = `${AZ_HTTP_FUNC_BASE_URL}/api/getSubscription/${authKey}`;

        return fetch(url).then((response) => {
    
            if(response.status !== 200) throw new Error(`Failed to retrieve subscription details`);
    
            return response.json();

        }).then((subscriptionDetails) => {
            
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


function getBinfoForNewSubscription(subscriptionRowKey) {
    return fetch(`${AZ_HTTP_FUNC_BASE_URL}/api/getBinfoSingle/${subscriptionRowKey}`, { 
        method: 'post'
    }).catch(error => {});
}


function displayCurrentSubscriptionDetails(propertyNameOrNumber, street, postcode) {
    document.getElementById('currentSubPropertyNameOrNumber').innerText = propertyNameOrNumber;
    document.getElementById('currentSubStreet').innerText = street;
    document.getElementById('currentSubPostcode').innerText = postcode;
    return true;
}


function deleteServerSubscription() {

    let { subscription } = window;

    if(!subscription) throw new Error(`Unable to find push subscription.`);

    let authKey = encodeURIComponent(arrayBufferToString(subscription.getKey('auth')));

    return fetch(`${AZ_HTTP_FUNC_BASE_URL}/api/deleteSubscription/${authKey}`, { 
        method: 'delete'
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