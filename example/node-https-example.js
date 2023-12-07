import { 
    createHttpsRequestor,
    createGetRequestor,
    createPostRequestor
} 
from "./example-utils/create-https-requestor.js";


const getCoffees = createHttpsRequestor(
    "https://api.sampleapis.com/coffee/hot",
    {
        headers: {
            "Content-Type": "application/json"
        },
        method: "GET",
        protocol: "https:"
    }
);

const cancel = getCoffees((value, reason) => {
    if (value === undefined) return console.log("Failure because", reason);
    console.log(value.data.map(element => element.title));
});
cancel(new Error("canceled!"));


const postCaleb = createPostRequestor("https://reqres.in/api/users", {
    "name": "Caleb Sword",
    "job": "Software Engineer"
});

postCaleb((value, reason) => {
    if (value === undefined) return console.log("Failure because", reason);
    console.log(value.data);
});

createGetRequestor("https://reqres.in/api/users/1")((value, reason) => {
    if (value === undefined) return console.log("Failure because", reason);
    console.log(value.data);
});
