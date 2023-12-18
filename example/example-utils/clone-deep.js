/**
 * Deeply clones the provided value.
 * @param {any} _value The value to clone deeply.
 * @param {Function} customizer If provided, performs user-injected logic.
 * @returns {any} The deep clone.
 */
function cloneInternalNoRecursion(_value, customizer) {
    
    let result;

    // Will be used to store cloned values so that we don't loop infinitely on 
    // circular references.
    const cloneStore = new Map();

    // A stack so we can avoid recursion.
    const stack = [{ value: _value }];

    /**
     * Handles the assignment of the cloned value to some persistent place.
     * @param {any} cloned The cloned value.
     * @param {Object|Function|Undefined} parentOrAssigner Either the parent 
     * object that the cloned value will be assigned to, or a function which 
     * assigns the value itself. If `undefined`, then the value returned by 
     * the outer function will be assigned the cloned value. 
     * @param {String|Symbol} prop If `parentOrAssigner` is a parent object, 
     * then `parentOrAssigner[prop]` will be assigned `cloned`.
     * @param {Object} metadata The property descriptor for the object. If 
     * not an object, then this is ignored.
     * @returns The cloned value.
     */
    function assign(cloned, parentOrAssigner, prop, metadata) {
        if (parentOrAssigner === undefined) 
            result = cloned;
        else if (typeof parentOrAssigner === "function") 
            parentOrAssigner(cloned, prop, metadata);
        else if (typeof metadata === "object") {
            const hasAccessor = ["get", "set"].some(key => 
                typeof metadata[key] === "function");
            
            // `cloned` or getAccessor will determine the value
            delete metadata.value;

            // defineProperty throws if property with accessors is writeable
            if (hasAccessor) delete metadata.writable;

            Object.defineProperty(parentOrAssigner, prop, Object.assign(
                // defineProperty throws if value and set/get accessor coexist
                hasAccessor ? {} : { value: cloned },
                metadata,
            ));
        }
        else 
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
        // `prop` is used with `parentOrAssigner` if it is an object so that the 
        // cloned object will be assigned to `parentOrAssigner[prop]`.
        // `metadata` contains the property descriptor(s) for the value. It may 
        // be undefined.
        const { value, parentOrAssigner, prop, metadata } = popped;
        
        // Will contain the cloned object.
        let cloned;

        // If value is primitive, just assign it directly.
        if (value === null || !["object", "function"].includes(typeof value)) {
            assign(value, parentOrAssigner, prop, metadata);
            continue;
        }

        // Check for circular references.
        const seen = cloneStore.get(value);
        if (seen !== undefined) {
            assign(seen, parentOrAssigner, prop, metadata);
            continue;
        }

        // Perform user-injected logic if applicable.
        if (typeof customizer === "function") {
            const customResult = customizer(value, 
                                            parentOrAssigner, 
                                            prop, 
                                            metadata);
            if (customResult !== undefined) cloned = customResult;
        }

        // We won't clone weakmaps or weaksets.
        else if ([WeakMap, WeakSet].some(cls => value instanceof cls)) {
            assign({}, parentOrAssigner, prop, metadata);
            continue;
        }

        // We only copy functions if they are methods.
        else if (typeof value === "function") {
            assign(parentOrAssigner !== undefined 
                       ? value 
                       : {}, 
                   parentOrAssigner, 
                   prop, 
                   metadata);
            continue;
        }

        // If value is a Node Buffer, just use Buffer's subarray method.
        else if (typeof global === "object"
                 && global.Buffer
                 && typeof Buffer === "function"
                 && typeof Buffer.isBuffer === "function"
                 && Buffer.isBuffer(value))
            cloned = assign(value.subarray(), parentOrAssigner, prop, metadata);
        
        else if (Array.isArray(value))
            cloned = assign(new Array(value.length), 
                            parentOrAssigner, 
                            prop, 
                            metadata);

        // Ordinary objects, or the rare `arguments` clone
        else if (["[object Object]", "[object Arguments]"]
                    .includes(Object.prototype.toString.call(value)))
            cloned = assign(Object.create(Object.getPrototypeOf(value)), 
                            parentOrAssigner, 
                            prop,
                            metadata);
        
        // values that will be called using contructor
        else {
            const Value = value.constructor;

            try {
                // Booleans, Number, String or Symbols which used `new` syntax 
                // so JavaScript thinks they are objects
                // We also handle Date here because it is convenient
                if (value instanceof Boolean || value instanceof Date)
                    cloned = assign(new Value(Number(value)), 
                                    parentOrAssigner, 
                                    prop,
                                    metadata);
                else if (value instanceof Number || value instanceof String)
                    assign(new Value(value), parentOrAssigner, prop, metadata);
                else if (value instanceof Symbol) {
                    cloned = assign(
                        Object(Symbol.prototype.valueOf.call(value)), 
                        parentOrAssigner, 
                        prop,
                        metadata);
                }

                // Regular Expression
                else if (value instanceof RegExp) {
                    const regExp = new Value(value.source, /\w*$/.exec(value));
                    regExp.lastIndex = value.lastIndex;
                    cloned = assign(regExp, parentOrAssigner, prop, metadata);
                }

                // Error
                else if (value instanceof Error) {
                    const cause = value.cause;
                    cloned = assign(cause === undefined
                                        ? new Value(value.message)
                                        : new Value(value.message, { cause }),
                                    parentOrAssigner,
                                    prop,
                                    metadata);
                }

                // Check if we are instance of global JavaScript class which is 
                // a proxy to data. If we are, try to copy that data in a new 
                // instance of that class.
                // This includes ArrayBuffer, TypeArray, Map, & Set. 
                else if (value instanceof ArrayBuffer) {
                    const arrayBuffer = new Value(value.byteLength);
                    new Uint8Array(arrayBuffer).set(new Uint8Array(value));
                    cloned = assign(arrayBuffer, 
                                    parentOrAssigner, 
                                    prop, 
                                    metadata);
                }

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
                    const buffer = new value.buffer.constructor(
                        value.buffer.byteLength);
                    new Uint8Array(buffer).set(new Uint8Array(value.buffer));
                    cloned = assign(
                        new Value(buffer, value.byteOffset, value.length),
                        parentOrAssigner,
                        prop,
                        metadata);
                }

                else if (value instanceof Map) {
                    const map = new Value;
                    cloned = assign(map, parentOrAssigner, prop, metadata);
                    value.forEach((subValue, key) => {
                        stack.push({ 
                            value: subValue, 
                            parentOrAssigner: cloned => {
                                map.set(key, cloned)
                            }
                        });
                    });
                }

                else if (value instanceof Set) {
                    const set = new Value;
                    cloned = assign(set, parentOrAssigner, prop, metadata);
                    value.forEach(subValue => {
                        stack.push({ 
                            value: subValue, 
                            parentOrAssigner: cloned => {
                                map.set(key, cloned)
                            }
                        });
                    });
                }
            }
            catch(error) {
                console.warn("Unable to clone a specific value. This value " +
                             "will be assigned an empty object in cloned " +
                             "result. Encountered error:\n", error);
                assign({}, parentOrAssigner, prop, metadata);
            }
        }
        
        cloneStore.set(value, cloned);

        // Now copy all enumerable and non-enumerable properties.
        [Object.getOwnPropertyNames(value), Object.getOwnPropertySymbols(value)]
            .flat()
            .forEach(key => {
                stack.push({ 
                    value: value[key], 
                    parentOrAssigner: cloned,
                    prop: key,
                    metadata: Object.getOwnPropertyDescriptor(value, key)
                });
            });
    }

    return result;
}

/**
 * Create a deep copy of the provided value.
 * The cloned object will point to the *same prototype* as the original.
 * 
 * Weakmaps and weaksets cannot be correctly cloned. If you provide a weakmap, 
 * weakset, *or a subclass of these classes*, then an empty object will be 
 * returned. The test for this condition uses the `instanceof` operator.
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
 * Warning: any class which overrides `Symbol.toStringTag` so that it returns 
 * "Object" or "Argument" may have unexpected behavior when cloned.
 * 
 * @param {any} value The value to deeply copy.
 * @param {Function} customizer Allows the user to inject custom logic. The 
 * function provided is given four arguments: `value`, `parentOrAssigner`, 
 * `prop` and `metadata`. If the function returns any value that is not 
 * `undefined`, then that value is used as the cloned result.
 * @returns {Object} The deep copy.
 */
function clone(value, customizer) {
    return cloneInternalNoRecursion(value, customizer);
}

export default clone;
