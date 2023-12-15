import fs from "fs";
import http from "node:http";
import https from "node:https"

/**
 * An incomplete mock of the XMLHttpRequest object.
 * 
 * With this, we can use XMLHttpRequest in JavaScript that is run in Node or a 
 * browser:
 * 
 * @example
 * ```
 * if (typeof globalThis.XMLHttpRequest !== "function")
 *     globalThis.XMLHttpRequest = MockXMLHttpRequest;
 * 
 * // this will work in Node or a browser
 * const request = new XMLHttpRequest();
 * ```
 * 
 * This class wraps usage of Node's `http.request` or `https.request` API.
 * 
 * There are many features in XMLHttpRequest that are missing or incorrect. Let 
 * "request" represent an XMLHttpRequest instance:
 *  - request.responseXML is never turned into a Document object. It is always 
 * null.
 *  - request.overrideMimeType() is not implemented.
 *  - request.upload is not present.
 *  - request.timeout is not present.
 *  - events are not passed a mock of the event object.
 *  - Cookies are not persisted between requests.
 *  - Synchronous behavior is NOT implemented. (This is for security reasons, as
 * the current known methods for running async http requests with node utilize 
 * extremely insecure interactions between JSON.parse and child processes.)
 *  - Local file access encodes all files as UTF-8.
 * 
 * This mock was created to emulate the subset of the XMLHttpRequest API that 
 * nebula uses. This mock should not be used for any other purpose.
 * 
 * This mock is nearly an exact copy of that from 
 * https://github.com/driverdan/node-XMLHttpRequest. The differences from the 
 * original implementation remove deprecated method calls and uses modern ES6 
 * syntax. The original repo uses the MIT license, so this is fine.
 */
class MockXMLHttpRequest {

    // properties ----------------------------------------

    /**
     * Represents the UNSENT readystate.
     * @type {Number}
     */
    static UNSENT = 0;

    /**
     * Represents the OPENED readystate.
     * @type {Number}
     */
    static OPENED = 1;

    /**
     * Represents the HEADERS_RECEIVED readystate.
     * @type {Number}
     */
    static HEADERS_RECEIVED = 2;
    
    /**
     * Represents the LOADING readystate.
     * @type {Number}
     */
    static LOADING = 3;
    
    /**
     * Represents the DONE readystate.
     * @type {Number}
     */
    static DONE = 4;

    /**
     * Represents the UNSENT readystate.
     * @type {Number}
     */
    UNSENT = 0;
    
    /**
     * Represents the OPENED readystate.
     * @type {Number}
     */
    OPENED = 1;
    
    /**
     * Represents the HEADERS_RECEIVED readystate.
     * @type {Number}
     */
    HEADERS_RECEIVED = 2;
    
    /**
     * Represents the LOADING readystate.
     * @type {Number}
     */
    LOADING = 3;
    
    /**
     * Represents the DONE readystate.
     * @type {Number}
     */
    DONE = 4;

    /**
     * The current state of the request.
     * @type {Number}
     */
    readyState = this.UNSENT;

    /**
     * Handler called once an opened request is sent.
     * This function is called, without arguments, every time `readyState`
     * changes value.
     * @type {Function}
     */
    onreadystatechange = null;

    /**
     * This is the text body sent by a server request.
     * @type {String}
     */
    responseText = "";

    /**
     * The `Document` containing the HTML/XML retrieved by the request.
     * This is the interface used by the DOM. This can be `null` if the request 
     * is unsuccessful or the if the data can't be parsed as XML.
     * @type {Document|null}
     */
    responseXML = null;

    /**
     * The status code of the request, or null if request is unfinished.
     * @type {Number|null}
     */
    status = null;

    /**
     * The status message sent by the server.
     * Any response over an HTTP/2 will be an empty string since that protocol 
     * does not support status messages.
     * @type {String|null}
     */
    statusText = "";

    /**
     * Whether cross-site Access-Control requests need credentials.
     * "Credentials" could cookies or authorization headers, etc.
     * @type {Boolean}
     */
    withCredentials = false;

    /**
     * Represents the request object.
     * This is the request object returned by `http.request` or `https.request`.
     * @type {any}
     */
    #request;

    /**
     * Contains the response result.
     * This is the response object passed to the callback in `http.request` or 
     * `https.request`.
     * @type {Object}
     */
    #response;

    /**
     * A hash representing internal settings for this request.
     * @type {Object}
     */
    #settings;

    /**
     * Whether or not forbidden headers should be excluded from requests. 
     * @type {Boolean}
     */
    #disableHeaderCheck = false;
    
    /**
     * Maps headers to their values.
     * @type {any}
     */
    #headers = Object.create(null);

    /**
     * A case-insensitive collection of contained headers.
     * Specifically, this maps *lowercased* header names to their values.
     * @type {any}
     */
    #headersCase = Object.create(null);

    /**
     * The default HTTP headers to use if none are provided.
     * This object maps header names to their values.
     * @type {Object}
     */
    #defaultHeaders = {
        "User-Agent": "node-XMLHttpRequest",
        "Accept": "*/*",
    };

    /**
     * HTTP headers the user cannot set.
     * Note that user-agent is allowed, even though it is banned in the spec.
     * @type {String[]}
     */
    #forbiddenRequestHeaders = [
        "accept-charset",
        "accept-encoding",
        "access-control-request-headers",
        "access-control-request-method",
        "connection",
        "content-length",
        "content-transfer-encoding",
        "cookie",
        "cookie2",
        "date",
        "expect",
        "host",
        "keep-alive",
        "origin",
        "referer",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "via"
    ];

    /**
     * HTTP methods that XMLHttpRequest is not allowed to send.
     * @type {String[]}
     */
    #forbiddenRequestMethods = [
        "TRACE",
        "TRACK",
        "CONNECT"
    ];

    /**
     * Used internally. Indicates whether `send` has been called.
     * @type {Boolean}
     */
    #sendFlag = false;

    /**
     * Used internally. Indicates whether an error has occurred.
     * @type {Boolean}
     */
    #errorFlag = false;

    /**
     * Used to contain array of event handlers for various events.
     * @type {Object}
     */
    #listeners = {};


    // methods ----------------------------------------

    /**
     * Open the connection.
     * @param {String} method "GET", "POST", etc.
     * @param {String} url The endpoint for the request.
     * @param {Boolean} async Whether or not the request is asynchronous. 
     * Currently, all requests are asynchronous no matter the value the user 
     * chooses.
     * @param {String} user Username for basic authentication.
     * @param {String} password Password for basic authentication.
     */
    open(method, url, async, user, password) {
        // Don't allow synchronous XMLHttpRequest (we never use it in repo)
        async = true;

        this.abort();
        this.#errorFlag = false;

        if (!this.#isAllowedHttpMethod(method))
            throw new Error("SecurityError: Request method not allowed");

        if (typeof url !== "string")
            url = String(url);
        
        this.#settings = {
            method,
            url,
            async,
            user,
            password
        }

        this.#setState(this.OPENED);
    }

    /**
     * Sets a header for the request, or appends the value if one already set.
     * @param {String} header Header name
     * @param {String} value Header value
     */
    setRequestHeader(header, value) {
        if (this.readyState !== this.OPENED)
            throw new Error("INVALID_STATE_ERR: setRequestHeader can only be " + 
                            "called when state is OPEN");
        
        if (!this.#isAllowedHttpHeader(header))
            return console.warn(`Refused to set unsafe header "${header}"`);

        if (this.#sendFlag)
            throw new Error("INVALID_STATE_ERR: send flag is true");

        header = this.#headersCase[header.toLowerCase()] || header;
        this.#headersCase[header.toLowerCase()] = header;
        headers[header] = headers[header]
                          ? `${headers[header]}, ${value}`
                          : value;
    }

    /**
     * Gets header from server response.
     * @param {String} header Name of header to get.
     * @returns {String|null} Header value, or null if it doesn't exist or if 
     * the response has not yet been received. 
     */
    getResponseHeader(header) {
        if (typeof header === "string"
            && this.readyState > this.OPENED
            && this.#response 
            && this.#response.headers
            && this.#response.headers[header.toLowerCase()]
            && !this.#errorFlag
        ) 
            return this.#response.headers[header.toLowerCase()];

        return null;
    }

    /**
     * Get all response headers.
     * @returns {String} All response headers separated by CR + LF ("\r\n").
     */
    getAllResponseHeaders() {
        if (this.readyState < this.HEADERS_RECEIVED || this.#errorFlag)
            return "";

        let result = "";

        Object.keys(this.#response.headers).forEach(header => {
            if (header !== "set-cookie" && header !== "set-cookie2")
                result += `${header}: ${this.#response.headers[header]}\r\n`
        });

        return result.substring(0, result.length - 1);
    }

    /**
     * Sends the request to the server.
     * @param {String} data Optional data to send as the request body.
     */
    send(data) {
        if (this.readyState !== this.OPENED)
            throw new Error("INVALID_STATE_ERR: connection must be opened " + 
                            "before send() is called");

        if (this.#sendFlag)
            throw new Error("INVALID_STATE_ERR: send has already been called");

        let ssl = false;
        let local = false;
        let url = new URL(this.#settings.url);
        let host;

        switch(url.protocol) {
            case "https:":
                ssl = true;
                host = url.hostname;
                break;
            case "http:":
                host = url.hostname;
                break;
            case "file:":
                local = true;
                break;
            case undefined:
            case null:
            case "":
                host = "localhost";
                break;
            default:
                throw new Error("Protocol not supported.");

        }

        // Fetch local filestystem (file://)
        if (local) {
            if (this.#settings.method !== "GET")
                throw new Error("XMLHttpRequest: Only GET method is supported");

            // currently, synchronous behavior is not implemented
            if (this.#settings.async === false) return;

            fs.readFile(url.pathname, "utf-8", (error, data) => {
                if (![null, undefined].includes(error))
                    this.#handleError(error);

                this.status = 200;
                this.responseText = data;
                this.#setState(this.DONE);
            });
        }

        // default to 443 for https, 80 for http
        let port = url.port || (ssl ? 443 : 80);

        // includes query string if present
        let uri = url.pathname + (url.search ? url.search : "");

        // Include default headers if not already provided
        Object.keys(this.#defaultHeaders).forEach(header => {
            if (!this.#headersCase[header.toLowerCase()])
                this.#headers[header] = this.#defaultHeaders[header]; 
        });

        // Set basic authentication if provided
        if (this.#settings.user) {
            if (typeof this.#settings.password === "undefined")
                this.#settings.password = "";

            const authBuffer = Buffer.from(
                `${this.#settings.user}:${this.#settings.password}`);
            
                this.headers.Authorization = 
                    `Basic ${authBuffer.toString("base64")}`;
        }

        if (this.#settings.method === "GET" || this.#settings.method === "HEAD")
            data = null;
        else if (data) {
            this.#headers["Content-Length"] = Buffer.isBuffer(data)
                                              ? data.length
                                              : Buffer.byteLength(data);
            if (!this.#headers["Content-Type"])
                this.#headers["Content-Type"] = "text/plain;charset=UTF-8";
        }
        else if (this.#settings.method === "POST")
            // Required by buggy servers the don't satisfy specifications.
            headers["Content-Length"] = 0;

        const options = {
            host,
            port,
            path: uri,
            method: this.#settings.method,
            headers: this.#headers, 
            agent: false,
            withCredentials: this.withCredentials
        }
        
        this.#errorFlag = false;

        const doRequest = ssl ? https.request : http.request;

        this.#sendFlag = true;

        this.#dispatchEvent("readystatechange");
        
        const self = this;
        this.#request = doRequest(options, function responseHandler(response) {
            self.#response = response;

            // check for redirect
            // @TODO Prevent looped redirects
            if ([301, 302, 303, 307].includes(response.statusCode)) {
                self.#settings.url = response.headers.location;
                const url = new Url(self.#settings.url);
                
                // outside scope uses this variable, so update it
                host = url.hostname;
                
                const newOptions = {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.path,
                    method: response.statusCode === 303
                            ? "GET"
                            : self.#settings.method,
                    headers,
                    withCredentials: this.withCredentialsq
                };

                request = doRequest(newOptions, responseHandler)
                    .on("error", self.#handleError);
                request.end();

                // @TODO Check if an XHR event needs to be fired here
                return;
            }

            response.setEncoding("utf8");

            self.#setState(self.HEADERS_RECEIVED);
            self.status = response.statusCode;

            response.on("data", chunk => {
                if (chunk)
                    self.responseText += chunk;
                if (self.#sendFlag)
                    self.#setState(self.LOADING);
            });

            response.on("end", () => {
                if (self.#sendFlag) {
                    self.#setState(self.DONE);
                    self.#sendFlag = false;
                }
            });

            response.on("error", self.#handleError);

        }).on("error", this.#handleError);

        if (typeof data === "string")
            this.#request.write(data);

        this.#request.end();

        this.#dispatchEvent("loadstart");
    }

    /**
     * Aborts the request.
     * This sets the readyState to UNSENT and status code to 0.
     */
    abort() {
        if (this.#request) {
            this.#request.abort();
            this.#request = null;
        }

        this.#headers = this.#defaultHeaders;
        this.status = 0;
        this.responseText = "";
        this.responseXML = null;

        this.#errorFlag = true;

        if (this.readyState !== this.UNSENT
            && (this.readyState !== this.OPENED || this.#sendFlag)
            && this.readyState !== this.DONE
        ) {
            this.#sendFlag = false;
            this.#setState(this.DONE);
        }
        this.readyState = this.UNSENT;
        this.#dispatchEvent("abort");
    }

    /**
     * Returns true if the specified header is allowed, false otherwise.
     * @param {String} header Header to validate
     * @return {Boolean}
     */
    #isAllowedHttpHeader(header) {
        return this.#disableHeaderCheck ||
            (typeof header === "string"
            && this.#forbiddenRequestHeaders.some(forbidden => 
                forbidden.toLowerCase() === header.toLowerCase())
            );
    }

    /**
     * Returns true if the provided method is allowed, false otherwise.
     * @param {String} method 
     * @returns {Boolean}
     */
    #isAllowedHttpMethod(method) {
        return typeof method === "string" &&
               this.#forbiddenRequestMethods.every(forbidden => 
                    forbidden.toLowerCase() !== method.toLowerCase()
               );
    }

    /**
     * Changes `readyState` and calls `onreadystatechange`.
     * @param {Number} state New state
     */
    #setState(state) {
        if (this.readyState === state && state !== this.LOADING) return;

        this.readyState = state;
        
        if (   this.#settings.async 
            || this.readyState < this.OPENED 
            || this.readyState === this.DONE
        )
            this.#dispatchEvent("readystatechange");
        
        if (this.readyState === this.DONE && !this.#errorFlag) {
            this.#dispatchEvent("load");
            // @TODO figure out InspectorInstrumentation::didLoadXHR(cookie)
            this.#dispatchEvent("loadend");
        }
    }

    /**
     * Dispatch an event.
     * This includes the "on" method and any events attached with 
     * `addEventListener`.
     * @param {String} event 
     */
    #dispatchEvent(event) {
        if (typeof this[`on${event}`] === "function")
            this[`on${event}`]();

        if (event in this.#listeners && Array.isArray(this.#listeners[event]))
            this.#listeners[event].forEach(listener => listener.call(this));
    }

    /**
     * Deals with any internal error.
     * @param {Error} error 
     */
    #handleError(error) {
        this.status = 0;
        this.statusText = error;
        this.responseText = error.stack;
        this.#errorFlag = true;
        this.#setState(this.DONE);
        this.#dispatchEvent("error");
    }
};

export default MockXMLHttpRequest;
