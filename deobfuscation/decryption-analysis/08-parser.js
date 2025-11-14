function extendOptions(options) {
    options = options || {};

    const defaultOptions = {
        skipIfAlreadyFound: true,
        type: "string",
    };

    options.skipIfAlreadyFound = options.skipIfAlreadyFound || defaultOptions.skipIfAlreadyFound;
    options.type = options.type || defaultOptions.type;

    return options;
}

function createHandlerFromRegExp(name, regExp, options) {
    let transformer;

    if (!options.type) {
        transformer = input => input;
    } else if (options.type.toLowerCase() === "lowercase") {
        transformer = input => input.toLowerCase();
    } else if (options.type.toLowerCase().slice(0, 4) === "bool") {
        transformer = () => true;
    } else if (options.type.toLowerCase().slice(0, 3) === "int") {
        transformer = input => parseInt(input, 10);
    } else {
        transformer = input => input;
    }

    function handler({ title, result }) {
        if (result[name] && options.skipIfAlreadyFound) {
            return null;
        }

        const match = title.match(regExp);
        const [rawMatch, cleanMatch] = match || [];

        if (rawMatch) {
            result[name] = options.value || transformer(cleanMatch || rawMatch);
            return match.index;
        }

        return null;
    }

    handler.handlerName = name;

    return handler;
}

function cleanTitle(rawTitle) {
    let cleanedTitle = rawTitle;

    if (cleanedTitle.indexOf(" ") === -1 && cleanedTitle.indexOf(".") !== -1) {
        cleanedTitle = cleanedTitle.replace(/\./g, " ");
    }

    cleanedTitle = cleanedTitle.replace(/_/g, " ");
    cleanedTitle = cleanedTitle.replace(/([(_]|- )$/, "").trim();

    return cleanedTitle;
}

class Parser {

    constructor() {
        this.handlers = [];
    }

    addHandler(handlerName, handler, options) {
        if (typeof handler === "undefined" && typeof handlerName === "function") {

            // If no name is provided and a function handler is directly given
            handler = handlerName;
            handler.handlerName = "unknown";

        } else if (typeof handlerName === "string" && handler instanceof RegExp) {

            // If the handler provided is a regular expression
            options = extendOptions(options);
            handler = createHandlerFromRegExp(handlerName, handler, options);

        } else if (typeof handler === "function") {

            // If the handler is a function
            handler.handlerName = handlerName;

        } else {

            // If the handler is neither a function nor a regular expression, throw an error
            throw new Error(`Handler for ${handlerName} should be a RegExp or a function. Got: ${typeof handler}`);

        }

        this.handlers.push(handler);
    }

    parse(title) {
        const result = {};
        let endOfTitle = title.length;

        for (const handler of this.handlers) {
            const matchIndex = handler({ title, result });

            if (matchIndex && matchIndex < endOfTitle) {
                endOfTitle = matchIndex;
            }
        }

        result.title = cleanTitle(title.slice(0, endOfTitle));

        return result;
    }
}

//exports.Parser = Parser;