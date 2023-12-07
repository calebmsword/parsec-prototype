import https from "node:https";

/**
 * A requestor factory. Creates requestors that make HTTPS requests.
 * The value passed to the requestor callback will be 
 * @param {String|Url} url Either a string or a URL object.
 * @param {*} options The options hash which can be passed to https.request.
 * @param {*} body A string representing the body of request, if it has one.
 * @param {*} customCancel If a custom function is provided, then it will be 
 * used as the cancellor for the returned requestor.
 * @returns {Function} An HTTPS requestor.
 */
export function createHttpsRequestor(url, options = {}, body, customCancel) {
    /**
     * @param {Function} A requestor callback.
     * @returns {Function} A cancellor. By default, this is the 
     * `request.destroy()` method from Node's https API. But if a custom cancel 
     * is provided, it will be used instead.
     */
    return function httpsRequestor(callback) {
        // We have multiple subscriptions to error events, so if execute  
        // callback directly for each, we will have multiple errors printed
        function tryCallback(value, reason) {
            if (callback === undefined) return;
            callback(value, reason);
            callback = undefined;
        }

        try {
            let requestInitialized = false;
            let shouldDestroy = false;
            let savedReason;

            const request = https.request(url, options, response => {
                requestInitialized = true;
                const chunks = [];

                // treat response as ordinary strings
                response.setEncoding("utf-8");
                
                const result = {
                    statusCode: response.statusCode,
                    statusMessage: response.statusMessage,
                    headers: response.headers
                }
                
                response.on("error", error => tryCallback(undefined, error));

                response.on("data", chunk => {
                    if (shouldDestroy) return request.destroy(savedReason);

                    chunks.push(chunk);
                });

                response.on("close", () => {
                    if (shouldDestroy) return request.destroy(savedReason);

                    result.data = JSON.parse(chunks.join(""));
                    tryCallback(result);
                });
            });
            
            request.on("error", reason => tryCallback(undefined, reason));
            request.write(body || "");
            request.end();

            if (typeof customCancel === "function") return customCancel;

            return function attemptCancel(reason) {
                shouldDestroy = true;
                savedReason = reason;

                // You get problems if you try to stop a request before the 
                // socket is created. If socket is not yet created, try again
                if (requestInitialized === false) {
                    setTimeout(() => attemptCancel(reason), 0);
                    return;
                }
                
                request.destroy(reason);
            }
        }
        catch(error) {
            tryCallback(undefined, error);
        }
    }
}

export function createGetRequestor(url) {
    return createHttpsRequestor(url);
}

export function createPostRequestor(url, body) {
    return createHttpsRequestor(
        url, 
        { 
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        }, 
        JSON.stringify(body)
    );
}
