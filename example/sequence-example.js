import parsec from "../src/index.js";
import nebula from "./example-utils/nebula.js"
import { exists } from "../src/lib/utils.js";

const { usePromise, thru, branch, fail, map, ajaxGet, ajaxPost } = nebula;


// with parsec
parsec.sequence([
    usePromise(
        fetch("https://api.sampleapis.com/switch/games")
            .then(res => res.json())
    ),
    thru(response => console.log(response[response.length - 1].name)),
    ajaxGet("https://api.sampleapis.com/coffee/hot"),
    branch(
        response => response.statusCode === 404,
        fail("404!"),
        thru(response => console.log(`all good: ${response.statusCode}`))
    ),
    map(response => response.data[0]),
    ajaxPost("https://reqres.in/api/users"),
    branch(
        ({ statusCode }) => statusCode >= 400 && statusCode < 600,
        fail("4xx or 5xx error code!"),
        thru(response => console.log(`all good: ${response.statusCode}`))
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
