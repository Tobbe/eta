import compile from "./compile.ts";
import { getConfig } from "./config.ts";
import { promiseImpl } from "./polyfills.ts";
import EtaErr from "./err.ts";

/* TYPES */

import { EtaConfig, PartialConfig } from "./config.ts";
import { TemplateFunction } from "./compile.ts";
import { CallbackFn } from "./file-handlers.ts";

/* END TYPES */

function handleCache(
  template: string | TemplateFunction,
  options: EtaConfig,
): TemplateFunction {
  var templateFunc;

  if (options.cache && options.name && options.templates.get(options.name)) {
    return options.templates.get(options.name);
  }

  if (typeof template === "function") {
    templateFunc = template;
  } else {
    templateFunc = compile(template, options);
  }

  // Note that we don't have to check if it already exists in the cache;
  // it would have returned earlier if it had
  if (options.cache && options.name) {
    options.templates.define(options.name, templateFunc);
  }

  return templateFunc;
}

/**
 * Render a template
 *
 * If `template` is a string, Eta will compile it to a function and then call it with the provided data.
 * If `template` is a template function, Eta will call it with the provided data.
 *
 * If `config.async` is `false`, Eta will return the rendered template.
 *
 * If `config.async` is `true` and there's a callback function, Eta will call the callback with `(err, renderedTemplate)`.
 * If `config.async` is `true` and there's not a callback function, Eta will return a Promise that resolves to the rendered template
 *
 * If `config.cache` is `true` and `config` has a `name` or `filename` property, Eta will cache the template on the first render and use the cached template for all subsequent renders.
 *
 * @param template Template string or template function
 * @param data Data to render the template with
 * @param config Optional config options
 * @param cb Callback function
 */

export default function render(
  template: string | TemplateFunction,
  data: object,
  config?: PartialConfig,
  cb?: CallbackFn,
): string | Promise<string> | void {
  var options = getConfig(config || {});

  if (options.async) {
    var result;
    if (cb) {
      // If user passes callback
      try {
        // Note: if there is an error while rendering the template,
        // It will bubble up and be caught here
        var templateFn = handleCache(template, options);
        templateFn(data, options, cb);
      } catch (err) {
        return cb(err);
      }
    } else {
      // No callback, try returning a promise
      if (typeof promiseImpl === "function") {
        return new promiseImpl(function (resolve: Function, reject: Function) {
          try {
            result = handleCache(template, options)(data, options);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
      } else {
        throw EtaErr(
          "Please provide a callback function, this env doesn't support Promises",
        );
      }
    }
  } else {
    return handleCache(template, options)(data, options);
  }
}
