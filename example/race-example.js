import parsec from "../src/index.js";

import { createDelayRequestor } from "./example-utils/create-delay-requestor.js";

const race = parsec.race([
    createDelayRequestor(100),
    createDelayRequestor(200),
    createDelayRequestor(300)
]);

race((value, reason) => {
    if (value === undefined) return console.log("Failure because", reason);
    console.log(value);
});

const raceTimeLimited = parsec.race([
    createDelayRequestor(100),
    createDelayRequestor(200),
    createDelayRequestor(300)
], { timeLimit: 50 });

raceTimeLimited((value, reason) => {
    if (value === undefined) return console.log("Failure because", reason);
    console.log(value);
});

const raceThrottled = parsec.race([
    createDelayRequestor(1000),
    createDelayRequestor(500),
    createDelayRequestor(100)
], { throttle: 2 });

raceThrottled((value, reason) => {
    if (value === undefined) return console.log("Failure because", reason);
    console.log(value);
});
