const Tag = Object.freeze({
    ARGUMENTS: '[object Arguments]',
    ARRAY: '[object Array]',
    BOOLEAN: '[object Boolean]',
    DATE: '[object Date]',
    ERROR: '[object Error]',
    MAP: '[object Map]',
    NUMBER: '[object Number]',
    OBJECT: '[object Object]',
    REGEXP: '[object RegExp]',
    SET: '[object Set]',
    STRING: '[object String]',
    SYMBOL: '[object Symbol]',
    WEAKMAP: '[object WeakMap]',
    WEAKSET: "[object WeakSet]",
    ARRAYBUFFER: '[object ArrayBuffer]',
    DATAVIEW: '[object DataView]',
    FLOAT32: '[object Float32Array]',
    FLOAT64: '[object Float64Array]',
    INT8: '[object Int8Array]',
    INT16: '[object Int16Array]',
    INT32: '[object Int32Array]',
    UINT8: '[object Uint8Array]',
    UINT8CLAMPED: '[object Uint8ClampedArray]',
    UINT16: '[object Uint16Array]',
    UINT32: '[object Uint32Array]'
});

function cloneInternalNoRecursion(_value, customizer, log) {
    
    if (typeof log !== "function") log = console.warn;

    let result;

    // Will be used to store cloned values so that we don't loop infinitely on 
    // circular references.
    const cloneStore = new Map();

    // This symbol is used to indicate that the cloned value is the top-level 
    // object that will be returned by the function.
    const TOP_LEVEL = Symbol("TOP_LEVEL");

    // A queue so we can avoid recursion.
    const queue = [{ value: _value, parentOrAssigner: TOP_LEVEL }];    
    
    // We will do a second pass through everything to check Object.isExtensible, 
    // Object.isSealed and Object.isFrozen. We do it last so we don't run into 
    // issues where we append properties on a frozen object, etc
    const isExtensibleSealFrozen = [];
    
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

        return new CloneDeepWarning(message, cause);
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
                         "or set accessor."));
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
    
    /**
     * Gets a "tag", which is an string which identifies the type of a value.
     * `Object.prototype.toString` returns a string like `"[object <Type>]"`, 
     * where type is the type of the object. We refer this return value as the 
     * **tag**. Normally, the tag is determined by what 
     * `this[Symbol.toStringTag]` is, but the JavaScript specification for 
     * `Object.prototype.toString` requires that many native JavaScript objects 
     * return a specific tag if the object does not have the 
     * `Symbol.toStringTag` property. This makes 
     * `Object.prototype.toString.call` a stronger type-check that `instanceof`.
     * 
     * @example
     * ```
     * const date = new Date();
     * console.log(date instanceof Date);  // true
     * console.log(tagOf(date));  // "[object Date]"
     * 
     * const dateSubclass = Object.create(Date.prototype);
     * console.log(dateSubclass instance Date);  // true;
     * console.log(tagOf(dateSubClass));  // "[object Object]"
     * 
     * // This is not a perfect type check because we can do:
     * dateSubclass[Symbol.toStringTag] = "Date"
     * console.log(tagOf(dateSubClass));  // "[object Date]"
     * ```
     * 
     * @param {any} value The value to get the tag of.
     * @returns {String} tag A string indicating the value's type.
     */
    function tagOf(value) {
        return Object.prototype.toString.call(value);
    }

    for (let obj = queue.shift(); obj !== undefined; obj = queue.shift()) {
        // `value` is the value to deeply clone
        // `parentOrAssigner` is either
        //     - TOP_LEVEL - this value is the top-level object that will be 
        //                   returned by the function
        //     - object    - a parent object this value is nested under
        //     - function  - an "assigner" that has the responsiblity of 
        //                   assigning the cloned value to something
        // `prop` is used with `parentOrAssigner` if it is an object so that the 
        // cloned object will be assigned to `parentOrAssigner[prop]`.
        // `metadata` contains the property descriptor(s) for the value. It may 
        // be undefined.
        const { value, parentOrAssigner, prop, metadata } = obj;
        
        // Will contain the cloned object.
        let cloned;

        // Check for circular references.
        const seen = cloneStore.get(value);
        if (seen !== undefined) {
            assign(seen, parentOrAssigner, prop, metadata);
            continue;
        }

        // If true, do not not clone the properties of value.
        let ignoreProps;

        // If true, do not have `cloned` share the prototype of `value`.
        let ignoreProto;

        // Is true if the customizer determines the value of `cloned`.
        let useCustomizerClone;

        // Perform user-injected logic if applicable.
        if (typeof customizer === "function") {

            let clone, additionalValues, ignore, doThrow;

            try {
                const customResult = customizer(value);
                
                if (typeof customResult === "object") {
                    useCustomizerClone = true;

                    // Must wrap destructure in () if not variable declaration
                    ({ clone, 
                       additionalValues,
                       ignore,
                       ignoreProps,
                       ignoreProto,
                       doThrow
                    } = customResult);

                    if (ignore === true) continue;

                    cloned = assign(clone, 
                                    parentOrAssigner, 
                                    prop, 
                                    metadata);

                    if (Array.isArray(additionalValues))
                        additionalValues.forEach(object => {
                            if (typeof object === "object") {
                                if (object.parentOrAssigner === undefined)
                                    object.parentOrAssigner = object.assigner
                                                              || object.parent;
                                queue.push(object);
                            }
                        });
                }
            }
            catch(error) {
                if (doThrow === true) throw error;

                clone = undefined;
                useCustomizerClone = false;
                
                error.message = "customizer encountered error. Its results " + 
                                "will be ignored for the current value, and " + 
                                "the algorithm will proceed with default " + 
                                "behavior. Error encountered: " + error.message;
                log(warn(error.message, error.cause));
            }
        }

        try {
            // skip the following "else if" branches
            if (useCustomizerClone === true) {}

            // If value is primitive, just assign it directly.
            else if (value === null || !["object", "function"]
                    .includes(typeof value)) {
                assign(value, parentOrAssigner, prop, metadata);
                continue;
            }

            // We won't clone weakmaps or weaksets.
            else if ([Tag.WEAKMAP, Tag.WEAKSET].includes(tagOf(value)))
                throw warn(`Attempted to clone unsupported type${
                            typeof value.constructor === "function" && 
                            typeof value.constructor.name === "string"
                                ? ` ${value.constructor.name}`
                                : ""
                            }.`);

            // We only copy functions if they are methods.
            else if (typeof value === "function") {
                cloned = assign(parentOrAssigner !== TOP_LEVEL 
                        ? value 
                        : {}, 
                    parentOrAssigner, 
                    prop, 
                    metadata);
                log(warn(`Attempted to clone function${typeof prop === "string"
                                                       ? ` with name ${prop}`
                                                       : ""  }. ` + 
                        "JavaScript functions cannot be cloned. If this " + 
                        "function is a method, then it will be copied "+ 
                        "directly."));
                if (parentOrAssigner === TOP_LEVEL) continue;
            }

            // If value is a Node Buffer, just use Buffer's subarray method.
            else if (typeof global === "object"
                    && global.Buffer
                    && typeof Buffer === "function"
                    && typeof Buffer.isBuffer === "function"
                    && Buffer.isBuffer(value))
                cloned = assign(value.subarray(), 
                                parentOrAssigner, 
                                prop, 
                                metadata);
            
            else if (Array.isArray(value))
                cloned = assign(new Array(value.length), 
                                parentOrAssigner, 
                                prop, 
                                metadata);

            // Ordinary objects, or the rare `arguments` clone
            else if ([Tag.OBJECT, Tag.ARGUMENTS].includes(tagOf(value)))
                cloned = assign(Object.create(Object.getPrototypeOf(value)), 
                                parentOrAssigner, 
                                prop,
                                metadata);
            
            // values that will be called using contructor
            else {
                const Value = value.constructor;

                // Booleans, Number, String or Symbols which used `new` syntax 
                // so JavaScript thinks they are objects
                // We also handle Date here because it is convenient
                if ([Tag.BOOLEAN, Tag.DATE].includes(tagOf(value)))
                    cloned = assign(new Value(Number(value)), 
                                    parentOrAssigner, 
                                    prop,
                                    metadata);
                else if ([Tag.NUMBER, Tag.STRING].includes(tagOf(value)))
                    cloned = assign(new Value(value), 
                                    parentOrAssigner, 
                                    prop, 
                                    metadata);
                else if (Tag.SYMBOL === tagOf(value)) {
                    cloned = assign(
                        Object(Symbol.prototype.valueOf.call(value)), 
                        parentOrAssigner, 
                        prop,
                        metadata);
                }

                else if (Tag.REGEXP === tagOf(value)) {
                    const regExp = new Value(value.source, /\w*$/.exec(value));
                    regExp.lastIndex = value.lastIndex;
                    cloned = assign(regExp, parentOrAssigner, prop, metadata);
                }

                else if (Tag.ERROR === tagOf(value)) {
                    const cause = value.cause;
                    cloned = assign(cause === undefined
                                        ? new Value(value.message)
                                        : new Value(value.message, { cause }),
                                    parentOrAssigner,
                                    prop,
                                    metadata);
                }

                else if (Tag.ARRAYBUFFER === tagOf(value)) {
                    // copy data over to clone
                    const arrayBuffer = new Value(value.byteLength);
                    new Uint8Array(arrayBuffer).set(new Uint8Array(value));
                    
                    cloned = assign(arrayBuffer, 
                                    parentOrAssigner, 
                                    prop, 
                                    metadata);
                }
                
                // TypeArrays
                else if ([   
                            Tag.DATAVIEW, 
                            Tag.FLOAT32,
                            Tag.FLOAT64,
                            Tag.INT8,
                            Tag.INT16,
                            Tag.INT32,
                            Tag.UINT8,
                            Tag.UINT8CLAMPED,
                            Tag.UINT16,
                            Tag.UINT32
                        ].includes(tagOf(value))) {
                    // copy data over to clone
                    const buffer = new value.buffer.constructor(
                        value.buffer.byteLength);
                    new Uint8Array(buffer).set(new Uint8Array(value.buffer));
                    
                    cloned = assign(
                        new Value(buffer, value.byteOffset, value.length),
                        parentOrAssigner,
                        prop,
                        metadata);
                }

                else if (Tag.MAP === tagOf(value)) {
                    const map = new Value;
                    cloned = assign(map, parentOrAssigner, prop, metadata);
                    value.forEach((subValue, key) => {
                        queue.push({ 
                            value: subValue, 
                            parentOrAssigner: cloned => {
                                isExtensibleSealFrozen.push([subValue, cloned]);
                                map.set(key, cloned)
                            }
                        });
                    });
                }

                else if (Tag.SET === tagOf(value)) {
                    const set = new Value;
                    cloned = assign(set, parentOrAssigner, prop, metadata);
                    value.forEach(subValue => {
                        queue.push({ 
                            value: subValue, 
                            parentOrAssigner: cloned => {
                                isExtensibleSealFrozen.push([subValue, cloned]);
                                map.set(key, cloned)
                            }
                        });
                    });
                }

                else
                    throw warn("Attempted to clone unsupported type.");
            }
        }
        catch(error) {
            error.message = "Encountered error while attempting to clone " + 
                            "specific value. The value will be \"cloned\" " + 
                            "into an empty object. Error encountered: " + 
                            error.message
            log(warn(error.message, error.cause));
            cloned = assign({}, parentOrAssigner, prop, metadata);

            // We don't want the prototype if we failed and set the value to an 
            // empty object.
            ignoreProto = true;
        }

        cloneStore.set(value, cloned);

        isExtensibleSealFrozen.push([value, cloned]);

        // Ensure clone has prototype of value
        if (ignoreProto !== true
            && Object.getPrototypeOf(cloned) !== Object.getPrototypeOf(value))
            Object.setPrototypeOf(cloned, Object.getPrototypeOf(value));

        if (ignoreProps === true) continue;

        // Now copy all enumerable and non-enumerable properties.
        [Object.getOwnPropertyNames(value), Object.getOwnPropertySymbols(value)]
            .flat()
            .forEach(key => {
                queue.push({ 
                    value: value[key], 
                    parentOrAssigner: cloned,
                    prop: key,
                    metadata: Object.getOwnPropertyDescriptor(value, key)
                });
            });
    }

    // Check extensible, seal, and frozen statuses.
    isExtensibleSealFrozen.forEach(([value, cloned]) => {
        if (!Object.isExtensible(value)) Object.preventExtensions(cloned);
        if (Object.isSealed(value)) Object.seal(cloned);
        if (Object.isFrozen(value)) Object.freeze(cloned);
    });

    return result;
}

/**
 * Create a deep copy of the provided value.
 * The cloned object will point to the *same prototype* as the original.
 * 
 * This behaves like `structuredClone`, but there are differences:
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
 *  - Unsupported types do not cause errors to be thrown. Instead, unsupported 
 * types are simply "cloned" into an empty object and a noisy warning is logged 
 * to the console (or sent to the custom logger provided).
 * 
 * WeakMaps and WeakSets are not supported types. It is actually impossible to 
 * properly clone a WeakMap or WeakSet.
 * 
 * Functions also cannot be properly cloned. If you provide a function to this 
 * method, an empty object will be returned. However, if you provide an object 
 * with methods, they will be copied by value (no new function object will be 
 * created). A warning is logged if this occurs.
 * 
 * This method will clone many of JavaScripts native classes. These include 
 * Date, RegExp, ArrayBuffer, all the TypeArray classes, Map, Set, Number, 
 * Boolean, String, and Symbol. The algorithm type-checks for these classes 
 * using `Object.prototype.toString.call`, so if you override the 
 * `Symbol.toStringTag` irresponsibly, the algorithm may incorrectly try to 
 * clone a value into a native type.
 * 
 * An optional `customizer` can be provided to inject additional logic. The 
 * customizer has the responsibility of determining what object a value should 
 * be cloned into. If it returns an object, then the value of the `clone` 
 * property on that object is used as the clone for the given value. If the 
 * object doesn't have a `clone` property, then the value is cloned into 
 * `undefined`. If the customizer returns anything that is not an object, then 
 * the algorithm will perform its default behavior.
 * 
 * @example
 * ```
 * // Don't clone methods
 * const myObject = { 
 *     a: 1, 
 *     func: () => "I am a function" 
 * };
 * const cloned = cloneDeep(myObject, {
 *     customizer(value) {
 *         if (typeof value === "function") {
 *             return { clone: {} };
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
 * const cloned = cloneDeep(wrapper, {
 *     customizer(value) {
 *         if (!(value instanceof Wrapper)) return;
 * 
 *         const clonedWrapper = new Wrapper();
 *         
 *         return {
 *             clone: clonedWrapper,
 * 
 *             additionalValues: [{
 *                 // the cloning algorithm will clone 
 *                 // value.get()
 *                 value: value.get(),
 * 
 *                 // and the assigner will make sure it is 
 *                 // stored in clone
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
 * The customizer object can have some additional effects by having any of the 
 * following properties:
 * 
 *  - `ignoreProps` -  If `true`, the properties of the cloned value will NOT be 
 * cloned.
 *  - `ignoreProto` - If `true`, the prototype of the value will not be copied 
 * to the clone. 
 *  - `ignore` - If `true`, the value will not be cloned at all.
 *  - `doThrow` - If `true`, errors thrown by the customizer will be thrown by 
 * `cloneDeep`. Otherwise, errors thrown by the customizer will be sent to the 
 * logger function.
 * 
 * The customizer has extremely high priority over the default behavior of the 
 * algorithm. The only logic the algorithm prioritizes over the customizer is 
 * the check for circular references. 
 * 
 * The best use of the customizer to support user-made types. You can also use 
 * it to override some of the design decisions made in the algorithm (you could, 
 * for example, use it to throw if the user tries to clone functions, WeakMaps, 
 * or WeakSets). 
 * 
 * @param {any} value The value to deeply copy.
 * @param {Object} options Additional options for the clone.
 * @param {Function} options.customizer Allows the user to inject custom logic. 
 * The function is given the value to copy. If the function returns an object, 
 * the value of the `clone` property on that object will be used as the clone. 
 * See the documentation for `cloneDeep` for more information.
 * @param {Function} options.log Any errors which occur during the algorithm can 
 * optionally be passed to a log function. `log` should take one argument, which 
 * will be the error encountered. Use this to the log the error to a custom 
 * logger.
 * @param {String} options.logMode Case-insensitive. If "silent", no warnings 
 * will be logged. Use with caution, as failures to perform true clones are
 * logged as warnings. If "quiet", the stack trace of the warning is ignored.
 * @returns {Object} The deep copy.
 */
function cloneDeep(value, options) {
    if (typeof options !== "object") options = {};
    let { customizer, log, logMode } = options;

    if (logMode !== "string");
    else if (logMode.toLowerCase() === "silent") 
        log = () => { /* no-op */ };
    else if (logMode.toLowerCase() === "quiet")
        log = error => console.warn(error.message);

    return cloneInternalNoRecursion(value, customizer, log);
}

export default cloneDeep;
