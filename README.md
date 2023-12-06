# parseq
Parseq is a robust functional solution to asynchronous code management in JavaScript.

This library is based off a library of the same name by Douglas Crockford from his book "How JavaScript Works". Functionally, this library is fully equivalent, and the differences are entirely stylistic. Crockford [gives his blessing](https://github.com/douglascrockford/parseq/issues/7#issuecomment-504800341) to all who wish to reimplement Parseq.

### requestors 
In Parseq, the building block of asynchronous logic is a kind of function we call a **requestor**. A requestor performs *one unit of work* which typically involves asynchronous requests.

Requestors receive a callback that is called when the unit of work completes. The callback receives a *value* argument which represents the result of that unit of work.

A value of `undefined` represents a failure which the callback can handle however it wishes. On failure, the callback may optionally receive a second argument we refer to as a *reason*.

Requestors may optionally return a function we call a **cancellor**. The cancellor should attempt to cancel the unit of work its requestor started. In general, cancellors cannot guarantee cancellation. They can only guarantee an attempt.

### parsec and requestors
Callback hell should be avoided at all costs. Instead of passing nested callbacks as the argument to a requestor, Parseq provides four requestor factories which can be used to compose requestors in a maintainable way:

 - `parseq.parallel` creates a requestor which concurrently executes a collection of other requestors.
 - `parseq.race` creates a requestor which allows one to concurrently run multiple requestors and succeeds whenever any one requestor completes.
 - `parseq.sequence` creates a requestor which executes a collection of requestors in order, one at a time. The results are passed from the previous to the next.
 - `parseq.fallback` creates a requestor which performs a collection of requestors in order and succeeds once any requestor succeeds.

Each factory takes an array of requestors and returns a new requestor. This allows the factories themselves to be composed.

### why should I use parsec?
Using Parseq and requestors, we have clear separation of logic and control flow for asynchronous code. This is something that Promises and async-await fail to do. Simple features like throttling the number of concurrent requests to a server or cancelling a remote request, things which are inconvenient with Promises or async-await, are trivial with Parsec. Finally, the library is small and has no dependencies.
