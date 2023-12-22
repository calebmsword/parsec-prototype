import parsec from "../src/parsec/index.js";

import { createDelayRequestor } from "./example-utils/create-delay-requestor.js";

const race = parsec.race([
    createDelayRequestor(100),
    createDelayRequestor(200),
    createDelayRequestor(300)
]);

const raceTimeLimited = parsec.race([
    createDelayRequestor(100),
    createDelayRequestor(200),
    createDelayRequestor(300)
], { timeLimit: 50 });

const raceThrottled = parsec.race([
    createDelayRequestor(1000),
    createDelayRequestor(500),
    createDelayRequestor(100)
], { throttle: 2 });

const doRaces = parsec.parallel({
    optionals: [race, raceTimeLimited, raceThrottled]
});

doRaces(result => {
    if (!result.value) return console.log("Failure because", result.reason);

    result.value.forEach(({ value, reason }) => {
        if (value === undefined) return console.log("Failure because", reason);
        console.log(value);
    })
});
