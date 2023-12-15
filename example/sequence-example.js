import parsec from "../src/index.js";
import nebula from "./example-utils/nebula.js"
import { exists } from "../src/lib/utils.js";

const { thru, branch, fail, map, GET, POST } = nebula;


// with parsec
parsec.sequence([
    GET("https://api.sampleapis.com/coffee/hot"),
    map(response => response.data[0]),
    POST("https://reqres.in/api/users"),
    map(response => response.data)
])
(({ value, reason }) => {
    if (exists(value)) return console.log("Success:", value);
    console.log("Failure because", reason);
});

// more complex example using branch to check response status
parsec.sequence([
    GET("https://api.sampleapis.com/coffee/hot"),
    branch(
        response => response.statusCode === 404,
        fail("404!"),
        thru(response => console.log(`all good: ${response.statusMessage}`))
    ),
    map(response => response.data[0]),
    POST("https://reqres.in/api/users"),
    branch(
        ({ statusCode }) => statusCode >= 400 && statusCode < 600,
        fail("4xx or 5xx error code!"),
        thru(response => console.log(`all good: ${response.statusMessage}`))
    ),
    map(response => response.data)
])
(({ value, reason }) => {
    if (exists(value)) return console.log("Success:", value);
    console.log("Failure because", reason);
});

// with async-await
// (async () => {
//     const coffees = await fetch("https://api.sampleapis.com/coffee/hot");
//     const coffee = await coffees.json().then(res => res[0]);
//     const res = await fetch("https://reqres.in/api/users", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(coffee)
//     });
//     return await res.json();
// })()
//     .then(console.log)
//     .catch(reason => console.log("Failure because", reason));
