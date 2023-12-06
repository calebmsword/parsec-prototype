import { requestifyPromise } from "./requestify-promise.js";

export function createGetRequestor(url, cancellable = false) {
    return requestifyPromise(fetch(url), cancellable);
}
