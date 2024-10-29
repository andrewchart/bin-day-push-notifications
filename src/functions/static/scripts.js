
/* Page Element Definitions */
const subscribeForm = document.getElementById('subscribeForm');
const subscribeBtn = document.getElementById('subscribe');

const unsubscribeForm = document.getElementById('unsubscribeForm');

subscribeForm.onsubmit = subscribe;
unsubscribeForm.onsubmit = unsubscribe;

/* UI Message */
const message = document.getElementById('message');

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

    message.innerHTML = msg;
    message.classList.remove('error','warning','ok');
    message.classList.add(msgClass);
    message.classList.remove('hidden');
}

function hideMessage() {
    message.classList.add('hidden');
}


/* ServiceWorker & Push Subscription Handling */
navigator.serviceWorker.register('sw.js');


navigator.serviceWorker.ready.then((registration) => {

    subscribeBtn.removeAttribute('disabled');

    return registration.pushManager.getSubscription();

}).then((subscription) => {

    if(subscription) {
        loadCurrentSubscriptionAddressDetails();
        unsubscribeForm.classList.remove('hidden');
    } else {
        subscribeForm.classList.remove('hidden');
    }

});


function subscribe(event) {

    event.preventDefault();

    Notification.requestPermission().then((permissionStatus) => {
        if(permissionStatus !== 'granted') {
            return setMessage('error', `You have disabled push notifications for this website in your 
                browser. Please grant permission to subscribe to push notifications then try 
                again.`);
        }

        hideMessage();

        navigator.serviceWorker.ready.then(async (registration) => {

            //Fetch Vapid Key
            let url = `${AZ_HTTP_FUNC_BASE_URL}/api/getvapidkey`;
            const vapidServerKey = await fetch(url).then(response => response.text());

            registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidServerKey
            }).then((subscription) => {

                if(subscription) {
                    console.log(subscription);    

                    // TODO: send to server
                    
                    // TODO: store form details locally 

                    setMessage('ok', `Successfully subscribed to push notifications.`);
                    loadCurrentSubscriptionAddressDetails();
                    subscribeForm.classList.add('hidden');
                    unsubscribeForm.classList.remove('hidden');

                } else {
                    setMessage('error', `Failed to subscribe to push notifications. Please try again`);
                }

            }); 
        });
    });
}


function loadCurrentSubscriptionAddressDetails() {
    document.getElementById('currentSubPropertyNameOrNumber').innerText = '1';
    document.getElementById('currentSubStreet').innerText = 'High Street';
    document.getElementById('currentSubPostcode').innerText = 'GU1 1AB';
}


function unsubscribe(event) {

    event.preventDefault();

    if(!confirm("You will stop receiving push notifications for this address. Are you sure?")) {
        return false;
    }

    navigator.serviceWorker.ready.then((registration) => {
        return registration.pushManager.getSubscription();
    }).then((subscription) => {

        if(!subscription) {
            unsubscribeForm.classList.add('hidden');
            subscribeForm.classList.remove('hidden');
            throw new Error('No push subscription to unsubscribe from.');
        }

        // TODO: remove from database

        subscription.unsubscribe().then((success) => {
            if(success) {
                setMessage('ok', `Successfully unsubscribed from push notifications.`);
                unsubscribeForm.classList.add('hidden');
                subscribeForm.classList.remove('hidden');
            } else {
                throw new Error('Failed to unsubscribe from push notifications. Please try again.');
            }
        });

    }).catch((error) => {
        setMessage('error', error);
    });

}