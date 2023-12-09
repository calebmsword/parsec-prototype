import parsec from "../src/index.js";
import { createGetRequestor } from "./example-utils/create-get-requestor.js";
import { createToJsonRequestor } from "./example-utils/create-to-json-requestor.js"

const getCoffees = createGetRequestor("https://api.sampleapis.com/coffee/hot");
const toJson = createToJsonRequestor();

const getAllCoffee = parsec.sequence([getCoffees, toJson]);

getAllCoffee(({ value, reason }) => {
    if (value === undefined) return console.log("Failure because", reason);

    console.log(value.map(element => element.title))
});
