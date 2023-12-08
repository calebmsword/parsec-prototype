import https from "node:https";
import { URLSearchParams } from "node:url";

/**
 * A requestor factory. Creates requestors that make one HTTPS request.
 * 
 * For convenience, and if applicable, the request body is automatically assumed 
 * to be JSON by default. This means you can pass objects as the request body 
 * instead of strings. If you specify `contentType` of "x-www-form-urlencoded", 
 * then the request body will be automatically stringified into a URL query 
 * parameter string. You can disabled this automatic parsing if you would like 
 * (in that case, you will need to provide a string to the request body instead 
 * of an object).
 *  
 * If the response data is sent as JSON, it is automatically parsed into an 
 * object. This behavior can be disabled.
 * 
 * You can provide additional properties to the `spec` hash that are not 
 * documented here. See 
 * https://nodejs.org/api/https.html#httpsrequesturl-options-callback for the 
 * list of properties. We provided this because Node's `https` utility is 
 * low-level, so advanced users can wield the full functionality of its API to 
 * manage the socket, configure connection pooling, and other advanced concerns. 
 * Note that providing a `url` to this `spec`, or passing  `pathname`, `params`, 
 * or `contentType` to the returned requestor may override any undocumented 
 * options you provide which configure the URL for this request.
 * 
 * @param {Object} spec Configures the returned requestor.
 * @param {String} spec.url If provided, overrides `spec.hostname`, `spec.port` 
 * and `spec.path`. Any passwords, hash or query parameters included in the URL 
 * are ignored.
 * @param {String} spec.hostname The domain host. It should look something like 
 * `www.website.com` or `website.org`. Do not include a "/" at the end.  
 * @param {Number} spec.port Defaults to `80`.
 * @param {String} spec.path A path from the domain. Should always start with a 
 * "/". For example, "/api/users" would be an adequate `path`.
 * @param {Object} spec.params Represents query parameter keys and their values.  
 * @param {String} spec.protocol Either "https:" or "http". If none is provided, 
 * then defaults to "https:".
 * @param {String} spec.method "GET", "POST", "PUT", "DELETE", etc. If none is 
 * provided, then defaults to "GET".
 * @param {Object} spec.headers The provided object should map header keys to 
 * their values. If a contentType is provided by the requestor, that will 
 * override whatever is provided with this key.
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
 * new function. The "destroyer" method can optionally take a reason that, if 
 * provided, will cause the receiver to be called with that reason.
 * @param {String} spec.encoding The encoding for the response. It can be any 
 * value which can be set to a Node `Readable` object. See 
 * https://nodejs.org/api/stream.html#readablesetencodingencoding.
 * @param {String} spec.responseMode Is either `default`, `lazy`, or 
 * `lazy_iterable`. If neither of these is provided, then `default` is used. 
 * By default, the receiver value is an object with a `data` property containing 
 * the result. But in the `lazy` or `lazy_iterable` response modes, the data 
 * property will be a getter function which returns the result. Use these modes 
 * if you expect extremely expensive response sizes. The iterable response 
 * calls the response one chunk at a time. When all chunks have been returned, 
 * the iterable getter will return `undefined`.
 * @param {Boolean} spec.autoParseRequest If false, requests will not be 
 * automatically parsed. You must provide strings instead of objects as the 
 * request body.
 * @param {Boolean} spec.autoParseResponse If false, responses will be sent to 
 * the reciever as strings instead of objects. The receiver must manually parse 
 * the response.
 * @param {Function} spec.logger Any warnings will be sent to a logger if 
 * provided. Otherwise, warnings are silent. Currently, warnings only occur if 
 * autoparsing the response with JSON.parse causes some error. 
 * @returns {Function} An HTTPS requestor. The returned requestor can take an 
 * optional `value` hash which can further configure the http request:
 * 
 *  - `value.pathname`: String. Appends the url path. Should start with a "/".
 *  - `value.params`: Object. Represents query parameter keys and their values. 
 * Appends any params provided by the factory.
 *  - `value.body`: Object|String. The request body. If provided, this will 
 * override any value given to the factory.
 *  - `value.headers`: Object. Additional headers to use in the request. These 
 * are concantentated with any headers provided from the factory `spec`.
 *  - `value.contentType`: String. See documentation for `spec.contentType`.
 * Specifying the content-type in the header overrides this property completely.
 *  - `value.autoParseRequest`: Boolean. If false, automatic request parsing is 
 * disabled, which means that if you are making a PUT/POST request, then the 
 * body must be a parsed string instead of an object. This will override the 
 * value provided in the factory.
 *  - `value.autoParseResponse`: Boolean. If false, requests sent as JSON will 
 * not be sent to the receiver as an object. The data will have to be manually 
 * parsed in the receiver. This will override the value provided in the 
 * factory.
 *  - `value.customCancel`: Function. A function factory. It takes a method 
 * which destroys the request object represented by the requestor and returns a 
 * new function. The "destroyer" method can optionally take a reason that, if 
 * provided, will cause the receiver to be called with that reason. If provided, 
 * this `customCancel` will override that provided by the factory.
 *  - `value.encoding`: String. See the `spec.encoding` documentation.
 *  - `value.responseMode`: String. See the `spec.responseMode` documentation.
 * 
 * The receiver's value is a hash with four properties: `statusCode`, 
 * `statusMessage`, `headers`, and `data`.
 * 
 * The cancellor for the requestor, by default, uses `request.destroy` from 
 * Node's `https` API. This means that the default cancellor will let the server 
 * process your request, and whatever response is sent will simply be ignored. 
 * If you pass a reason to the cancellor, then the receiver will be called with 
 * that reason.
 */
export function createHttpsRequestor(spec) {

    if (typeof spec !== "object")
        spec = {}

    let {
        url,
        hostname,
        port,
        path,
        params,
        protocol,
        method,
        headers,
        body,
        contentType,
        customCancel,
        encoding,
        responseMode,
        autoParseRequest = true,
        autoParseResponse = true,
        logger,
        ...rest
    } = spec

    if (typeof headers !== "object")
        headers = {};

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
        [__other__]: alreadyParsed => alreadyParsed
    }
    
    const ResponseMode = {
        DEFAULT: "default",
        LAZY: "lazy",
        LAZY_ITERATOR: "lazy_iterator"
    }

    return function httpsRequestor(callback, value) {
        if (typeof value !== "object")
            value = {};

        // requestor can override body, contentType, customCancel, encoding, or
        // responseMode
        body = ![null, undefined].includes(value.body) ? value.body : body;
        contentType = ![null, undefined].includes(value.contentType) 
                      ? value.contentType 
                      : contentType;
        customCancel = ![null, undefined].includes(value.customCancel) 
                       ? value.customCancel 
                       : customCancel;
        encoding = ![null, undefined].includes(value.encoding) 
                   ? value.encoding 
                   : encoding;
        responseMode = ![null, undefined].includes(value.responseMode) 
                   ? value.responseMode 
                   : responseMode;

        let additionalHeaders = value.headers;
        let additionalParams = value.params;
        let additionalPath = value.path;

        // requestor can disable automatic request parsing
        if (![null, undefined].includes(value.autoParseRequest))
            autoParseRequest = value.autoParseRequest;

        // requestor can disable automatic response parsing
        if (![null, undefined].includes(value.autoParseResponse))
            autoParseResponse = value.autoParseResponse;

        // if the `contentType` is not recognized, use default 
        if (!Object.keys(ContentType).includes(contentType))
            contentType = "default";

        // concantentate factory headers with any provided from requestor
        if (
                ![null, undefined].includes(additionalHeaders) && 
                typeof additionalHeaders === "object"
           )
            headers = { ...headers, ...additionalHeaders };
        
        // concantenate factory query paramters with any provided from requestor
        if (
                ![null, undefined].includes(additionalParams) &&
                typeof additionalParams === object
           )
            params = { ...(params || {}), ...additionalParams };

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

        // determine encoding
        if ([null, undefined].includes(encoding))
            encoding = "utf-8";

        // use responseMode if none is provided or unrecognized is provided
        if (
            [null, undefined].includes(responseMode) ||
            !Object.values(ResponseMode).includes(responseMode)
           )
           responseMode = ResponseMode.DEFAULT;
                
        // We have multiple subscriptions to error events, so if we execute  
        // callback directly for each, we sometimes have multiple errors printed
        function tryCallback(value, reason) {
            if (callback === undefined) return;
            callback(value, reason);
            callback = undefined;
        }

        // If no logger provided, use no-op as logger
        if ([null, undefined].includes(logger))
            logger = () => undefined;

        try {

            // Calculate URL object from factory
            let urlObj = {};
            if (![null, undefined].includes(url))
                urlObj = new URL(url);
            else {
                urlObj.hostname = hostname;
                urlObj.port = port;
                urlObj.pathname = path;
            }

            // requestor can append URL
            if (
                ![null, undefined].includes(additionalPath) && 
                typeof additionalPath === "string"
            )
                urlObj.additionalPath += additionalPath;

            // determine query parameters
            if (typeof params === "object" && Object.keys(params).length > 0)
                urlObj.pathname += `?${
                        new URLSearchParams(Object.entries(params))
                            .toString()
                    }`;
            
            // If headers didn't override `contentType`, apply `contentType`
            if (![null, undefined, __other__].includes(contentType))
                headers["Content-Type"] = ContentType[contentType];
            
            // Automatically parse request
            if (
                ![null, undefined].includes(body) && 
                autoParseRequest !== false
               )
                body = Stringify[contentType](body);
            
            // provide content-length to headers if not already there
            if (
                !Object.keys(headers).some(key =>
                    key.toLowerCase().includes("content-length"))
            )
                headers["Content-Length"] = Buffer.byteLength(body || "");
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname,
                protocol,
                method,
                headers,
                ...rest
            }

            const request = https.request(options, response => {
                const chunks = [];

                // encode response (by default, is "utf-8")
                if (encoding !== "no_encoding")
                    response.setEncoding(encoding);
                
                const result = {
                    statusCode: response.statusCode,
                    statusMessage: response.statusMessage,
                    headers: response.headers
                }
                
                response.on("error", error => tryCallback(undefined, error));

                response.on("data", chunk => chunks.push(chunk));

                response.on("close", () => {

                    // how chunks are handled (by default, no autoparsing)
                    let chunksHandler = unparsed => unparsed;

                    // If auto-parsing response, JSON.parse response if it is 
                    // JSON content type
                    if (Object.keys(response.headers)
                            .some(key =>
                                key.toLowerCase().includes("content-type") && 
                                response.headers[key]
                                    .includes("application/json") &&
                                autoParseResponse !== false
                    ))
                        chunksHandler = JSON.parse;
                    
                    const msg = "Failed to autoparse result because:"
                    
                    switch (responseMode) {
                        case ResponseMode.DEFAULT:
                            try {
                                result.data = chunksHandler(chunks.join(""));
                            }
                            catch(error) {
                                logger(`${msg}: ${error}`);
                                return chunks.join("");
                            }
                            break;
                        case ResponseMode.LAZY:
                            result.data = () => {
                                try {
                                    return chunksHandler(chunks.join(""))
                                }
                                catch(error) {
                                    logger(`${msg}: ${error}`);
                                    return chunks.join("");
                                }
                            };
                            break;
                        case ResponseMode.LAZY_ITERATOR:
                            let i = 0;
                            result.data = () =>
                                (i < chunks.length) ? chunks[i++] : undefined;
                    }

                    tryCallback(result);
                });
            });
            
            request.on("error", reason => tryCallback(undefined, reason));

            request.write(![null, undefined].includes(body) ? body : "");
            
            request.end();

            if (typeof customCancel === "function") 
                return customCancel(request.destroy);

            return function attemptCancel(reason) {
                request.destroy(reason);
            }
        }
        catch(error) {
            tryCallback(undefined, error);
        }
    }
}

function createSpecificMethodRequestor(method) {
    return function specificMethodRequestor(urlOrSpec, ...spec) {
        if (typeof urlOrSpec === "string")
            return createHttpsRequestor({ 
                url: urlOrSpec, 
                method, 
                ...(spec.method = method)
            });
        else if (typeof urlOrSpec !== "object")
            throw new Error(
                "if you provide one argument, it must be a `spec` object you " + 
                "could pass to `createHttpsRequestor`. Otherwise, it must " + 
                "take two arguments, where the first is the endpoint of the " + 
                "request and the second is a `spec` object you could pass to " + 
                "`createHttpsRequestor`.");
        else
            return createHttpsRequestor({ method, ...urlOrSpec })
    }
}

export const createGetRequestor = createSpecificMethodRequestor("GET");
export const createPostRequestor = createSpecificMethodRequestor("POST");
export const createPutRequestor = createSpecificMethodRequestor("PUT");
export const createDeleteRequestor = createSpecificMethodRequestor("DELETE");
