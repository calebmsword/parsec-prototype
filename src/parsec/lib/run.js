import { FactoryName } from "./constants.js";
import { exists, makeReason, immediatelyQueue, isFunction } from "./utils.js";

/**
 * Launches requestors and manages timing, cancellation, and throttling.
 * All functions in the parsec API use `run` for key functionality.
 * @param {Object} spec Configures run.
 * @param {String} spec.factoryName The name of the requestor factory which 
 * called `run`.
 * @param {Function[]} spec.requestors An array of requestor functions.
 * @param {any} spec.initialMessage The message passed to the first requestor. 
 * In some cases, it will be the message passed to all requestors.
 * @param {Function} spec.action The action callback. It receives an object with 
 * `"value"`, `"reason"`, and `"requestorIndex"` keys. The action method is 
 * executed in the receiver for each requestor in `spec.requestors`. The caller 
 * can inject specific behavior into `run` to suit their needs by providing this 
 * action callback.
 * The action callback receives the value and reason passed to the requestor, as 
 * well as a number indicating which index in `spec.requestors` points to the 
 * current requestor. The action callback is also called if the receiver enters 
 * enters a failure state (that is, if `value` is undefined).
 * @param {Function} spec.timeout A timeout callback. It takes no arguments. The 
 * caller of `run` can inject specific time-delayed asynchronous  behavior, if 
 * necessary, by providing this optional method.
 * @param {Number} spec.timeLimit A time limit in milliseconds. When reached, 
 * `timeout` is inserted into the event queue. A `timeLimit` of 0 causes 
 * `timeout` to be ignored.
 * @param {Number} spec.throttle Determines the number of requestors which are
 * allowed to run simultaneously. This argument is optional. A value of 0 
 * indicates no throttle is applied.
 * @returns {Function} A cancel function. Executes cancellors for all executed
 * requestors which returned a cancellor.
 */
export function run(spec) {
    const { 
        factoryName, 
        requestors, 
        initialMessage, 
        action, 
        timeout, 
        timeLimit, 
        throttle = 0
    } = spec;

    let cancellors = new Array(requestors.length);
    let nextNumber = 0;
    let timerId;

    /**
     * Starts the current requestor. 
     * This method is effectively a no-op if the cancellor array is nonexistent 
     * or if we have called every requestor available. This method recursively 
     * calls itself through the callback passed to the current requestor.
     * @param {any} message 
     */
    function startRequestor(message) {
        if (!exists(cancellors) || nextNumber >= requestors.length) return;

        // This variable stores the current value of `nextNumber` so it is 
        // kept in scope. Execution of the callback passed to the current 
        // requestor is gated if `requestorIndex` ever becomes nonexistent.
        let requestorIndex = nextNumber++;

        const requestor = requestors[requestorIndex];
        try {
            cancellors[requestorIndex] = requestor(
                ({ value, reason }) => {
                    // If we are no longer running, this guard will gate the 
                    //     callback.
                    if (![cancellors, requestorIndex].every(exists)) return;

                    // We no longer need the cancel function associated with 
                    // this requestor 
                    cancellors[requestorIndex] = undefined;

                    // Allow the caller to do some specific behavior
                    action({ value, reason, requestorIndex });

                    // Don't allow this callback to be called again
                    requestorIndex = undefined;

                    // This if statement isn't strictly necessary since a guard 
                    // statement at the beginning of startRequestor stops 
                    // anything significant from occuring once the final 
                    // requestor in the array is called. However, there's no 
                    // need to pollute the event queue with callbacks that do 
                    // nothing so we'll add this extra check.
                    if (nextNumber < requestors.length)
                        immediatelyQueue(startRequestor,
                                         factoryName === FactoryName.SEQUENCE 

                                         // pass result from former to next
                                         ? value

                                         // pass same message to each requestor
                                         : initialMessage
                        );
                },
                message
            );
        }
        catch(reason) {
            // Requestors must handle errors themselves. That is, a proper 
            // requestor should never throw an error. Therefore, catching an 
            // error should be able to be treated as a failure. We give the 
            // `action` callback the responsibility of handling the error.
            action({ reason, requestorIndex });

            // This causes the callback passed to the requestor in this 
            // call stack to be gated.
            requestorIndex = undefined;

            // Keep going for now. If we should cancel the `run`, the caller 
            // will have done so in `action`. That decision is not our
            // responsibility.
            startRequestor(message);
        }
    }

    // If there is a timeoutCallback and a positive timeLimit, do a timeout.
    if (exists(timeLimit)) {
        if (typeof timeLimit !== "number" || timeLimit < 0)
            throw makeReason({
                factoryName,
                excuse: "timeLimit must be a number greater than 0!",
                evidence: timeLimit
            });
        
        if (timeLimit > 0) {
            timerId = setTimeout(timeout, timeLimit);
        }
    }

    // type-check throttle
    if (!Number.isSafeInteger(throttle) || throttle < 0) {
        throw makeReason({
            factoryName,
            excuse: "Throttle must be a nonnegative, safe integer!",
            evidence: throttle
        });
    }

    // Start doing requestors. If doing sequence or fallback then the throttle 
    // is set to 1 (which is equivalent to doing one requestor at a time).
    // Notice startRequestor eventually calls itself again in the event queue, 
    // so if we don't get all requestors now, we will get the rest later.
    let amountToParallelize = Math.min(throttle || Infinity, requestors.length);
    while (amountToParallelize-- > 0) 
        immediatelyQueue(startRequestor, initialMessage);

    const DEFAULT_CANCEL_REASON = makeReason({ 
        factoryName,
        excuse: "Cancel!"
    });

    /**
     * Stops all unfinished requestors.
     * This is typically called when a requestor fails. It can also be called on
     * success when `race` stops its losers or when `parallel` stops the 
     * optional requestors.
     * @param {Reason} reason 
     */
    return function cancel(reason = DEFAULT_CANCEL_REASON) {
        if (exists(timerId)) {
            clearTimeout(timerId);
            timerId = undefined;
        }
        
        if (exists(cancellors)) {
            cancellors.forEach(cancellor => {
                try {
                    if (isFunction(cancellor)) return cancellor(reason);
                } 
                catch(exceptions) {/* ignore errors */}
            });
            cancellors = undefined;
        }
    }
}
