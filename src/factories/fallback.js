import { FactoryName, __factoryName__ } from "../lib/constants.js";
import { race } from "./race.js";

/**
 * Perform each requestor one at a time until one succeeds.
 *
 * @example
 * ```
 * import parsec from "./parsec";
 * import { createFetchRequestor } from "./example-utils";
 * 
 * const gruyereRequestor = createFetchRequestor("https://cheese.com/api/cheeses/gruyere");
 * const parmeseanRequestor = createFetchRequestor("https://cheese.com/api/cheeses/parmesean");
 * 
 * // I want gruyere, but parmesean will do if they're out
 * const gruyereRequestor_orParmIfWeMust = parsec.fallback({
 *     requestors: [gruyereRequestor, parmeseanRequestor]
 * });
 * 
 * // make request
 * gruyereRequestor_orParmIfWeMust(({ value, reason }) => {
 *     if (value === undefined) {
 *         console.log("In error state! " + reason ? `Because: ${reason}` : "");
 *         return;
 *     }
 *     
 *     console.log("Here's the cheese:", value);
 * });
 * ```  
 * 
 * Failure occurs only when all of the provided requestors fail. An optional 
 * time limit can be provided. If so, then failure occurs if the time limit is 
 * reached before any requestor succeeds.
 * @param {Function[]} requestors An array of requestors.
 * @param {Object} spec Configures fallback.
 * @param {Number} spec.timeLimt An optional time limit.
 * @returns {Function} A requestor function. Upon execution, starts the fallback 
 * request.
 */
export function fallback(requestors, spec = {}) {
    const {
        timeLimit
    } = spec;
    return race(requestors, {
        timeLimit,
        throttle: 1,
        [__factoryName__]: FactoryName.FALLBACK
    });
}
