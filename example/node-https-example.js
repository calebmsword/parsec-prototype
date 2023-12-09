import parsec from "../src/index.js";
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
    },
    headers: {
        "content-type": "application/x-www-form-urlencoded"
    }
});

const getUser = createGetRequestor("https://reqres.in/api/users/1");

const performAllRequests = parsec.parallel([
    getCoffees, 
    postCaleb, 
    getUser
]);

performAllRequests(response => {
    if (!response.value) return console.log("Failure because", response.reason);

    response.value.forEach(({ value }) => {
        console.log(value.statusCode, value.statusMessage);
        console.log("Number of headers:", Object.keys(value.headers).length);
        if (Array.isArray(value.data)) {
            console.log(value.data.map(e => e.title));
            return;
        }
        console.log(value.data);
    });    
});
