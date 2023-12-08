import { exists } from "../../src/lib/utils.js";


export function createDelayRequestor(delay) {
    return function delayRequestor(callback) {
        let timerId = setTimeout(() => {
            timerId = undefined;
            callback(delay);
        }, delay);
        return function cancelDelay() {
            if (exists(timerId)) {
                clearTimeout(timerId);
                timerId = undefined;
            }
        }
    }
}
