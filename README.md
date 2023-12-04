# parsec
Parsec is a robust functional solution to asynchronous code management in JavaScript.

This library is based off a library of the same name by Douglas Crockford from his book "How JavaScript Works". Functionally, this library is fully equivalent, and the differences are entirely stylistic. Crockford released the library as open source and gives his blessing to all who wish to use it.

With Parsec, the atomic unit of asynchronous logic is a certain kind of function we will call a **requestor**. A requestor performs *one unit of work*, which in practice is almost always some asynchronous request.

Requestors receive a callback that is called upon completion of the unit of work. The callback receives a *value* argument which represents the result of that unit of work.

A value of `undefined` represents a failure state which the callback can handle however it wishes. On failure, the requestor may optionally pass a second argument we refer to as a *reason*, which is an error object with an optional `evidence` property which may contain proof of the failure.

Requestors may optionally return a function we will call a *cancellor*. Thr cancellor should be used to attempt to cancel the unit of work started by the requestor. Cancellors cannot guarantee cancellation, they can only guarantee an attempt.

Parsec provides four requestor factories which can be used to compose requestors in maintainable way. This does away with callback hell and Promise chains.

The factories take a collection of requestors and return a requestor which composes the provided requestors. This allows the factories themselves to be composed.
