/**
 * Deeply clones the provided value.
 * @param {any} _value The value to clone deeply.
 * @param {Function} customizer If provided, performs user-injected logic.
 * @param {log} log Logs any errors encountered.
 * @returns {any} The deep clone.
 */
function cloneInternalNoRecursion(_value, customizer, log) {
    
    if (typeof log !== "function") log = console.warn;

    let result;

    // Will be used to store cloned values so that we don't loop infinitely on 
    // circular references.
    const cloneStore = new Map();

    // This symbol is used to indicate that the cloned value is the top-level 
    // object that will be returned by the function.
    const TOP_LEVEL = Symbol("TOP_LEVEL");

    // A stack so we can avoid recursion.
    const stack = [{ value: _value, parentOrAssigner: TOP_LEVEL }];    
    
    // We will do a second pass through everything to check Object.isSeal and 
    // Object.isFrozen
    const metaStack = [];
    
    /**
     * Creates a CloneDeepWarning instance, a subclass of Error.
     * @param {String} message The error message.
     * @param {Object} cause If an object with a `cause` property, it will add 
     * a cause to the error when logged.
     * @returns {Error} A CloneDeepWarning, which is an Error subclass.
     */
    function warn(message, cause) {
        class CloneDeepWarning extends Error {
            constructor(message, cause) {
                super(message, cause);
                this.name = CloneDeepWarning.name;
            }
        }

        return cause !== undefined 
               ? new CloneDeepWarning(message, cause)
               : new CloneDeepWarning(message);
    }

    /**
     * Handles the assignment of the cloned value to some persistent place.
     * @param {any} cloned The cloned value.
     * @param {Object|Function|Symbol} parentOrAssigner Either the parent 
     * object that the cloned value will be assigned to, or a function which 
     * assigns the value itself. If equal to TOP_LEVEL, then the value returned 
     * by the outer function will be assigned the cloned value. 
     * @param {String|Symbol} prop If `parentOrAssigner` is a parent object, 
     * then `parentOrAssigner[prop]` will be assigned `cloned`.
     * @param {Object} metadata The property descriptor for the object. If 
     * not an object, then this is ignored.
     * @returns The cloned value.
     */
    function assign(cloned, parentOrAssigner, prop, metadata) {
        if (parentOrAssigner === TOP_LEVEL) 
            result = cloned;
        else if (typeof parentOrAssigner === "function") 
            parentOrAssigner(cloned, prop, metadata);
        else if (typeof metadata === "object") {
            const hasAccessor = ["get", "set"].some(key => 
                typeof metadata[key] === "function");
            
            // `cloned` or getAccessor will determine the value
            delete metadata.value;

            // defineProperty throws if property with accessors is writeable
            if (hasAccessor) {
                delete metadata.writable;
                log(warn("Cloning value whose property descriptor is a get " + 
                         "or set accessor!"));
            }

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
        // We don't allow symbols yet so that a customizer can ignore them.
        if (value === null || !["object", "function", "symbol"]
                .includes(typeof value)) {
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
        let customClone, additionalValues, dontClone, dontCloneProps, doThrow;
        if (typeof customizer === "function") {
            try {
                const customResult = customizer(value);
                
                if (typeof customResult === "object") {
                    // Must wrap destructure in () if not variable declaration
                    ({ customClone, 
                       additionalValues,
                       dontClone,
                       dontCloneProps 
                    } = customResult);

                    if (dontClone === true) continue;

                    cloned = assign(customClone, 
                                    parentOrAssigner, 
                                    prop, 
                                    metadata);

                    if (Array.isArray(additionalValues))
                        additionalValues.forEach(object => {
                            if (typeof object === "object") {
                                object.parentOrAssigner = object.assigner;
                                stack.push(object);
                            }
                        });
                }
            }
            catch(error) {
                if (doThrow === true) throw error;

                customClone = undefined;
                
                error.message = "customizer encountered error. Its results " + 
                                "will be ignored for the current value, and " + 
                                "the algorithm will proceed as normal. Error " +
                                "encountered: " + error.message;
                log(warn(error.message, error.cause));
            }
        }

        if (customClone !== undefined) {
            /* skip the following "else if" branches*/
        }

        // Handle symbol primitives after customizer so they can be ignored
        else if (typeof value === "symbol") {
            assign(value, parentOrAssigner, prop, metadata);
            continue;
        }

        // We won't clone weakmaps or weaksets.
        else if ([WeakMap, WeakSet].some(cls => value instanceof cls)) {
            log(warn(`Attempted to clone unsupported type${
                typeof value.constructor === "function" && 
                typeof value.constructor.name === "string"
                ? ` ${value.constructor.name}`
                : ""
            }. The value will be copied as an empty object.`))
            assign({}, parentOrAssigner, prop, metadata);
            continue;
        }

        // We only copy functions if they are methods.
        else if (typeof value === "function") {
            assign(parentOrAssigner !== TOP_LEVEL 
                       ? value 
                       : {}, 
                   parentOrAssigner, 
                   prop, 
                   metadata);
            log(warn(`Cloning function${typeof prop === "string"
                                        ? ` with name ${prop}`
                                        : ""  }! ` + 
                     "JavaScript functions cannot be cloned. If this " + 
                     "function is a method, then it will be copied directly!"));
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
                    cloned = assign(new Value(value), 
                                    parentOrAssigner, 
                                    prop, 
                                    metadata);
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

                else {
                    log(warn("Unsupported type in object. The value will be" + 
                             "\"cloned\" into an empty object."));
                    clone = assign({}, parentOrAssigner, prop, metadata);
                }
            }
            catch(error) {
                error.message = "Encountered error while attempting to clone " + 
                                "specific value. The value will be \"cloned\"" + 
                                "into an empty object. Error encountered: " + 
                                error.message
                log(warn(error.message, error.cause));
                clone = assign({}, parentOrAssigner, prop, metadata);
            }
        }

        if (dontCloneProps === true) continue;

        cloneStore.set(value, cloned);

        metaStack.push([value, cloned]);

        // Ensure clone has prototype of value
        if (Object.getPrototypeOf(cloned) !== Object.getPrototypeOf(value))
            Object.setPrototypeOf(cloned, Object.getPrototypeOf(value));

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

    // check for seal, frozen status
    for (let pop = metaStack.pop(); pop !== undefined; pop = metaStack.pop()) {
        const [value, cloned] = pop;
        if (Object.isFrozen(value)) Object.freeze(cloned);
        else if (Object.isSealed(value)) Object.seal(cloned);
    }

    return result;
}

/**
 * Create a deep copy of the provided value.
 * The cloned object will point to the *same prototype* as the original.
 * 
 * This behaves like structuredClone, but there are differences:
 *  - The function is not recursive, so the call stack does not blow up for 
 * deeply nested objects. (Unfortunately, as of December 2023, V8 implements 
 * structuredClone with a recursive algorithm. Hopefully this will change in the 
 * future.)
 *  - Methods are copied over to the clone. The functions are not clones, they 
 * point to the same function as the original.
 *  - This algorithm works with all of the listed JavaScript types in 
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#javascript_types,
 * as well as Symbols and Node Buffer objects.
 *  - This algorithm does NOT work for the Web API types in
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#webapi_types).
 *  - The property descriptor of properties are preserved. structuredClone 
 * ignores them.
 *  - Unsupported types fail "quietly". Any unsupported type is simply copied 
 * as an empty object, and a warning is logged to the console (or sent to the 
 * custom logger provided).
 * 
 * Weakmaps and weaksets cannot be correctly cloned. If you provide a weakmap, 
 * weakset, *or a subclass of these classes*, then an empty object will be 
 * returned. The test for this condition uses the `instanceof` operator.
 * 
 * Functions also cannot be properly cloned. If you provide a function to this 
 * method, an empty object will be returned. However, if you provide an object 
 * with methods, they will be copied by value (no new function object will be 
 * created). A warning is logged if this occurs.
 * 
 * This method works consistently for properties, but there is potential for 
 * problems if you subclass internal JavaScript classes such as TypeArray, Map, 
 * Set, or other global JavaScript objects which are proxies for data. This 
 * method will attempt to clone that data, but if you override the constructor 
 * for the class, dynamically alter the `constructor` property, use 
 * `Object.setPrototypeOf`, or use a custom `Symbol.toStringTag` property, it is 
 * impossible to guarantee that the data will be cloned correctly.
 * 
 * Also note that any class which overrides `Symbol.toStringTag` so that it 
 * returns "Object" or "Argument" may have unexpected behavior when cloned.
 * 
 * An optional `customizer` can be provided to add additional logic. The 
 * algorithm incorporates the customizer in the following way for each value 
 * that is cloned:
 * 
 *  1) Check if the value is a primitive type (except for symbols, which are 
 * handled in step 5). If so, simply copy it.
 *  2) Check the store of already seen values to see if the provided value is a 
 * circular reference. If so, use the clone stored in the store for that value.
 *  3) If the customizer is provided, **pass the value to the customizer**.
 *  4) If the customizer returns an object which has a `customClone` property 
 * that is not `undefined`, then the `customClone` property in that object is 
 * used as the clone for the value.
 *  5) If there is no customizer, or the customizer returns any value that is 
 * not an object, or the customizer returns an object whose `customClone` 
 * property is undefined, then the algorithm proceeds as normal. The algorithm 
 * checks if the object if one of the supported types and clones it in the 
 * appropriate way. If it is not one of the appropriate types, the logger is 
 * called with a warning and the value is copied as an empty object. 
 *  6) Save the cloned value in a store to check for circular references in the 
 * future.
 *  7) Repeat for all properties on the provided value.
 * 
 * @example
 * ```
 * // Don't clone methods
 * const myObject = { 
 *     a: 1, 
 *     func: () => "I am a function" 
 * };
 * const cloned = clone(myObject, {
 *     customizer(value) {
 *         if (typeof value === "function") {
 *             return { customClone: {} };
 *         }
 *     }
 * });
 * console.log(cloned);  // { a: 1, func: {} }
 * ```
 * 
 * The object returned by the customizer can also have an `additionalValues` 
 * property. If it is an array, then it is an array of objects which represent 
 * additional values that will be cloned. The objects in the array must have the 
 * following properties:
 * 
 *  - `value`: It is the value to clone.
 *  - `assigner`: It must be a function. It has the responsiblity of assigning 
 * the clone of `value` to something. It is passed the clone of `value` as an 
 * argument.
 * 
 * The `additionalValues` property should only be used to clone data an object 
 * can only access through its methods. See the following example. 
 * 
 * @example
 * ```
 * class Wrapper {
 *     #value;
 *     get() {
 *         return this.#value;
 *     }
 *     set(value) {
 *         this.#value = value;
 *     }
 * }
 * 
 * const wrapper = new Wrapper();;
 * wrapper.set({ foo: "bar" });
 * 
 * const cloned = clone(wrapper, {
 *     customizer(value) {
 *         if (!(value instanceof Wrapper)) return;
 * 
 *         const clonedWrapper = new Wrapper();
 *         
 *         return {
 *             customClone: clonedWrapper,
 * 
 *             additionalValues: [{
 *                 // the cloning algorithm will clone 
 *                 // value.get()
 *                 value: value.get(),
 * 
 *                 // and the assigner will make sure it is 
 *                 // stored in clonedWrapper
 *                 assigner(cloned) {
 *                     clonedWrapper.set(cloned)
 *                 }
 *             }]
 *         };
 *     }
 * });
 * 
 * console.log(wrapper.get());  // { foo: "bar" }
 * console.log(cloned.get());   // { foo: "bar" }
 * console.log(cloned.get() === wrapper.get());  // false
 * ```
 * 
 * The customizer can return an object with a `dontCloneProps` property. If 
 * it is `true`, the props of the cloned value will NOT be cloned. If the object 
 * returns a `dontClone` property that is `true`, the value won't be cloned at 
 * all.
 * 
 * Normally, errors thrown by the customizer are caught and fed to the `log`. If 
 * you would like the customizer to throw errors, then have the object returned 
 * by customizer have a `doThrow` property with the value of `true`.
 * 
 * You could also use the customizer to support unsupported types. Or if you 
 * make the regrettable decision of monkeypatching core JavaScript classes, you 
 * could use the customizer to compensate so that this function still works 
 * properly. But please don't do that.
 * 
 * @param {any} value The value to deeply copy.
 * @param {Object} options Additional options for the clone.
 * @param {Function} options.customizer Allows the user to inject custom logic. 
 * The function is given the value to copy. If the function returns an object 
 * with a `customClone` property , the value on that property will be used as the
 * clone (if it is not `undefined`). See the documentation for `clone` for more 
 * information.
 * @param {Function} options.log Any errors which occur during the algorithm can 
 * optionally be passed to a log function. `log` should take one argument, which 
 * will be the error encountered. Use this to the log the error to a custom 
 * logger.
 * @returns {Object} The deep copy.
 */
function clone(value, options) {
    if (typeof options !== "object") options = {};
    const { customizer, log } = options;
    return cloneInternalNoRecursion(value, customizer, log);
}

export default clone;
