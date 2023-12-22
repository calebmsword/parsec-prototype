import { __factoryName__, FactoryName, TimeOption } from "../lib/constants.js";
import { parallel } from "./parallel.js";

/**
 * Calls requestors in order, passing results from the previous to the next.
 * 
 * @example
 * ```
 * import parsec from "./parsec";
 * import { createFetchRequestor } from "./example-utils";
 * 
 * const cheeseCredentialsRequestor = createFetchRequestor("https://cheese.com/api/cheese/vip-access-key");
 * 
 * // this requestor takes access key through `message`
 * const fancyCheeseRequestor = createFetchRequestor("https://cheese.com/api/cheeses/vip");
 * 
 * const privilegedCheeseRequestor = parsec.sequence(
 *     [cheeseCredentialsRequestor, fancyCheeseRequestor]
 * );
 * 
 * // make request
 * privilegedCheeseRequestor(({ value, reason }) => {
 *     if (value === undefined) {
 *         console.log("Failure because", reason);
 *         return;
 *     }
 *     
 *     console.log("Here's the cheese:", value);
 * });
 * ``` 
 * 
 * Success occurs when every requestor succeeds. If any failure occurs in any 
 * requestor or the optional time limit is reached before the sequence ends, 
 * then the sequences fails. 
 * @param {Function[]} requestors An array of requestors.
 * @param {Object} spec Configures sequence.
 * @param {Number} spec.timeLimit The optional time limit.
 * @returns {Function} The sequence requestor. Upon execution, starts the 
 * sequence.
 */
export function sequence(requestors, spec = {}) {
    const { timeLimit } = spec;

    return parallel(requestors, {
        timeLimit,
        timeOption: TimeOption.SKIP_OPTIONALS_IF_TIME_REMAINS,
        throttle: 1,
        [__factoryName__]: FactoryName.SEQUENCE
    });
}
