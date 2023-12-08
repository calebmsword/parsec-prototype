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
    method: "GET",
    protocol: "https:",
    responseMode: "lazy"
});

const postCaleb = createPostRequestor({
    url: "https://reqres.in/api/users",
    body: {
        "name": "Caleb Sword",
        "job": "Software Engineer"
    },
    headers: {
        "content-type": "application/json"
    }
});

getCoffees((value, reason) => {
    if (value === undefined) return console.log("Failure because", reason);

    // if (typeof value.data === "function")
    //     for (let chunk = value.data(); chunk !== undefined; chunk = value.data())
    //         console.log(chunk);
    // else
        console.log(value.data());
});

// const getUser = createGetRequestor("https://reqres.in/api/users/1");

// const parallelRequestor = parsec.parallel([getCoffees, postCaleb, getUser]);

// parallelRequestor((values, reason) => {
//     if (values === undefined) return console.log("Failure because", reason);

//     values.forEach(value => {
//         console.log(value.statusCode, value.statusMessage);
//         console.log("Number of headers:", Object.keys(value.headers).length);
//         if (Array.isArray(value.data)) {
//             console.log(value.data.map(e => e.title));
//             return;
//         }
//         console.log(value.data);
//     });    
// });
