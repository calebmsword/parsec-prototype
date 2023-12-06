import parseq from "../src/index.js";
import { createGetRequestor } from "./create-get-requestor.js";
import { createToJsonRequestor } from "./create-to-json-requestor.js"

const getCoffees = createGetRequestor("https://api.sampleapis.com/coffee/hot");
const toJson = createToJsonRequestor();

const getAllCoffee = parseq.sequence([getCoffees, toJson]);

getAllCoffee((value, reason) => {
    if (value === undefined) return console.log("Failure:", reason);

    console.log(value.map(element => element.title))
});
