import { parallel } from "./src/factories/parallel.js";
import { sequence } from "./src/factories/sequence.js";
import { race } from "./src/factories/race.js";
import { fallback } from "./src/factories/fallback.js";
import { TimeOption } from "./src/lib/constants.js";

/**
 * Parsec is a utility for managing asynchronous code.
 * 
 * Parsec composes "requestors", which are functions which perform a single 
 * (typically asynchronous) request. A requestor takes up to two arguments: a 
 * callback and an optional value. Once a requestor completes it task, it 
 * passes the result to its callback. If an error occurs, it passes undefined 
 * and a second "reason" (an error-like object) to the callback.
 * 
 * Requestors may return a function. If they do, it acts as a cancel function.
 * This can be used to attempt to cancel the request. In general, the cancel 
 * function cannot guarantee that a request will be canceled. It represents an 
 * attempt. 
 * 
 * Parsec provides four requestor factories for managing complex asynchronous 
 * logic that can be expressed as a collection of requestors.
 * 
 *  - `parsec.parallel` creates a requestor which concurrently executes a 
 * collection of other requestors.
 *  - `parsec.race` creates a requestor which allows one to concurrently run 
 * multiple requestors and succeed whenever any one requestor completes.
 *  - `parsec.sequence` creates a requestor which performs a series of 
 * requestors in order, one at a time. The results are passed from the previous 
 * to the next.
 *  - `parsec.fallback` creates a requestor which performs a series of 
 * requestors in order and succeeds once any requestor succeeds.
 * 
 * Each method returns a requestor. This means that parsec factories can be 
 * easily composed.
 * 
 * `parseq.TimeOption` is used to configure behavior for `parsec.parallel`. See 
 * the documentation for `parsec.parallel` and `parsec.TimeOption`.
 * 
 */
const parseq = {
    parallel,
    race,
    fallback,
    sequence,
    TimeOption
}

export default parseq;
