import { MockXMLHttpRequest } from "./mock-xmlhttprequest.js";

if (typeof globalThis.XMLHttpRequest !== "function")
    globalThis.XMLHttpRequest = MockXMLHttpRequest;

/**
 * A requestor factory. Creates requestors that make one HTTP request.
 * This is a wrapper around XMLHttpRequest. The API for this requestor is 
 * extremely similar to the `createHttpsRequestor` API.
 * 
 * @example
 * ```
 * const doPostRequest = createHttpsRequestor({
 *   url: "endpoint/of/request",
 *   method: "POST",  // or "GET", "PUT", etc...
 *   headers: {
 *       Authorization: `Bearer ${ACCESS_TOKEN}`
 *   },
 *   body: { id: "1" , user: "username" }
 * });
 * 
 * doPostRequest(({ value, reason }) => {
 *   if (value === undefined) {
 *     console.log("failure because", reason);
 *     return;
 *   }
 *   
 *   console.log(
 *     value.statusCode, 
 *     value.statusMessage, 
 *     value.headers,
 *     // if response is JSON, 
 *     // `value.data` will be an object.
 *     // Otherwise `value.data` must be 
 *     // parsed manually.
 *     value.data);
 * });
 * ```
 * 
 * For convenience, the request body is automatically parsed into a string if an 
 * object is provided. This string will typically be a JSON string, but if you 
 * specify a `contentType` of "x-www-form-urlencoded", or provide a header which 
 * specifies that content-type, then the request body will be automatically 
 * stringified into a URL query parameter string. You can disable this automatic
 * parsing if you would like, in which case you will need to provide a string to 
 * the request body instead of an object.
 * 
 * If the response data is sent as JSON, it is automatically parsed into an 
 * object. This behavior can be disabled.
 * 
 * @param {Object} spec Configures the returned requestor.
 * @param {String} spec.url The endpoint of the request. This can include 
 * passwords, hashes, ports, and query parameters.
 * @param {Object} spec.params Represents query parameter keys and their values.  
 * @param {String} spec.method "GET", "POST", "PUT", "DELETE", etc. If none is 
 * provided, then defaults to "GET".
 * @param {Object} spec.headers The provided object should map header keys to 
 * their values.
 * @param {Object|String} spec.body If an object, then it is parsed into a 
 * string based on the provided content type (either from the header or the 
 * `spec.contentType`). If it is a string, then it is already parsed.
 * @param {String} spec.contentType Determines how `value.body` is parsed into a 
 * string. If  `"x-www-form-urlencoded"` or 
`"application/x-www-form-urlencoded"`, `value.body` is transformed into the 
 * format used by URL query parameters. If `"json"`, `"application/json"`, or 
 * `"default"`, `value.body` is transformed into a string by JSON.stringify. If 
 * no `contentType` is provided, then `"application/json"` is used by default. 
 * Specifying the content-type in the header overrides this property completely.
 * @param {Function} spec.customCancel A function factory. It takes a method 
 * which destroys the request object represented by the requestor and returns a 
 * new function. Use this if you would like to make a request to the server to 
 * tell it to stop processing a request, since by default, the cancel function 
 * simply ignores whatever response is sent by the server.
 * @param {Boolean} spec.autoParseRequest If false, requests will not be 
 * automatically parsed. You must provide strings instead of objects as the 
 * request body.
 * @param {Boolean} spec.autoParseResponse If false, responses will be sent to 
 * the reciever as strings instead of objects. The receiver must manually parse 
 * the response.
 * @param {Function} spec.log Any errors will be sent to this function if it is 
 * provided. This should be used for logging purposes. Currently, only errors 
 * which occur during autoparsing with JSON.parse causes this function to be 
 * called.
 * @returns {Function} An HTTPS requestor. The returned requestor can take an 
 * optional `message` hash which can further configure the http request:
 * 
 *  - `mesage.pathname`: String. Appends the url path. Should start with a "/".
 *  - `message.params`: Object. Represents query parameter keys and their 
 * values. Appends any params provided by the factory.
 *  - `message.body`: Object|String. The request body. If provided, this will 
 * override any value given to the factory.
 *  - `message.headers`: Object. Additional headers to use in the request. These 
 * are concantentated with any headers provided from the factory `spec`.
 *  - `message.contentType`: String. See documentation for `spec.contentType`.
 * Specifying the content-type in the header overrides this property completely.
 *  - `message.autoParseRequest`: Boolean. See `spec.autoParseRequest`
 * documentation. This will override the value provided in the factory.
 *  - `message.autoParseResponse`: Boolean. See `spec.autoParseResponse` 
 * documentation. This will override the value provided in the factory.
 *  - `message.customCancel`: Function. A function factory. If provided, this 
 * `customCancel` will override that provided by the factory. See 
 * `spec.customCancel` documentations.
 * 
 * The value sent to the receiver is a hash with four properties: `statusCode`, 
 * `statusMessage`, `headers`, and `data`.
 * 
 * The cancellor for the requestor, by default, uses the `abort` method from 
 * the XMLHttpRequest API. This means that the default cancellor will let the 
 * server process your request, and whatever response is sent will simply be 
 * ignored.
 */
export function createAjaxRequestor(spec) {

    if (typeof spec !== "object")
        spec = {}

    let {
        url,
        params,
        method,
        headers,
        body,
        contentType,
        customCancel,
        autoParseRequest = true,
        autoParseResponse = true,
        log,
    } = spec

    if (typeof headers !== "object")
        headers = {};

    if (typeof params !== "object")
        params = {};

    const __other__ = Symbol("other");
    
    const ContentType = {
        "json": "application/json",
        "application/json": "application/json",
        "default": "application/json",
        "x-www-form-urlencoded": "application/x-www-form-urlencoded",
        "application/x-www-form-urlencoded": "application/x-www-form-urlencoded",
        [__other__]: __other__
    }

    const searchParamatize = object => new URLSearchParams(
        Object.entries(object)).toString();

    const Stringify = {
        "json": JSON.stringify,
        "application/json": JSON.stringify,
        "default": JSON.stringify,
        "x-www-form-urlencoded": searchParamatize,
        "application/x-www-form-urlencoded": searchParamatize,
        [__other__]: body => String(body)
    }

    return function ajaxRequestor(receiver, message) {
        // requestor can override body, contentType, or customCancel

        body = typeof message.body === "object" ? message.body : body;
        contentType = ![null, undefined].includes(message.contentType) 
                      ? message.contentType 
                      : contentType;
        customCancel = ![null, undefined].includes(message.customCancel) 
                       ? message.customCancel 
                       : customCancel;

        let additionalHeaders = message.headers;
        let additionalParams = message.params;
        let additionalPath = message.path;

        // requestor can disable automatic request parsing
        if (typeof message.autoParseRequest === "boolean")
            autoParseRequest = message.autoParseRequest;

        // requestor can disable automatic response parsing
        if (typeof message.autoParseResponse === "boolean")
            autoParseResponse = message.autoParseResponse;

        // if the `contentType` is not recognized, use default 
        if (!Object.keys(ContentType).includes(contentType))
            contentType = "default";

        // concantentate factory headers with any provided from requestor
        if (typeof additionalHeaders === "object")
            headers = { ...headers, ...additionalHeaders };
        
        // concantenate factory query paramters with any provided from requestor
        if (typeof additionalParams === "object")
            params = { ...params, ...additionalParams };

        // let headers override `contentType` if headers defines it
        const contentTypeKey = Object.keys(headers).find(key => 
            key.toLowerCase().includes("content-type")
        );
        if (contentTypeKey !== undefined) {
            if (headers[contentTypeKey].includes(
                    ContentType["x-www-form-urlencoded"]))
                contentType = ContentType["x-www-form-urlencoded"];
            else if (headers[contentTypeKey].includes(ContentType.json))
                contentType = ContentType.json;
            else
                contentType = ContentType[__other__];
        }

        // If improper log provided, use default log
        if (typeof log !== "function")
            log = function logWarning(error) {
                console.log("Could not autoparse response:\n", error);
            }
        
        try {
            // requestor can append URL
            if (
                ![null, undefined].includes(additionalPath) && 
                typeof additionalPath === "string"
            )
                url += additionalPath;

            // determine query parameters
            if (typeof params === "object" && Object.keys(params).length > 0)
                url += `?${
                        new URLSearchParams(Object.entries(params))
                            .toString()
                    }`;
            
            // If headers didn't override `contentType`, apply `contentType`
            if (![null, undefined, __other__].includes(contentType))
                headers["Content-Type"] = ContentType[contentType];
            
            // Automatically parse request
            if (typeof body === "object" && autoParseRequest !== false)
                body = Stringify[contentType](body)
            
            const request = new XMLHttpRequest();
            
            request.onreadystatechange = function onReadyStateChange() {
                if (request.readyState !== 4) return;

                const value = Object.create(null);
                value.statusCode = request.status;
                value.statusMessage = request.statusText;
                
                value.headers = Object.create(null);
                request.getAllResponseHeaders().split("\n").forEach(line => {
                    if (line === "") return;
                    const [header, headerValue] = line.split(":");
                    value.headers[header] = headerValue;
                });

                // how response is handled (initially, no autoparsing)
                let responseHandler = unparsed => unparsed;

                // If auto-parsing response, JSON.parse response if it is 
                // JSON content type
                if (Object.keys(value.headers)
                        .some(key =>
                            key.toLowerCase().includes("content-type") && 
                            value.headers[key]
                                .toLowerCase()
                                .includes("application/json") &&
                            autoParseResponse !== false
                ))
                    responseHandler = JSON.parse;
                
                try {
                    value.data = responseHandler(request.responseText)
                }
                catch(error) {
                    log(error);
                    value.data = request.responseText;
                }

                receiver({ value });
            }

            request.open(method, url, true);

            Object.keys(headers).forEach(header => {
                request.setRequestHeader(header, headers[header]);
            });

            request.send(typeof body === "string" ? body : undefined);

            if (typeof customCancel === "function")
                return customCancel(request.abort);
            
            return () => request.abort;
        }
        catch(reason) {
            receiver({ reason });
        }
    }
}

function createSpecificMethodRequestor(method) {
    return function specificMethodRequestor(urlOrSpec, spec) {
        if (
            typeof urlOrSpec === "string" && 
            ["null", "undefined", "object"].includes(typeof spec)
        ) {
            return createAjaxRequestor({ url: urlOrSpec, method, ...spec });
        }
        else if (typeof urlOrSpec !== "object")
            throw Object.assign(
                new Error(
                "if you provide one argument, it must be a `spec` object you " + 
                "could pass to `createHttpsRequestor`. Otherwise, it must " + 
                "take two arguments, where the first is the endpoint of the " + 
                "request and the second is a `spec` object you could pass to " + 
                "`createHttpsRequestor`."),
                { evidence: { urlOrSpec, spec } }
            );
        else{
            urlOrSpec.method = method;
            return createHttpsRequestor({ ...urlOrSpec });
        }
    }
}

/**
 * Creates an ajax requestor for making GET requests.
 * @param {String|Object} url If a string, then the endpoint of the GET request. 
 * If you pass a `spec` object as the first argument, then the second parameter 
 * is ignored.
 * @param {Object} spec See the documentation for the `spec` parameter in 
 * `createAjaxRequestor`. If you provide a method property in this spec, it is 
 * ignored.
 * @returns {Function} A requestor. See documentation for the return value of 
 * `createAjaxRequestor`.
 */
export const createAjaxGetRequestor = createSpecificMethodRequestor("GET");

/**
 * Creates an ajax requestor for making POST requests.
 * @param {String|Object} url If a string, then the endpoint of the GET request. 
 * If you pass a `spec` object as the first argument, then the second parameter 
 * is ignored.
 * @param {Object} spec See the documentation for the `spec` parameter in 
 * `createAjaxRequestor`. If you provide a method property in this spec, it is 
 * ignored.
 * @returns {Function} A requestor. See documentation for the return value of 
 * `createAjaxRequestor`.
 */
export const createAjaxPostRequestor = createSpecificMethodRequestor("POST");

/**
 * Creates an ajax requestor for making PUT requests.
 * @param {String|Object} url If a string, then the endpoint of the GET request. 
 * If you pass a `spec` object as the first argument, then the second parameter 
 * is ignored.
 * @param {Object} spec See the documentation for the `spec` parameter in 
 * `createHAjaxRequestor`. If you provide a method property in this spec, it is 
 * ignored.
 * @returns {Function} A requestor. See documentation for the return value of 
 * `createAjaxRequestor`.
 */
export const createAjaxPutRequestor = createSpecificMethodRequestor("PUT");

/**
 * Creates an ajax requestor for making DELETE requests.
 * @param {String|Object} url If a string, then the endpoint of the GET request. 
 * If you pass a `spec` object as the first argument, then the second parameter 
 * is ignored.
 * @param {Object} spec See the documentation for the `spec` parameter in 
 * `createAjaxRequestor`. If you provide a method property in this spec, it is 
 * ignored.
 * @returns {Function} A requestor. See documentation for the return value of 
 * `createAjaxRequestor`.
 */
export const createAjaxDeleteRequestor = createSpecificMethodRequestor("DELETE");
