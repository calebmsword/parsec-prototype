import { __factoryName__, TimeOption } from "./constants";
import { parallel } from "./parallel";

/**
 * Creates requestor. It calls requestors in order, passing results to the next.
 * 
 * @example
 * ```
 * import parsec from "./parsec";
 * import { createFetchRequestor } from "./example-utils";
 * 
 * const cheeseCredentialsRequestor = createFetchRequestor("https://cheese.com/api/cheese/vip-access-key");
 * 
 * // this requestor takes access key through `value`
 * const fancyCheeseRequestor = createFetchRequestor("https://cheese.com/api/cheeses/vip");
 * 
 * const privilegedCheeseRequestor = parsec.sequence({
 *     requestors: [cheeseCredentialsRequestor, fancyCheeseRequestor]
 * });
 * 
 * // make request
 * privilegedCheeseRequestor((value, reason) => {
 *     if (value === undefined) {
 *         console.log("In error state! " + reason ? `Because: ${reason}` : "");
 *         return;
 *     }
 *     
 *     console.log("Here's the cheese:", value);
 * });
 * ``` 
 * 
 * Success occurs when every requestor succeeds. If any failure occurs in any 
 * requestor or the optional time limit is reached before the sequence ends, 
 * then failure is reached. 
 * @param {Object} spec 
 * @param {Function[]} spec.requestors The requestors to perform in sequence.
 * @param {Number} spec.timeLimit The optional time limit.
 * @returns {Function} The sequence requestor. Upon execution, starts the 
 * sequence request.
 */
export function sequence(spec) {
    const {
        requestors,
        timeLimit
    } = spec;

    return parallel({
        requestors,
        timeLimit,
        timeOption: TimeOption.SKIP_OPTIONALS_IF_TIME_REMAINS,
        throttle: 1,
        [__factoryName__]: FactoryName.SEQUENCE
    });
}
