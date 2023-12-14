import {
    createHttpsRequestor,
    createGetRequestor,
    createPostRequestor,
    createPutRequestor,
    createDeleteRequestor
} from "./create-https-requestor.js";
import {
    createAjaxRequestor,
    createAjaxGetRequestor,
    createAjaxPostRequestor,
    createAjaxPutRequestor,
    createAjaxDeleteRequestor
} from "./ajax-requestor.js"

/**
 * Creates a requestor which maps the given message.
 * If the mapping causes some error, this requestor will fail. The error will be 
 * passed to the receiver as a reason.
 * @param {Function} mapper Determines how the message is transformed. The 
 * function should take on argument (the message) and returns a new message.
 * The requestor itself is fully synchronous. However, parsec currently 
 * processes each step in `sequence` asynchronously. Once tail call recursion is 
 * properly implemented in JavaScript engines, this may change.
 * @returns {Function} The requestor.
 */
function map(mapper) {
    return function(receiver, message) {
        try {
            receiver({ value: mapper(message) });
        }
        catch(reason) {
            receiver({ reason });
        }
    }
}

/**
 * Creates requestor that calls one of two requestors based on received message.
 * @param {Function} condition Takes a message and returns a boolean.
 * @param {Function} ifTrue Requestor that is used if condition is true.
 * @param {Function} ifFalse Requestor that is used if condition is false.
 * @returns {Function}
 */
function branch(condition, ifTrue, ifFalse) {
    return function forkRequestor(receiver, message) {
        try {
            const boolCandidate = condition(message);
            if (typeof boolCandidate !== "boolean")
                receiver({ 
                    reason: Object.assign(
                        new Error("fork condition did not return a boolean!"),
                        { evidence: boolCandidate })
                });
            return boolCandidate 
                ? ifTrue(receiver, message) 
                : ifFalse(receiver, message);
        }
        catch(reason) {
            receiver({ reason });
        }
    }
}

/**
 * Creates requestor which forwards the message to its receiver.
 * @param {Function} sideEffect Function that takes message and does whatever it 
 * likes. If the sideEffect throws an error, it will be passed to the reciever 
 * as a reason.
 * @returns {Function} A requestor.
 */
function thru(sideEffect) {
    return function requestor(receiver, message) {
        if (typeof sideEffect === "function") 
            try {
                sideEffect(message);
            }
            catch(reason) {
                receiver({ reason });
            }
        receiver({ value: message });
    }
}

/**
 * Creates requestor which fails.
 * @param {String} excuse An error message to pass to the reason object.
 * @param {Function} createEvidence By default, the reason object contains an 
 * `evidence` property which contains the message sent to the requestor. But if 
 * you provide a `createEvidence` function, its return value will be used as the 
 * evidence instead. `createEvidence` is passed the message as an argument.
 * @returns {Function} A requestor.
 */
function fail(excuse, createEvidence) {
    return function requestor(receiver, message) {
        if (typeof createEvidence === "function")
            message = createEvidence(message);
        receiver({ 
            reason: Object.assign(
                new Error(excuse),
                ![null, undefined].includes(message) 
                    ? { evidence: message } 
                    : {}
            )
        });
    }
}

/**
 * Creates requestor which wraps a promise.
 * When the promise resolves, the receiver is called with the resolved value. If 
 * the promise rejects, the receiver result gets an undefined value and a reason 
 * containing the rejected value.
 * @param {Object} thenable A promise or thenable.
 * @param {Object} options Allows you to make the requestor return a cancellor.
 * @param {Boolean} options.cancellable Whether the requestor returns a 
 * cancellor.
 * @returns {Function} A requestor.
 */
function usePromise(thenable, { cancellable } = {}) {
    let cancel;
    const promise = new Promise((resolve, reject) => {
        Promise.resolve(thenable)
            .then(resolve)
            .catch(reject)
        if (cancellable === true) cancel = reject;
    });

    return function requestor(receiver) {
        promise
            .then(value => receiver({ value }))
            .catch(reason => receiver({ reason }));
        if (cancellable === true) return cancel;
    }
}

/**
 * Creates a requestor which makes an HTTPS request using `https.request`.
 * Whatever message is passed to this requestor is used as the body for the 
 * POST request.
 * @param {String} url The endpoint for the request.
 * @param {Object} spec The `spec` hash which can be passed to 
 * `createHttpsRequestor`.
 * @returns {Function} The requestor.
 */
 function nodeRequest(url, spec) {
    return (receiver, message) => 
        createHttpsRequestor({ url, ...spec })(receiver, { body: message });
}

/**
 * Creates a requestor which makes an HTTP request.
 * Whatever message is passed to this requestor is used as the body for the 
 * POST request.
 * @param {String} url The endpoint for the request.
 * @param {Object} spec The `spec` hash which can be passed to 
 * `createHttpsRequestor`.
 * @returns {Function} The requestor.
 */
function ajax(url, spec) {
    return (receiver, message) => 
        createAjaxRequestor({ url, ...spec })(receiver, { body: message });
}

/**
 * Creates a requestor which makes a GET request using `https.request`.
 * @param {String} url The endpoint for the request.
 * @param {Object} spec The `spec` hash which can be passed to 
 * `createGetRequestor`.
 * @returns {Function} The requestor.
 */
 function nodeGet(url, spec) {
    return createGetRequestor(url, spec);
}

/**
 * Creates a requestor that makes a GET request.
 * @param {String} url The endpoint for the request.
 * @param {Object} spec The `spec` hash which can be passed to 
 * `createGetRequestor`.
 * @returns {Function} The requestor.
 */
function ajaxGet(url, spec) {
    return createAjaxGetRequestor(url, spec);
}

/**
 * Creates a requestor which makes a POST request using `https.request`.
 * Whatever message is passed to this requestor is used as the body for the 
 * POST request.
 * @param {String} url The endpoint for the request.
 * @param {Object} spec The `spec` hash which can be passed to 
 * `createPostRequestor`.
 * @returns {Function} The requestor.
 */
function nodePost(url, spec) {
    return (receiver, message) => 
        createPostRequestor(url, spec)(receiver, { body: message });
}

/**
 * Creates a requestor that makes a POST request.
 * Whatever message is passed to this requestor is used as the body for the 
 * POST request.
 * @param {String} url The endpoint for the request.
 * @param {Object} spec The `spec` hash which can be passed to 
 * `createPostRequestor`.
 * @returns {Function} The requestor.
 */
function ajaxPost(url, spec) {
    return (receiver, message) => 
        createAjaxPostRequestor(url, spec)(receiver, { body: message });
}

/**
 * CCreates a requestor which makes a PUT request using `https.request`.
 * Whatever message is passed to this requestor is used as the body for the 
 * POST request.
 * @param {String} url The endpoint for the request.
 * @param {Object} spec The `spec` hash which can be passed to 
 * `createPostRequestor`.
 * @returns {Function} The requestor.
 */
 function nodePut(url, spec) {
    return (receiver, message) => 
        createPutRequestor(url, spec)(receiver, { body: message });
}

/**
 * Creates a requestor that makes a PUT request.
 * Whatever message is passed to this requestor is used as the body for the 
 * POST request.
 * @param {String} url The endpoint for the request.
 * @param {Object} spec The `spec` hash which can be passed to 
 * `createPostRequestor`.
 * @returns {Function} The requestor.
 */
function ajaxPut(url, spec) {
    return (receiver, message) => 
        createAjaxPutRequestor(url, spec)(receiver, { body: message });
}

/**
 * Creates a requestor which makes a DELETE request using `https.request`.
 * @param {String} url The endpoint for the request.
 * @param {Object} spec The `spec` hash which can be passed to 
 * `createPostRequestor`.
 * @returns {Function} The requestor.
 */
 function nodeDelete(url, spec) { 
    return createDeleteRequestor(url, spec);
}

/**
 * Creates a requestor that makes a DELETE request.
 * @param {String} url The endpoint for the request.
 * @param {Object} spec The `spec` hash which can be passed to 
 * `createPostRequestor`.
 * @returns {Function} The requestor.
 */
function ajaxDelete(url, spec) { 
    return createAjaxDeleteRequestor(url, spec);
}

/**
 * A collection of useful requestor factories.
 */
const nebula = Object.freeze({
    map,
    branch,
    thru,
    fail,
    usePromise,

    nodeRequest,
    nodeGet,
    nodePost,
    nodePut,
    nodeDelete,
    
    ajax,
    ajaxGet,
    ajaxPost,
    ajaxPut,
    ajaxDelete
});

export default nebula;
