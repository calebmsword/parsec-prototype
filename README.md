# parsec
Parsec is a robust functional solution to asynchronous code management in JavaScript.

This library is based off the library "Parseq" by Douglas Crockford from his book "How JavaScript Works". Functionally, this library is fully equivalent, and the differences are entirely stylistic. Crockford [gives his blessing](https://github.com/douglascrockford/parseq/issues/7#issuecomment-504800341) to all who wish to reimplement Parseq.

### requestors 
In Parsec, the building block of asynchronous logic is a kind of function we call a **requestor**. A requestor performs *one unit of work*. This unit of work can be synchronous or asynchronous.

Requestors receive a callback that is called when the unit of work completes. We call these callbacks **receivers**. All receivers take exactly one argument: a *result* object. 

The result may have a `value` property which represents the result of that unit of work. If the unit of work resulted in failure, then the value is `undefined`. On failure, the result may optionally contain a `reason` property which can be used for logging purposes.

A requestor may take a second argument we call a *message*.

Requestors may optionally return a function we call a **cancellor**. The cancellor should attempt to cancel the unit of work its requestor started, and may optionally take a *reason* argument for logging purposes. In general, cancellors cannot guarantee cancellation. They can only guarantee an attempt.

```javascript
// most of the time, you create factories which create your requestors
function createGetRequestor(url) {

    // this specific requestor does not take a message
    return (receiver) => {
        try {
            const request = new XMLHttpRequest();

            request.onreadystatechange = () => {
                if (request.readyState !== 4) return;

                // send the response data to the receiver
                receiver({
                    value: {
                        status: request.status,
                        statusText: request.statusText,
                        headers: request.getAllResponseHeaders(),
                        data: request.responseText,
                    }
                });
            };

            request.open("GET", url, true);
            request.send();

            // the requestor returns a cancellor which aborts the request
            return () => request.abort();
        }
        catch(reason) {
            // if anything goes wrong, we call the receiver in a failure state
            // (notice that `result.value` is implicitly undefined)
            receiver({ reason });
        }
    }
}

// create a requestor
const getCoffees = createGetRequestor("https://api.sampleapis.com/coffee/hot");

// use the requestor
getCoffees((result) => {
    if (result.value === undefined) {
        console.log("Failure:", reason);
        return;
    }

    console.log("Success! Response is:\n", result.value.data);
});
```

### parsec and requestors
Callback hell should be avoided at all costs. To avoid directly calling another requestor inside of a receiver, Parsec provides four requestor factories which can be used to compose requestors in a maintainable way:

 - `parsec.parallel` creates a requestor which concurrently executes a collection of other requestors.

```javascript
let getStuff = parsec.parallel(
    // these requestors must all succeed for the parallel request to succeed
    [getNav, getAds, getMessageOfTheDay],

    // all parsec factories can optionally be given a configuration hash
    {
        // the parallel request will not fail if one of these requestors fail
        optionals: [getWeather, getHoroscope, getGossip],

        // the parallel request will fail if the timelimit is reached before
        // all required requestors succeed
        timeLimit: 500,

        // If time remains and the optionals have not yet succeeded, allow the
        // optionals to try to finish
        timeOption: TimeOption.TRY_OPTIONALS_IF_TIME_REMAINS
    }
);
```
   
 - `parsec.race` creates a requestor which concurrently executes multiple requestors and succeeds whenever any one requestor completes.

```javascript
let getAds = parsec.race([
    getAd(adnet.klikHaus),
    getAd(adnet.inUFace),
    getAd(adnet.trackPipe)
]);
```

 - `parsec.sequence` creates a requestor which executes a collection of requestors in order, one at a time. The results are passed from the previous requestor to the next using the *message* argument in each requestor.

```javascript
let getNav = parsec.sequence([
    getUserRecord,
    getPreference,
    getCustomNav
]);
```
   
 - `parsec.fallback` creates a requestor which executes a collection of requestors in order and succeeds once any of them succeeds.

```javascript
let getWeather = parsec.fallback([
    fetch("weather", localCache),
    fetch("weather", localDB),
    fetch("weather", remoteDB)
]);
```

Each factory in parsec returns a new requestor, meaning that the factories can be composed.

### why should I use parsec?
Using Parsec and requestors, we have clear separation of logic and control flow for asynchronous code. This is something that Promises and async-await fail to do. Simple features like throttling the number of concurrent requests to a server or cancelling a remote request, things which are inconvenient with Promises or async-await, are trivial with Parsec. Finally, the library is small and has no dependencies.

### nebula

To simply usage of Parsec, a collection of useful requestor factories is included in Nebula. 

Many of the factories in nebula create requestors for making HTTP requests.

```javascript
import nebula from "./nebula.js";

const getCoffees = nebula.ajaxGet("https://api.sampleapis.com/coffee/hot");

// We can cancel requests from nebula
const cancel = getCoffees(result => {
    if (result.value === undefined) {
        console.log("Failure because:", result.reason);
        return;
    }
    const { statusCode, statusMessage, headers, data }  = result.value;
    console.log(`status: ${statusCode} ${statusMessage}`);

    // `headers` is a JSON object
    console.log(`headers:\n ${headers}`);

    // If response is JSON, this will automatically be parsed as JSON
    console.log("The coffees:\n", data);
});
```

We can use `parsec.sequence` and `nebula` to create a requestor which requests data from one database and then stores it in another.

```javascript
import parsec from "./parsec.js";
import nebula from "./nebula.js";

const { ajaxGet, ajaxPost, map } = nebula;

const saveCoffeeToDatabase = parsec.sequence([
    ajaxGet("https://api.sampleapis.com/coffee/hot"),

    // HTTP response is an array
    map(response => response.data[0]),

    // the message sent from previous requestor is used as the POST body
    ajaxPost("https://database/endpoint/")
]);
```

Requestors and Parsec is a more robust toolset for asynchronous code management than Promises and async-await. However, many useful libraries return Promises, so nebula provides a mechanism for integrating them into Parsec.

```javascript
const fetchCoffees = nebula.usePromise(fetch("https://api.sampleapis.com/coffee/hot").then(res => res.json()), {
    // the Promise can be canceled!
    cancellable: true
});

// Make the request
const cancel = fetchCoffees(result => {
    // Failure occurs if the Promise rejects
    if (result.value === undefined) {
        console.log("Failure because:", result.reason);
        return;
    }

    // We reach here if the Promise fulfills
    console.log("All coffees:\n", result.value);
});
```

Parsec should be used as the "next step" in asychronous code management, so any time you use `usePromise`, first consider creating an alternative which returns a requestor.

### acknowledgements
 - Thanks to Douglas Crockford for freely sharing the parseq source code.
 - Thanks to GitHub users jamesdiancono and bunglegrind whose discussions in the parseq discussion forums inspired some of nebula.
 - Thanks to GitHub user driverdan for creating the node-XMLHttpRequest package, 
 which effectively prototyped the MockXMLHttpRequest class used in the nebula 
 prototype.
 - Thanks to the contributors to Lodash, whose `deepClone` method inspired the `clone` method used in the nebula prototype.
 - Thanks to aescling and redoral for comments and suggestions on parsec and nebula.
