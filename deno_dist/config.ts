import { templates } from "./containers.ts";
import { copyProps, XMLEscape } from "./utils.ts";
import EtaErr from "./err.ts";

/* TYPES */

import { TemplateFunction } from "./compile.ts";
import { Cacher } from "./storage.ts";

type trimConfig = "nl" | "slurp" | false;

export interface EtaConfig {
  /** Name of the data object. Default `it` */
  varName: string;
  /** Configure automatic whitespace trimming. Default `[false, 'nl']` */
  autoTrim: trimConfig | [trimConfig, trimConfig];
  /** Remove all safe-to-remove whitespace */
  rmWhitespace: boolean;
  /** Whether or not to automatically XML-escape interpolations. Default true */
  autoEscape: boolean;
  /** Delimiters: by default `['<%', '%>']` */
  tags: [string, string];
  /** Parsing options */
  parse: {
    /** Which prefix to use for interpolation. Default `"="` */
    interpolate: string;
    /** Which prefix to use for raw interpolation. Default `"~"` */
    raw: string;
    /** Which prefix to use for evaluation. Default `""` */
    exec: string;
  };
  /** XML-escaping function */
  e: (str: string) => string;
  plugins: Array<{ processFnString?: Function; processAST?: Function }>;
  /** Compile to async function */
  async: boolean;
  /** Holds template cache */
  templates: Cacher<TemplateFunction>;
  /** Whether or not to cache templates if `name` or `filename` is passed */
  cache: boolean;
  /** Directories that contain templates */
  views?: string | Array<string>;
  /** Where should absolute paths begin? Default '/' */
  root?: string;
  /** Absolute path to template file */
  filename?: string;
  /** Name of template file */
  name?: string;
  /** Whether or not to cache templates if `name` or `filename` is passed */
  "view cache"?: boolean;
  /** Make data available on the global object instead of varName */
  useWith?: boolean;
  /** Function to include templates by name */
  include?: Function;
  /** Function to include templates by filepath */
  includeFile?: Function;
  [index: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface EtaConfigWithFilename extends EtaConfig {
  filename: string;
}

export type PartialConfig = Partial<EtaConfig>;

/* END TYPES */

/**
 * Include a template based on its name (or filepath, if it's already been cached).
 *
 * Called like `include(templateNameOrPath, data)`
 */

function includeHelper(
  this: EtaConfig,
  templateNameOrPath: string,
  data: object,
): string {
  var template = this.templates.get(templateNameOrPath);
  if (!template) {
    throw EtaErr('Could not fetch template "' + templateNameOrPath + '"');
  }
  return template(data, this);
}

/** Eta's base (global) configuration */
var config: EtaConfig = {
  varName: "it",
  autoTrim: [false, "nl"],
  rmWhitespace: false,
  autoEscape: true,
  tags: ["<%", "%>"],
  parse: {
    interpolate: "=",
    raw: "~",
    exec: "",
  },
  async: false,
  templates: templates,
  cache: false,
  plugins: [],
  useWith: false,
  e: XMLEscape,
  include: includeHelper,
};

/**
 * Takes one or two partial (not necessarily complete) configuration objects, merges them 1 layer deep into eta.config, and returns the result
 *
 * @param override Partial configuration object
 * @param baseConfig Partial configuration object to merge before `override`
 *
 * **Example**
 *
 * ```js
 * let customConfig = getConfig({tags: ['!#', '#!']})
 * ```
 */

function getConfig(override: PartialConfig, baseConfig?: EtaConfig): EtaConfig {
  // TODO: run more tests on this

  var res: PartialConfig = {}; // Linked
  copyProps(res, config); // Creates deep clone of eta.config, 1 layer deep

  if (baseConfig) {
    copyProps(res, baseConfig);
  }

  if (override) {
    copyProps(res, override);
  }

  return res as EtaConfig;
}

/** Update Eta's base config */

function configure(options: PartialConfig) {
  return copyProps(config, options);
}

export { config, getConfig, configure };
