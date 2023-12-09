export function requestifyPromise(thenable, cancellable) {
    let cancel;
    const promise = new Promise((resolve, reject) => {
        Promise.resolve(thenable)
            .then(resolve)
            .catch(reject);
        if (cancellable === true) cancel = reject;
    });

    return function promiseRequestified(callback) {
        promise
            .then(value => callback({ value }))
            .catch(reason => callback({ reason }));
        if (cancellable === true) return cancel;
    }
}
