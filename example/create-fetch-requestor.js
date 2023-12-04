export function createFetchRequestor(url) {
    return function(callback) {
        fetch(url)
            .then(callback)
            .catch(reason => callback(undefined, reason));
    }
}
