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
function createGetRequestor(url) {
    return (receiver) => {
        try {
            const request = new XMLHttpRequest();

            request.onreadystatechange = () => {
                if (request.readyState !== 4) return;
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
        }
        catch(reason) {
            receiver({ reason });
        }
    }
}

const getCoffees = createGetRequestor("https://api.sampleapis.com/coffee/hot");
getCoffees((result) => {
    if (result.value === undefined) {
        console.log("Failure:", reason);
        return;
    }

    console.log("Success! Response is: ", result.value.data);
});
```

### parsec and requestors
Callback hell should be avoided at all costs. To avoid directly calling another requestor inside of a receiver, Parsec provides four requestor factories which can be used to compose requestors in a maintainable way:

 - `parsec.parallel` creates a requestor which concurrently executes a collection of other requestors.
 - `parsec.race` creates a requestor which concurrently executes multiple requestors and succeeds whenever any one requestor completes.
 - `parsec.sequence` creates a requestor which executes a collection of requestors in order, one at a time. The results are passed from the previous requestor to the next using the *message* argument in each requestor.
 - `parsec.fallback` creates a requestor which executes a collection of requestors in order and succeeds once any of them succeeds.

Each factory takes an array of requestors and returns a new requestor, meaning that the factories can be composed.

### why should I use parsec?
Using Parsec and requestors, we have clear separation of logic and control flow for asynchronous code. This is something that Promises and async-await fail to do. Simple features like throttling the number of concurrent requests to a server or cancelling a remote request, things which are inconvenient with Promises or async-await, are trivial with Parsec. Finally, the library is small and has no dependencies.
