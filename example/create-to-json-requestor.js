import { requestifyPromise } from "./requestify-promise.js";

export function createToJsonRequestor(cancellable = false) {
    return function toJsonRequestor(callback, value) {
        try {
            return requestifyPromise(value.json(), cancellable)(callback);
        }
        catch(error) {
            callback(undefined, error)
        }
    }
}
