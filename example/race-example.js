import parsec from "../src/index.js";

import { createDelayRequestor } from "./example-utils/create-delay-requestor.js";

const raceRequestor = parsec.race([
    createDelayRequestor(100),
    createDelayRequestor(200),
    createDelayRequestor(300)
]);

raceRequestor((value, reason) => {
    if (value === undefined) return console.log("Failure because", reason);
    console.log(value);
});

const raceTimeLimitedRequestor = parsec.race([
    createDelayRequestor(100),
    createDelayRequestor(200),
    createDelayRequestor(300)
], { timeLimit: 50 });

raceTimeLimitedRequestor((value, reason) => {
    if (value === undefined) return console.log("Failure because", reason);
    console.log(value);
});
