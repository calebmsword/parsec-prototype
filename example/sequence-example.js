import parsec from "../src/index.js";
import { requestorUtils } 
    from "./example-utils/ergonomic-https-factories.js"
import { exists } from "../src/lib/utils.js";

// with parsec
parsec.sequence([
    requestorUtils.getRequest("https://api.sampleapis.com/coffee/hot"),
    requestorUtils.map(response => response.data[0]),
    requestorUtils.postRequest("https://reqres.in/api/users"),
    requestorUtils.map(response => response.data)
])
(({ value, reason }) => {
    if (exists(value)) return console.log(value);
    console.log("Failure because", reason);
});

// with async-await
(async () => {
    const coffees = await fetch("https://api.sampleapis.com/coffee/hot");
    const coffee = await coffees.json().then(res => res[0]);
    const res = await fetch("https://reqres.in/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coffee)
    });
    return await res.json();
})()
    .then(console.log)
    .catch(reason => console.log("Failure because", reason));
