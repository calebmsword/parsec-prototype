/**
 * Returns false if the provided value is undefined, true otherwise.
 * @param {any} value 
 * @returns {Boolean}
 */
export function exists(value) {
    return value !== undefined;
}

/**
 * Immediately inserts the given callback into the event queue.
 * Any additional arguments are passed to the callback when it is executed.
 * @param {Function} callback 
 * @param  {...any} args 
 */
export function eventually(callback, ...args) {
    setTimeout(callback, 0, ...args);
}

/**
 * Returns true if the candidate is a function, false otherwise.
 * @param {Function} candidate 
 * @returns {Boolean}
 */
export function isFunction(candidate) {
    return typeof candidate === "function";
}

/**
 * Creates a "reason" object which is used for error handling.
 * The reason object contains all properties found in objects created from the 
 * `Error` function constructor as well as an optional `evidence` property. The 
 * `evidence` property can be whatever the caller of this method needs it to be.
 * @param {Object} spec Configures the reason
 * @param {String} spec.factoryName
 * @param {String} spec.excuse 
 * @param {any} spec.evidence
 * @returns 
 */
export function makeReason(spec) {
    const { factoryName, excuse, evidence } = spec;

    const excuseText = exists(excuse) ? "" : `:${excuse}`;
    const error = new Error(`parseq.${factoryName}${excuseText}`);

    return { ...error, evidence };
}

/**
 * Returns the length of the provided array.
 * `undefined` has length 0. Providing any type other than array or `undefined` 
 * causes a reason to be thrown.
 * @param {Function[]} candidateArray 
 * @param {String} factoryName 
 * @returns {Number}
 */
export function getArrayLength(candidateArray, factoryName) {
    if (Array.isArray(candidateArray)) return candidateArray.length;
    if (!exists(candidateArray)) return 0;
    throw make_reason({ 
        factory_name: factoryName, 
        excuse: "Not an array!", 
        array: candidateArray 
    });
}

/**
 * Returns true if the provided callback is a proper requestor callback.
 * A reason is thrown otherwise.
 * @param {Function} callback 
 * @param {String} factoryName 
 * @returns {Boolean} 
 */
export function checkRequestorCallback(callback, factoryName) {
    if (!isFunction(callback) && callback.length !== 2) throw makeReason({
        factoryName,
        excuse: "A requestor callback must a function of two arguments!",
        evidence: callback
    });
}

/**
 * Checks if provided value is an array of proper requestors.
 * @param {Function[]} requestors 
 * @param {String} factoryName 
 */
export function checkRequestors(requestors, factoryName) {
    if (requestors.some(requestor => isFunction(requestor) 
                                     || requestor.length < 1
                                     || requestor.length > 2))
        throw makeReason({
            factory_name: factoryName,
            excuse: "Requestors must be functions of 1 or 2 arguments!",
            evidence: requestors
        });
}
