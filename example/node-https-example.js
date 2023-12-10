import parsec from "../src/index.js";
import { exists } from "../src/lib/utils.js";
import { 
    createHttpsRequestor,
    createPostRequestor,
    createGetRequestor
} 
from "./example-utils/create-https-requestor.js";

const getCoffees = createHttpsRequestor({
    hostname: "api.sampleapis.com",
    path: "/coffee/hot",
    method: "GET"
});

const postCaleb = createPostRequestor("https://reqres.in/api/users", {
    body: {
        "name": "Caleb Sword",
        "job": "Software Engineer"
    }
});

const getUser = createGetRequestor("https://reqres.in/api/users/1");

const performAllRequests = parsec.parallel([
    getCoffees, 
    postCaleb, 
    getUser
]);

performAllRequests(result => {
    if (!exists(result.value)) return console.log("Failure:", result.reason);

    result.value.forEach(({ value }) => {
        console.log(value.statusCode, value.statusMessage);
        console.log("Number of headers:", Object.keys(value.headers).length);
        if (Array.isArray(value.data))
            return console.log(value.data[0]);
        console.log(value.data);
    });    
});
