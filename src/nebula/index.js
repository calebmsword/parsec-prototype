import {
    createHttpsRequestor,
    createGetRequestor,
    createPostRequestor,
    createPutRequestor,
    createDeleteRequestor
} from "./lib/create-https-requestor.js";
import {
    createAjaxRequestor,
    createAjaxGetRequestor,
    createAjaxPostRequestor,
    createAjaxPutRequestor,
    createAjaxDeleteRequestor
} from "./lib/ajax-requestor.js";

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
    return function branch(receiver, message) {
        try {
            const boolCandidate = condition(message);
            if (typeof boolCandidate !== "boolean")
                receiver({ 
                    reason: Object.assign(
                        new Error("branch condition did not return a boolean!"),
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
 * @param {Function} sideEffect Function that takes a read-only proxy for the 
 * message passed to the receiver. If the sideEffect throws an error, it will be 
 * passed to the reciever as a reason.
 * @returns {Function} A requestor.
 */
function thru(sideEffect) {
    return function requestor(receiver, message) {

        // don't allow sideEffect to affect message passed to receiver
        const messageProxy = new Proxy(message, {
            set() {
                throw new TypeError("This object is a read-only proxy of the " + 
                                    "message sent to the receiver!")
            }
        });

        if (typeof sideEffect === "function") 
            try {
                sideEffect(messageProxy);
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
 * containing the rejected reason.
 * 
 * By default, the cancellor for this function simply forces the promise to 
 * reject. If you would also like to send a request to a server (say, an attempt 
 * to cancel an expensive calculation that was requested), then use can use 
 * `spec.customCancel`. See the following example:
 * 
 * @example
 * ```
 * const getRequestor = usePromise(fetch(ENDPOINT), {
 *     cancellable: true,
 *     customCancel: (reject) => () => {
 *         
 *         // use whatever tools you have 
 *         // to make a request to the 
 *         // server to try to cancel the 
 *         // expensive request
 *         fetch(CANCEL_ENDPOINT);
 *         
 *         // force promise to reject
 *         reject(); 
 *     }
 * }); 
 * ```
 * 
 * @param {Object} thenable A promise or thenable.
 * @param {Object} options Allows you to make the requestor return a cancellor.
 * @param {Boolean} options.cancellable Whether the requestor returns a 
 * cancellor.
 * @param {Function} options.customCancel A function factory which takes a 
 * `reject` method which forces the promise to reject and returns a cancellor. 
 * If provided, the return value of this function will act as the cancellor for 
 * this requestor. If the function you provide does not return a function, 
 * then the default cancellor will be used.
 * @returns {Function} A requestor.
 */
function usePromise(thenable, { cancellable, customCancel } = {}) {
    let cancel;
    const promise = new Promise((resolve, reject) => {
        Promise.resolve(thenable)
            .then(resolve)
            .catch(reject)
        if (cancellable === true) cancel = reject;
    });

    if (typeof customCancel !== "function")
        customCancel = reject => () => reject();

    return function requestor(receiver) {
        promise
            .then(value => receiver({ value }))
            .catch(reason => receiver({ reason }));
        if (cancellable === true) {
            const cancellorCandidate = customCancel(cancel);
            if (typeof cancellorCandidate !== "function")
                return cancel;
            return cancellorCandidate;
        }
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
