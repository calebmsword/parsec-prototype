import parsec from "../../src/index.js";
import {
    createGetRequestor,
    createPostRequestor
} from "../example-utils/create-https-requestor.js";

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
 * Creates requestor which validates an HTTP response.
 * The message passed to this requestor should be a response object from a 
 * `createHttpsRequestor` requestor. The requestor fails if the response has a 
 * 400 or 500 error.
 * @returns {Function} The requestor.
 */
function checkStatusCode() {
    return map(response => {
        if (response.statusCode >= 400 && response.statusCode < 600) {
            throw Object.assign(
                new Error(response.statusMessage), 
                { evidence: response }
            );
        }
        return response;
    })
}

/**
 * A collection of useful requestor factories.
 */
export const requestorUtils = Object.freeze({
    map,

    /**
     * Creates a requestor which makes a GET request.
     * If the response returns a 400 or 500 response code, the requestor fails.
     * @param {String} url The endpoint for the request.
     * @param {Object} spec The `spec` hash which can be passed to 
     * `createGetRequestor`.
     * @returns {Function} The requestor.
     */
    getRequest(url, spec) {
        return parsec.sequence([
            createGetRequestor(url, spec),
            checkStatusCode()
        ]);
    },

    /**
     * Creates a requestor that makes a POST request.
     * Whatever message is passed to this requestor is used as the body for the 
     * POST request. If the response returns a 400 or 500 response code, the 
     * requestor fails.
     * @param {String} url The endpoint for the request.
     * @param {Object} spec The `spec` hash which can be passed to 
     * `createPostRequestor`.
     * @returns {Function} The requestor.
     */
    postRequest(url, spec) {
        return parsec.sequence([
            (receiver, message) => 
                createPostRequestor(url, spec)(receiver, { body: message }),
            checkStatusCode()
        ]);
    }
});
