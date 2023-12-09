import { FactoryName, __factoryName__ } from "../lib/constants.js";
import {
    exists, 
    getArrayLength, 
    checkRequestors, 
    checkReceiver, 
    makeReason 
} from "../lib/utils.js";
import { run } from "../lib/run.js";

/**
 * Creates a requestor which succeeds when any of its requestors succeeds.
 * 
 * @example
 * ```
 * import parsec from "./parsec";
 * import { createFetchRequestor } from "./example-utils";
 * 
 * const gruyereRequestor = createFetchRequestor("https://cheese.com/api/cheeses/gruyere");
 * const cheddarRequestor = createFetchRequestor("https://cheese.com/api/cheeses/cheddar");
 * const americanRequestor = createFetchRequestor("https://cheese.com/api/cheeses/american");
 * 
 * const cheeseRequestor = parsec.race(
 *  [gruyereRequestor, cheddarRequestor, americanRequestor]
 * );
 * 
 * // make request
 * cheeseRequestor(({ value, reason }) => {
 *     if (value === undefined) {
 *         console.log("In error state! " + reason ? `Because: ${reason}` : "");
 *         return;
 *     }
 *     
 *     console.log("Here's the cheese:", value);
 * });
 * ```
 * 
 * Unlike `Promise.race`, there is only failure if every requestor fails.
 * 
 * @param {Function[]} requestors An array of requestors.
 * @param {Object} spec Configures race.
 * @param {Number} spec.timeLimit A time limit in milliseconds.
 * @param {Number} spec.throttle Limits the number of requestors executed in a 
 * tick.
 * @returns {Function} A requestor. Calling this method starts the race.
 */
export function race(requestors, spec = {}) {
    const {
        timeLimit,
        throttle
    } = spec;

    // `spec[__factoryName__]` can be something other than 
    // `FactoryName.PARALLEL` because other factories use `race` in their 
    // logic. This is an internal option that the user should not use, hence it 
    // not mentioned in the public documentation for parallel. 
    const factoryName = spec[__factoryName__] || FactoryName.RACE;

    if (getArrayLength(requestors, factoryName) === 0) throw makeReason({
        factoryName,
        excuse: "No requestors provided!"
    });

    checkRequestors(requestors, factoryName);

    return function raceRequestor(callback, initialValue) {
        checkReceiver(callback, factoryName);

        let numberPending = requestors.length;

        let cancel = run({
            factoryName,
            requestors,
            initialValue,
            action({ value, reason, requestorIndex }) {
                numberPending--;
                
                if (exists(value)) {
                    // We have a winner. Cancel the losers
                    cancel(makeReason({
                        factoryName,
                        excuse: "Cancelling loser!",
                        evidence: requestorIndex
                    }));
                    callback({ value, reason });
                    callback = undefined;
                }
                else if (numberPending < 1) {
                    // Nothing succeeded. This is now a failure
                    cancel(reason);
                    callback({ reason });
                    callback = undefined;
                }
            },
            timeout() {
                const reason = makeReason({
                    factoryName,
                    excuse: "Timeout occured!",
                    evidence: timeLimit
                });
                cancel(reason);
                callback({ reason });
                callback = undefined;
            },
            timeLimit,
            throttle
        });
        return cancel;
    };
}
