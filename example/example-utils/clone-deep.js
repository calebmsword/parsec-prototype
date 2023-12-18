/**
 * Deeply clones the provided value.
 * @param {any} _value The value to clone deeply.
 * @returns {any} The deep clone.
 */
function cloneInternalNoRecursion(_value) {
    
    let result;

    const hash = new Map();

    const stack = [{ value: _value }];

    /**
     * 
     * @param {any} cloned The cloned value.
     * @param {Object|Function|Undefined} parentOrAssigner Either the parent 
     * object that the cloned value will be assigned to, or a function which 
     * assigns the value itself. If `undefined`, then the value returned by 
     * the outer function will be assigned the cloned value. 
     * @param {String|Symbol} prop If `parentOrAssigner` is a parent object, 
     * then `prop` is the property that will be assigned `cloned`.
     * @returns 
     */
    function assign(cloned, parentOrAssigner, prop) {
        if (parentOrAssigner === undefined) 
            result = cloned;
        else if (typeof parentOrAssigner === "function") 
            parentOrAssigner(cloned);
        else if (prop !== undefined) 
            parentOrAssigner[prop] = cloned;
        return cloned;
    }
    
    for (let popped = stack.pop(); popped !== undefined; popped = stack.pop()) {
        // `value` is the value to deeply clone
        // `parentOrAssigner` is either
        //     - undefined - this value is the top-level object that will be 
        //                   returned by the function
        //     - object    - a parent object this value is nested under
        //     - function  - an "assigner" that has the responsiblity of 
        //                   assigning the cloned value to something
        // `prop` is used with `parentOrAssigner` if it is an object--the cloned 
        // object will be assigned to `parentOrAssigner[prop]`. 
        const { value, parentOrAssigner, prop } = popped;
        
        // This may reference the cloned object.
        let current;

        // If value is primitive, just assign it directly.
        if (value === null || !["object", "function"].includes(typeof value)) {
            assign(value, parentOrAssigner, prop);
            continue;
        }

        // Check for circular references.
        const seen = hash.get(value);
        if (seen !== undefined) {
            assign(seen, parentOrAssigner, prop);
            continue;
        }

        const isFunc = typeof value === "function";

        // We won't clone errors, weakmaps or weaksets..
        if ([Error, WeakMap, WeakSet].some(cls => value instanceof cls)) {
            assign({}, parentOrAssigner, prop);
            continue;
        }

        // We only copy functions if they are methods.
        else if (isFunc) {
            assign(parentOrAssigner !== undefined 
                       ? value 
                       : {}, 
                   parentOrAssigner, 
                   prop);
            continue;
        }

        // If value is a Node Buffer, just use Buffer's subarray method.
        else if (global
                 && global.Buffer
                 && typeof Buffer === "function"
                 && typeof Buffer.isBuffer === "function"
                 && Buffer.isBuffer(value))
            current = assign(value.subarray(), parentOrAssigner, prop);
        
        else if (Array.isArray(value))
            current = assign(new Array(value.length), parentOrAssigner, prop);

        // Ordinary objects, or the rare `arguments` clone
        else if (["[object Object]", "[object Arguments]"]
                    .includes(Object.prototype.toString.call(value) 
                || (isFunc && !parentOrAssigner)))
            current = assign(Object.create(Object.getPrototypeOf(value)), 
                             parentOrAssigner, 
                             prop);
        
        // Check if we are instance of global JavaScript class which is a proxy 
        // to data. If we are, try to copy that data in a new instance of that 
        // class.
        else {
            try {
                const Value = value.constructor;

                if (value instanceof ArrayBuffer) {
                    const arrayBuffer = new Value(value.byteLength);
                    new Uint8Array(arrayBuffer).set(new Uint8Array(value));
                    current = assign(arrayBuffer, parentOrAssigner, prop);
                }
                else if (value instanceof Boolean || value instanceof Date)
                    current = assign(new Value(Number(value)), 
                                     parentOrAssigner, 
                                     prop);
                else if (  value instanceof DataView
                        || value instanceof Float32Array
                        || value instanceof Float64Array
                        || value instanceof Int8Array
                        || value instanceof Int16Array
                        || value instanceof Int32Array
                        || value instanceof Uint8Array
                        || value instanceof Uint8ClampedArray
                        || value instanceof Uint16Array
                        || value instanceof Uint32Array) {
                    const buffer = value.buffer.constructor(
                        value.buffer.byteLength);
                    new Uint8Array(buffer).set(new Uint8Array(value.buffer));
                    current = assign(
                        new Value(buffer, value.byteOffset, value.length),
                        parentOrAssigner,
                        prop);
                }
                else if (value instanceof Map) {
                    const map = new Value;
                    current = assign(map, parentOrAssigner, prop);
                    value.forEach((subValue, key) => {
                        stack.push({ 
                            value: subValue, 
                            parentOrAssigner: assigned => {
                                map.set(key, assigned);
                            } 
                        });
                    });
                }
                else if (value instanceof Set) {
                    const set = new Value;
                    current = assign(set, parentOrAssigner, prop);
                    value.forEach(subValue => {
                        stack.push({ 
                            value: subValue, 
                            parentOrAssigner: assigned => {
                                set.add(assigned);
                            }
                        });
                    });
                }
                else if (value instanceof Number || value instanceof String)
                    assign(new Value(value), parentOrAssigner, prop);
                else if (value instanceof RegExp) {
                    const regExp = new Value(value.source, /\w*$/.exec(value));
                    regExp.lastIndex = value.lastIndex;
                    current = assign(regExp, parentOrAssigner, prop);
                }
                else if (value instanceof Symbol) {
                    current = assign(
                        Object(Symbol.prototype.valueOf.call(value)), 
                        parentOrAssigner, 
                        prop);
                }
            }
            catch(error) {
                console.warn("Unable to clone data inaccessible through " + 
                             "property access. Encountered error:\n", error);
                try { 
                    assign(new Value, parentOrAssigner, prop) 
                }
                catch(_error) { 
                    assign({}, parentOrAssigner, prop)
                }
            }
        }

        hash.set(value, current);

        // Now copy all enumerable and non-enumerable properties.
        [Object.getOwnPropertyNames(value), Object.getOwnPropertySymbols(value)]
            .flat()
            .forEach(key => {
                stack.push({ 
                    value: value[key], 
                    parentOrAssigner: current, 
                    prop: key 
                });
            });
    }

    return result;
}

/**
 * Create a deep copy of the provided value.
 * The cloned object will point to the *same prototype* as the original.
 * 
 * Error objects, weakmaps and weaksets cannot be correctly cloned. If you 
 * provide a function, error object, or weakmap, *or a subclass of these 
 * classes*, then an empty object will be returned. The test for this condition 
 * uses the `instanceof` operator.
 * 
 * Functions also cannot be properly cloned. If you provided a function to this 
 * method, an empty object will be returned. If the object contains methods, 
 * they will be copied by value (no new function object will be created).
 * 
 * This method works consistently for properties, but there is potential for 
 * problems if you subclass internal JavaScript classes such as TypeArray, Map, 
 * Set, or other global JavaScript objects which are proxies for data. This 
 * method will attempt to clone that data, but if you override the constructor 
 * for the class, dynamically alter the `constructor` property, use 
 * `Object.setPrototypeOf`, or use a custom `Symbol.toStringTag` property, it is 
 * impossible to guarantee that the data will be cloned correctly.
 * 
 * @param {any} value The value to deeply copy.
 * @returns {Object} The deep copy.
 */
function clone(value) {
    return cloneInternalNoRecursion(value);
}

export default clone;
