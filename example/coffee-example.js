import parseq from "../src/index.js";
import { createFetchRequestor } from "./create-fetch-requestor.js";

const coffeeRequestor = createFetchRequestor("https://api.sampleapis.com/coffee/hot");

function toJsonRequestor(callback, value) {
    try {
        value.json()
            .then(value => callback(value))
            .catch(reason => callback(undefined, reason));
    }
    catch(error) {
        callback(undefined, error);
    }
}

const getAllCoffeeRequestor = parseq.sequence({
    requestors: [coffeeRequestor, toJsonRequestor]
});

getAllCoffeeRequestor((value, reason) => {
    if (value === undefined) console.log("Failure:", reason);

    console.log(value.map(element => element.title))
});
