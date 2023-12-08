# parsec
Parsec is a robust functional solution to asynchronous code management in JavaScript.

This library is based off the library "Parseq" by Douglas Crockford from his book "How JavaScript Works". Functionally, this library is fully equivalent, and the differences are entirely stylistic. Crockford [gives his blessing](https://github.com/douglascrockford/parseq/issues/7#issuecomment-504800341) to all who wish to reimplement Parseq.

### requestors 
In Parsec, the building block of asynchronous logic is a kind of function we call a **requestor**. A requestor performs *one unit of work* which typically involves asynchronous requests.

Requestors receive a callback that is called when the unit of work completes. We call these callbacks **receivers**. All receivers must take a *value* argument which represents the result of that unit of work.

A value of `undefined` represents a failure which the receiver can handle however it wishes. On failure, the receiver may optionally get a second argument we refer to as a *reason*.

Requestors may optionally return a function we call a **cancellor**. The cancellor should attempt to cancel the unit of work its requestor started. In general, cancellors cannot guarantee cancellation. They can only guarantee an attempt.

### parsec and requestors
Callback hell should be avoided at all costs. To avoid directly calling another requestor insider of a receiver, Parsec provides four requestor factories which can be used to compose requestors in a maintainable way:

 - `parsec.parallel` creates a requestor which concurrently executes a collection of other requestors.
 - `parsec.race` creates a requestor which concurrently executes multiple requestors and succeeds whenever any one requestor completes.
 - `parsec.sequence` creates a requestor which executes a collection of requestors in order, one at a time. The results are passed from the previous to the next.
 - `parsec.fallback` creates a requestor which executes a collection of requestors in order and succeeds once any of them succeeds.

Each factory takes an array of requestors and returns a new requestor. This allows the factories themselves to be composed.

### why should I use parsec?
Using Parsec and requestors, we have clear separation of logic and control flow for asynchronous code. This is something that Promises and async-await fail to do. Simple features like throttling the number of concurrent requests to a server or cancelling a remote request, things which are inconvenient with Promises or async-await, are trivial with Parsec. Finally, the library is small and has no dependencies.
