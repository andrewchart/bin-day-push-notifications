
/* Page Element Definitions */
const subscribeForm = document.getElementById('subscribeForm');
const subscribeBtn = document.getElementById('subscribe');

const unsubscribeForm = document.getElementById('unsubscribeForm');

subscribeForm.onsubmit = subscribe;
unsubscribeForm.onsubmit = unsubscribe;

/* UI Generic Feedback Message */
const userFeedbackMsg = document.getElementById('userFeedbackMsg');

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


/* ServiceWorker & Push Subscription Handling */
if("serviceWorker" in navigator) {
    navigator.serviceWorker.register('sw.js');


    navigator.serviceWorker.ready.then((registration) => {
    
        subscribeBtn.removeAttribute('disabled');
    
        return registration.pushManager.getSubscription();
    
    }).then((subscription) => {
    
        if(subscription) {
            loadCurrentSubscriptionDetails();
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

                    if(response.status !== 200) {
                        deleteBrowserSubscription();
                        throw new Error(`Failed to subscribe to push notifications. Server failed to
                            record subscription. Please try again.`);
                    }

                    setMessage('ok', `Successfully subscribed to push notifications.`);
                    loadCurrentSubscriptionDetails();
                    subscribeForm.classList.add('hidden');
                    subscribeBtn.removeAttribute('disabled');
                    subscribeBtn.value = "Subscribe";
                    unsubscribeForm.classList.remove('hidden');
                    return true;

                });

            }); 

        });
    }).catch(error => {
        setMessage('error', error.message);
    });
}


function loadCurrentSubscriptionDetails() {

    return navigator.serviceWorker.ready.then((registration) => {
        return registration.pushManager.getSubscription();
    }).then((subscription) => {

        if(!subscription) throw new Error(`Unable to find push subscription`);

        let authKey = arrayBufferToString(subscription.getKey('auth'));
        let url = `${AZ_HTTP_FUNC_BASE_URL}/api/getSubscription/${authKey}`;

        return fetch(url).then((response) => {
            if(response.status !== 200) throw new Error(`Failed to retrieve subscription details`);

            return response.json();
        }).then((subscriptionDetails) => {
            const { propertyNameOrNumber, street, postcode} = subscriptionDetails;

            document.getElementById('currentSubPropertyNameOrNumber').innerText = propertyNameOrNumber;
            document.getElementById('currentSubStreet').innerText = street;
            document.getElementById('currentSubPostcode').innerText = postcode;

            return true;
        });

    }).catch((error) => {
        setMessage('error', error.message);
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


function deleteServerSubscription() {
    return true; //TODO: 
}


function deleteBrowserSubscription() {

    return navigator.serviceWorker.ready.then((registration) => {
        return registration.pushManager.getSubscription();
    }).then((subscription) => {

        if(!subscription) {
            unsubscribeForm.classList.add('hidden');
            subscribeForm.classList.remove('hidden');
            throw new Error('No push subscription to unsubscribe from.');
        }

        subscription.unsubscribe().then((success) => {
            if(!success) {
                throw new Error(`Failed to unsubscribe from push notifications. Browser error. 
                    Please try again.`);
            }

            unsubscribeForm.classList.add('hidden');
            subscribeForm.classList.remove('hidden');
            subscribeBtn.removeAttribute('disabled');
            subscribeBtn.value = "Subscribe";

            return true;
        });

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


/* iOS user hint messaging */
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

/* Utility to convert push keys to strings */
function arrayBufferToString(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}