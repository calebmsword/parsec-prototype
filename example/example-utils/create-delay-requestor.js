import { exists } from "../../src/parsec/lib/utils.js";


export function createDelayRequestor(delay) {
    return function delayRequestor(callback) {
        let timerId = setTimeout(() => {
            timerId = undefined;
            callback({ value: delay });
        }, delay);
        return function cancelDelay() {
            if (exists(timerId)) {
                clearTimeout(timerId);
                timerId = undefined;
            }
        }
    }
}
