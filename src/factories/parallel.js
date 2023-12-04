import { 
    exists,
    getArrayLength, 
    checkRequestors, 
    checkRequestorCallback,
    makeReason
} from "../lib/utils.js";
import { __factoryName__, FactoryName, TimeOption } from "../lib/constants.js";
import { run } from "../lib/run.js";

/**
 * Makes requestor which causes many requestors to be in effect simultaneously.
 * 
 * @example
 * ```
 * import parsec from "./parsec";
 * import { createFetchRequestor } from "./example-utils";
 * 
 * const cheeseRequestor = createFetchRequestor("https://cheese.com/api/cheeses");
 * const beerRequestor = createFetchRequestor("https://beer.com/api/beers");
 * 
 * const cheeseAndBeerRequestor = parsec.parallel({
 *     requestors: [cheeseRequestor, beerRequestor]
 * });
 * 
 * // make request
 * cheeseAndBeerRequestor((value, reason) => {
 *     if (value === undefined) {
 *         console.log("In error state!" + reason ? ` Because: ${reason}` : "");
 *         return;
 *     }
 *     
 *     const [cheeseResult, beerResult] = value;
 *     console.log("All cheeses:", cheeseResult, "All beers:", beerResult);
 * });
 * ```
 * 
 * The result for each parallelized requestor is stored in an array. If the 
 * requestor created by this factory succeeds, then this array is passed as the 
 * `value` argument in the callback for that requestor.
 * 
 * This is not parallelism on the JavaScript side. We are giving the server (or 
 * whatever the recepient of the requestor may be) an opportunity to handle the 
 * requests in parallel if it has the capacity to do so.
 * 
 * A throttle can be used if the receiver can only handle so many simultaneous 
 * requests.
 * 
 * The user can provide a second array of optional requestors. By default, any 
 * optional requestors which have not been executed once every necessary 
 * requestor has completed are not fired; any which have not yet finished will 
 * be canceled if possible. This behavior can be configured with 
 * `spec.timeOption`. See the documentation for the `TimeOption` object.
 * 
 * A time limit can be provided. By default, this requestor returned by 
 * `parallel` fails if the time limit is reached before every necessary 
 * requestor completes. This can be configured with `spec.timeOption`.
 * 
 * @param {Object} spec 
 * @param {Function[]} spec.requestors
 * @param {Function[]} spec.optionals
 * @param {Number} spec.timeLimit
 * @param {String} spec.timeOption
 * @param {Number} spec.throttle
 * @returns {Function} Requestor which calls the array of requestors in 
 * "parallel".
 */
export function parallel(spec) {
    const {
        requestors,
        optionals,
        timeLimit,
        throttle,
    } = spec

    // `spec[__factoryName__]` can be something other than 
    // `FactoryName.PARALLEL` because other factories use `parallel` in their 
    // logic. This is an internal option that the user should not use, hence it 
    // not mentioned in the public documentation for parallel. 
    const factoryName = spec[__factoryName__] || FactoryName.PARALLEL;

    let { 
        timeOption = TimeOption.SKIP_OPTIONALS_IF_TIME_REMAINS 
    } = spec; 

    let allRequestors;

    const numberOfNecessities = getArrayLength(requestors, factoryName);
    if (numberOfNecessities === 0) {
        if (getArrayLength(optionals, factoryName) === 0) {
            allRequestors = [];
        }
        else {
            allRequestors = optionals;
            timeOption = TimeOption.TRY_OPTIONALS_IF_TIME_REMAINS;
        }
    }
    else {
        if (getArrayLength(optionals, factoryName) === 0) {
            allRequestors = requestors;
            timeOption = TimeOption.IGNORE_OPTIONALS_IF_TIME_REMAINS;
        }
        else {
            allRequestors = [...requestors, ...optionals];
            if (!allTimeOption.some(option => option === timeOption))
                throw makeReason({
                    factoryName,
                    excuse: "timeOption must be one of: " + 
                            allTimeOptions.join(", "),
                    evidence: timeOption
            });
        }
    }

    checkRequestors(allRequestors, factoryName);
    /**
     * A requestor which executes an array of requestors in "parallel".
     * @param {Function} callback Requestor callbacks take a value and a reason.
     * An existing reason indicates some error state.
     * @param {any} initialValue The value passed to the requestors.
     * @returns {Function} A cancel function. Attempts to cancel the parallel 
     * request.
     */
    return function parallelRequestor(callback, initialValue) {
        checkRequestorCallback(callback, factoryName);

        let numberPending = allRequestors.length;
        let numberPendingNecessities = numberOfNecessities;

        const results = [];

        if (numberPending === 0) {
            callback(factoryName === FactoryName.SEQUENCE 
                     ? initialValue 
                     : results)
            return;
        }

        // Get the cancel function from the `run` helper.
        // We don't just immediately return the value of this function because 
        // we need the returned cancel function to be in scope, because the 
        // `parallelAction` callback uses it.
        const cancel = run({
            factoryName,
            requestors: allRequestors,
            initialValue,
            action({ value, reason, requestorIndex }) {

                results[requestorIndex] = value;

                numberPending--;

                // The necessities are encountered first. Notice we only enter 
                // failure state if a necessity fails.
                if (requestorIndex < numberOfNecessities) {
                    numberPendingNecessities--;

                    // The callbacks in requestors are designed such that a 
                    // nonexistent `value` represents a failure state.
                    if (!exists(value)) {

                        // This is the cancel function returned by `run`
                        cancel(reason);

                        callback(undefined, reason);
                        callback = undefined;
                        return;
                    }
                }

                // If nothing is pending, or all necessities are handled and 
                // we have a time option which ignores optionals, then finish.
                if (numberPending < 1 || 
                    (
                        timeOption === TimeOption.SKIP_OPTIONALS_IF_TIME_REMAINS
                        && numberPendingNecessities < 1
                    )
                ) {
                    cancel(makeReason({
                        factoryName,
                        excuse: "All necessities are complete, optional " + 
                                "requestors are being canceled if any were " + 
                                "provided"
                    }));
                    callback(
                        factoryName === FactoryName.SEQUENCE 
                        ? results.pop() 
                        : results
                    );
                    callback = undefined;
                }

            },
            timeout() {
                const reason = makeReason({
                    factoryName,
                    excuse: "Time limit reached!",
                    evidence: timeLimit
                });
                if (timeOption === TimeOption.REQUIRE_NECESSITIES) {
                    timeOption = TimeOption.SKIP_OPTIONALS_IF_TIME_REMAINS;
                    if (numberPendingNecessities < 1) {
                        cancel(reason);
                        callback(results);
                    }
                }
                else if (
                    timeOption === TimeOption.TRY_OPTIONALS_IF_TIME_REMAINS
                ) {
                    cancel(reason);

                    if (numberPendingNecessities < 1) {
                        callback(results);
                    }
                    // We failed if some necessities weren't handled in time
                    else {
                        callback(undefined, reason)
                    }
                    callback = undefined;
                }
            },
            timeLimit,
            throttle
        });

        return cancel;
    }
}
