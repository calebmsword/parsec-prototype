import parseq from "../index.js";
import { createFetchRequestor } from "./create-fetch-requestor.js";

const coffeeRequestor = createFetchRequestor("https://api.sampleapis.com/coffee/hot");

function toJsonRequestor(callback, value) {
    if (typeof value.json !== "function") {
        callback(undefined, new Error("No method called `json`!"));
    }

    const result = value.json();

    if (typeof result.then !== "function") {
        callback(undefined, new Error("json() does not return a thenable!"));
    }

    Promise.resolve(result)
        .then(value => callback(value))
        .catch(reason => callback(undefined, reason));
}

const getAllCoffeeRequestor = parseq.sequence({
    requestors: [coffeeRequestor, toJsonRequestor]
});

getAllCoffeeRequestor((value, reason) => {
    if (value === undefined) console.log("Failure:", reason);

    console.log(value.map(element => element.title))
});
